import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE_URL = 'https://arrival-atlas.pro';
const OUT = 'tools/black-box-audit/artifacts/probe-005';
const PROFILE_NAV_RE = /Профіль|Профиль|Profile/i;
const HOUSEHOLD_RE = /Household\s*&\s*family|Сім[ʼ'’']я та домогосподарство/i;
const BENEFITS_SIM_RE = /Benefits Simulator|Відкрити Benefits Simulator|Benefits.?Simulator/i;
const EXECUTION_CTA_RE =
  /calculate|simulate|submit|save|apply|execute|generate|search|get recommendations|розрахув|симул|зберег|застосув|виконан|згенеру|пошук|отримати рекоменд/i;
const HOUSEHOLD_VALUE_RE =
  /household|family|married|marital|partner|child|children|household size|сімейн|одружен|заміжн|домогосподар|партнер|діт|дитин/i;

await fs.mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();

const consoleErrors = [];
const pageErrors = [];
const requestFailures = [];
const captured = [];
const requestStartedAt = new WeakMap();
let seq = 0;
let phase = 'setup';
let stopReason = null;
let autoExecutionDetected = false;

page.on('console', msg => {
  if (msg.type() === 'error') {
    consoleErrors.push({ phase, text: msg.text() });
  }
});
page.on('pageerror', error => {
  pageErrors.push({ phase, message: error.message });
});
page.on('request', request => {
  requestStartedAt.set(request, Date.now());
});
page.on('requestfailed', request => {
  requestFailures.push({
    phase,
    seq: seq + 1,
    url: safeUrl(request.url()),
    method: request.method(),
    failure: request.failure()?.errorText ?? 'unknown',
  });
});

function safeUrl(raw) {
  try {
    const u = new URL(raw);
    u.searchParams.forEach((value, key) => {
      if (/token|key|secret|auth|password|session/i.test(key)) {
        u.searchParams.set(key, '[REDACTED]');
      }
    });
    return u.toString();
  } catch {
    return raw;
  }
}

function hostnameOf(raw) {
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

function redactSecrets(value) {
  if (value == null) {
    return value;
  }
  if (typeof value === 'string') {
    if (/^eyJ/.test(value) && value.length > 20) {
      return '[REDACTED]';
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(redactSecrets);
  }
  if (typeof value === 'object') {
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      if (/token|secret|password|authorization|cookie|apikey|api_key|access_token|refresh_token/i.test(key)) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = redactSecrets(child);
      }
    }
    return out;
  }
  return value;
}

function looksLikeExecution(entry) {
  const blob = `${entry.method} ${entry.url} ${entry.requestPayload || ''}`;
  return /\/execute|\/run(?!-summary)|\/generate|openai|anthropic|\/ai\/|prompt|generation|simulate|calculate/i.test(
    blob
  );
}

function looksLikeProvider(entry) {
  const host = hostnameOf(entry.url) || '';
  return /openai|anthropic|generativelanguage|groq|mistral|together|fireworks|openrouter/i.test(`${host} ${entry.url}`);
}

function isLanguagePref(entry) {
  const payload = String(entry.requestPayload || '');
  return /\/api\/mutations/i.test(entry.url) && /preferredLanguage|pref\.update/i.test(payload);
}

function isUnexpectedWriteOrExecution(entry) {
  if (looksLikeExecution(entry) || looksLikeProvider(entry)) {
    return true;
  }
  if (/\/execute/i.test(entry.url) || /\/run(?!-summary)/i.test(entry.url)) {
    return true;
  }
  if (/PUT|PATCH|DELETE/i.test(entry.method)) {
    if (/\/api\/sessions?\//i.test(entry.url) && phase === 'setup') {
      return false;
    }
    return true;
  }
  if (/POST/i.test(entry.method)) {
    if (isLanguagePref(entry)) {
      return false;
    }
    if (/\/api\/sessions?(\/|$|\?)/i.test(entry.url) && phase === 'setup') {
      return false;
    }
    return true;
  }
  return false;
}

function classifyRequest(entry) {
  return {
    languagePref: isLanguagePref(entry),
    pageNavigation: /GET/i.test(entry.method) && /\/(modules|profile)/i.test(entry.url) && !/\/api\//.test(entry.url),
    profileRead: /GET/i.test(entry.method) && /\/api\/(user-context|profile-insights|ui-snapshot|profile)/i.test(entry.url),
    benefitsRead: /GET/i.test(entry.method) && /benefits-simulator|benefits/i.test(entry.url),
    discoveryRead: /GET/i.test(entry.method) && /\/api\/modules\/discovery/i.test(entry.url),
    mutations: /\/api\/mutations/i.test(entry.url),
    writeMethod: /POST|PUT|PATCH|DELETE/i.test(entry.method),
    execute: /\/execute/i.test(entry.url),
    executionLike: looksLikeExecution(entry),
    providerLike: looksLikeProvider(entry),
    rsc: /[?&]_rsc=|_rsc/i.test(entry.url),
    unexpectedWriteOrExecution: isUnexpectedWriteOrExecution(entry),
  };
}

async function recordResponse(response) {
  const request = response.request();
  const url = safeUrl(response.url());
  const method = request.method();
  const host = hostnameOf(url);
  const resourceType = request.resourceType();
  const interesting =
    /\/api\/|\/modules\/|_rsc|rsc=|mutation|execute|\/run|ui-snapshot|user-context|profile|benefits|household|openai|anthropic|\/ai\//i.test(
      `${method} ${url}`
    ) ||
    looksLikeProvider({ url }) ||
    ((/POST|PUT|PATCH|DELETE/i.test(method)) && /xhr|fetch|document/i.test(resourceType));
  if (!interesting) {
    return;
  }
  let responseBody = null;
  try {
    const contentType = response.headers()['content-type'] || '';
    if (contentType.includes('json')) {
      responseBody = await response.json();
    } else {
      responseBody = (await response.text()).slice(0, 4000);
    }
  } catch {
    responseBody = null;
  }
  seq += 1;
  const started = requestStartedAt.get(request);
  const entry = {
    seq,
    phase,
    timestamp: new Date().toISOString(),
    durationMs: started ? Date.now() - started : null,
    method,
    url,
    hostname: host,
    status: response.status(),
    resourceType,
    requestPayload: redactSecrets(request.postData() || null),
    responseBody: redactSecrets(responseBody),
  };
  entry.flags = classifyRequest(entry);
  captured.push(entry);
  if (phase === 'after-benefits-open' && (looksLikeExecution(entry) || looksLikeProvider(entry))) {
    autoExecutionDetected = true;
    stopReason = `Automatic execution/provider on open: ${method} ${url} status=${response.status()}`;
  }
  if (phase === 'after-benefits-open' && isUnexpectedWriteOrExecution(entry) && !looksLikeExecution(entry) && !looksLikeProvider(entry)) {
    stopReason = stopReason || `Unexpected write: ${method} ${url} status=${response.status()}`;
  }
}

page.on('response', response => {
  recordResponse(response).catch(() => {});
});

function summarizeNetwork(list) {
  return list.map(entry => ({
    seq: entry.seq,
    phase: entry.phase,
    method: entry.method,
    status: entry.status,
    resourceType: entry.resourceType,
    url: entry.url,
    flags: entry.flags,
    requestPayload: entry.requestPayload,
  }));
}

async function dumpGraphNodes() {
  return page
    .getByRole('listbox', { name: /Consequence graph nodes/i })
    .getByRole('button')
    .evaluateAll(els =>
      els.map(el => ({
        text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
        disabled: el.disabled,
        ariaDisabled: el.getAttribute('aria-disabled'),
        ariaSelected: el.getAttribute('aria-selected'),
        visible: el.offsetParent !== null || el.getClientRects().length > 0,
      }))
    )
    .catch(() => []);
}

async function dumpInspector() {
  return page.evaluate(() => {
    const textOf = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
    const root = document.querySelector('[role="complementary"]') || document.querySelector('aside');
    if (!root) {
      return null;
    }
    const titleEl = root.querySelector('h3, h2, h1');
    const paragraphs = [...root.querySelectorAll('p')].map(el => textOf(el)).filter(Boolean);
    const sections = {};
    for (const heading of root.querySelectorAll('h4')) {
      const key = textOf(heading);
      const parts = [];
      let next = heading.nextElementSibling;
      while (next && !/^H[1-4]$/.test(next.tagName)) {
        parts.push(textOf(next));
        next = next.nextElementSibling;
      }
      sections[key] = parts.join(' ').trim();
    }
    const actions = [...root.querySelectorAll('a, button, [role="button"], [role="link"]')].map(el => ({
      tag: el.tagName,
      text: textOf(el),
      href: el.getAttribute('href'),
      disabled: Boolean(el.disabled) || el.getAttribute('aria-disabled') === 'true',
    }));
    const terms = [...root.querySelectorAll('dt, dd')].map(el => ({
      tag: el.tagName,
      text: textOf(el),
    }));
    return {
      title: titleEl ? textOf(titleEl) : null,
      statusParagraph: paragraphs[0] || null,
      paragraphs,
      sections,
      actions,
      terms,
      raw: textOf(root).slice(0, 4000),
    };
  });
}

async function dumpUi() {
  const headings = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll(
    els => els.map(e => ({ tag: e.tagName, text: e.textContent.trim() }))
  );
  const buttons = await page.getByRole('button').evaluateAll(els =>
    els.map(el => ({
      text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
      disabled: el.disabled,
      ariaDisabled: el.getAttribute('aria-disabled'),
      ariaLabel: el.getAttribute('aria-label'),
      selected: el.getAttribute('aria-selected'),
    }))
  );
  const links = await page.getByRole('link').evaluateAll(els =>
    els.map(el => ({
      text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
      href: el.getAttribute('href'),
      ariaCurrent: el.getAttribute('aria-current'),
    }))
  );
  const inputs = await page.locator('input, select, textarea').evaluateAll(els =>
    els.map(el => ({
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type'),
      id: el.id || null,
      name: el.getAttribute('name'),
      value: 'value' in el ? String(el.value).slice(0, 120) : null,
      disabled: Boolean(el.disabled),
      visible: el.offsetParent !== null || el.getClientRects().length > 0,
    }))
  );
  const snapshot = await page.locator('body').ariaSnapshot();
  const visibleText = await page.locator('body').innerText();
  const graphNodes = await dumpGraphNodes();
  const inspector = await dumpInspector();
  const currentItems = await page
    .locator('[aria-current="page"], [aria-current="true"], [aria-selected="true"]')
    .evaluateAll(els =>
      els.map(el => ({
        tag: el.tagName,
        text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200),
        ariaCurrent: el.getAttribute('aria-current'),
        ariaSelected: el.getAttribute('aria-selected'),
      }))
    )
    .catch(() => []);
  const text = `${visibleText}\n${JSON.stringify(inspector || {})}`;
  const benefitsLinks = links.filter(l => BENEFITS_SIM_RE.test(`${l.text} ${l.href || ''}`));
  const executionCtAs = [
    ...buttons.filter(b => EXECUTION_CTA_RE.test(`${b.text} ${b.ariaLabel || ''}`)),
    ...links.filter(l => EXECUTION_CTA_RE.test(`${l.text} ${l.href || ''}`)),
  ];
  return {
    url: page.url(),
    title: await page.title(),
    lang: await page.locator('html').getAttribute('lang'),
    headings,
    buttons,
    links,
    inputs,
    formCount: await page.locator('form').count(),
    graphNodes,
    inspector,
    currentItems,
    householdNode: (graphNodes || []).find(n => HOUSEHOLD_RE.test(n.text || '')) || null,
    benefitsLinks,
    executionCtAs,
    householdComplete:
      /complete/i.test((graphNodes || []).find(n => HOUSEHOLD_RE.test(n.text || ''))?.text || '') ||
      (/household/i.test(inspector?.title || '') && /complete/i.test(inspector?.statusParagraph || '')),
    householdSize3:
      /household size[\s\S]{0,40}\b3\b|розмір домогосподарства[\s\S]{0,40}\b3\b|household of 3/i.test(text) ||
      (inspector?.terms || []).some((t, i, arr) => /household size|розмір/i.test(t.text) && arr[i + 1]?.text === '3'),
    maritalMarried: /marital status[\s\S]{0,40}married|сімейн[^\n]{0,40}одружен|\bmarried\b|одружен|заміжн/i.test(text),
    householdValueHits: [...new Set((text.match(new RegExp(HOUSEHOLD_VALUE_RE.source, 'gi')) || []).map(s => s.toLowerCase()))],
    statusBanners: await page.locator('[role="status"]').allTextContents().catch(() => []),
    alerts: await page.locator('[role="alert"]').allTextContents().catch(() => []),
    snapshot,
    visibleText,
    loading: await page
      .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
      .count(),
  };
}

function hasSavedHouseholdState(dump) {
  return Boolean(dump.householdComplete && dump.householdSize3 && dump.maritalMarried);
}

function classifyDestination(before, after, autoExec) {
  if (autoExec) {
    return 'automatic execution triggered';
  }
  if (!after) {
    return 'downstream consumption not confirmed';
  }
  const onBenefits = /benefits-simulator|benefits/i.test(after.url || '');
  const showsSize = after.householdSize3 || /\b3\b/.test(after.visibleText || '');
  const showsMarried = after.maritalMarried;
  const showsHouseholdTerms = (after.householdValueHits || []).length > 0;
  const explains = /benefit|допомог|simulator|симулятор|eligibility|право|household|домогосподар/i.test(
    after.visibleText || ''
  );

  if (onBenefits && (showsSize || showsMarried) && explains) {
    return 'downstream consumption confirmed';
  }
  if (onBenefits && !showsSize && !showsMarried && !showsHouseholdTerms) {
    return 'downstream flow disconnected';
  }
  if (onBenefits && showsHouseholdTerms && !(showsSize && showsMarried)) {
    return 'ambiguous';
  }
  if (!onBenefits) {
    return 'downstream flow disconnected';
  }
  return 'ambiguous';
}

function logDump(label, dump) {
  console.log('');
  console.log(`--- ${label} ---`);
  console.log('URL:', dump.url);
  console.log('TITLE:', dump.title);
  console.log('LANG:', dump.lang);
  console.log('HEADINGS:', dump.headings);
  console.log('GRAPH NODES:', dump.graphNodes);
  console.log('SELECTED:', dump.currentItems);
  console.log('INSPECTOR:', dump.inspector);
  console.log('LINKS:', dump.links);
  console.log('BUTTONS:', dump.buttons);
  console.log('INPUTS:', dump.inputs);
  console.log('FORM COUNT:', dump.formCount);
  console.log('BENEFITS LINKS:', dump.benefitsLinks);
  console.log('EXECUTION CTAs:', dump.executionCtAs.length ? dump.executionCtAs : 'None');
  console.log('HOUSEHOLD COMPLETE:', dump.householdComplete);
  console.log('HOUSEHOLD SIZE 3:', dump.householdSize3);
  console.log('MARITAL MARRIED:', dump.maritalMarried);
  console.log('HOUSEHOLD VALUE HITS:', dump.householdValueHits);
  console.log('LOADING:', dump.loading > 0 ? `YES (${dump.loading})` : 'None');
  console.log('ALERTS:', dump.alerts?.length ? dump.alerts : 'None');
  console.log('STATUS BANNERS:', dump.statusBanners?.length ? dump.statusBanners : 'None');
  console.log('MAIN VISIBLE TEXT (first 8000 chars):');
  console.log((dump.visibleText || '').slice(0, 8000));
  console.log('ACCESSIBILITY SNAPSHOT:');
  console.log(dump.snapshot);
}

async function settle() {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

try {
  console.log('NETWORK CAPTURE: started before onboarding');
  console.log('READ-ONLY STEP 51: Benefits Simulator downstream of saved household; no recreate/save/Discovery');

  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  console.log('SETUP: select Українська');
  await page.getByRole('button', { name: /Українська/i }).click();
  await page.waitForTimeout(500);
  console.log('SETUP: click Продовжити');
  await page.getByRole('button', { name: /Продовжити/i }).click();
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
  console.log('SETUP: click Що далі протягом 7 днів');
  await page.getByRole('button', { name: /Що далі протягом 7 днів/i }).click();
  await settle();
  console.log('SETUP: open Профіль');
  await page
    .getByRole('navigation', { name: /Основна навігація/i })
    .getByRole('link', { name: PROFILE_NAV_RE })
    .click({ timeout: 8000 });
  await page.waitForURL(/\/profile/, { timeout: 15000 }).catch(() => {});
  await settle();

  const welcome = page.getByRole('dialog');
  if (await welcome.first().isVisible().catch(() => false)) {
    console.log('SETUP: dismiss welcome via Досліджувати самостійно');
    await welcome.getByRole('button', { name: /Досліджувати самостійно/i }).click({ timeout: 8000 });
    await welcome.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    await settle();
  }

  const householdBtn = page.getByRole('button', { name: HOUSEHOLD_RE }).first();
  const householdVisible = await householdBtn.isVisible().catch(() => false);
  const householdDisabled =
    householdVisible &&
    ((await householdBtn.isDisabled().catch(() => false)) ||
      (await householdBtn.getAttribute('aria-disabled').catch(() => null)) === 'true');
  if (householdVisible && !householdDisabled) {
    console.log('SETUP: select Household & family (read-only confirm of saved state)');
    await householdBtn.click({ timeout: 8000 });
    await settle();
  } else {
    console.log('SETUP: Household & family not selectable without force');
  }

  phase = 'before-benefits';
  const before = await dumpUi();
  logDump('BEFORE BENEFITS OPEN (HOUSEHOLD INSPECTOR)', before);
  await page.screenshot({ path: `${OUT}/step-51-before-benefits.png`, fullPage: true });

  let after = null;
  let clickMode = 'skipped';
  let clickError = null;
  let classification = 'downstream consumption not confirmed';

  if (!hasSavedHouseholdState(before)) {
    stopReason =
      'STEP 51 could not verify Benefits Simulator downstream consumption because the previously saved Household & family state was not available through the normal user session.';
    console.log(stopReason);
    console.log('No recreate/inject performed. Benefits Simulator click skipped.');
    await page.screenshot({ path: `${OUT}/step-51-after-unavailable.png`, fullPage: true });
  } else {
    const benefitsHref = before.benefitsLinks[0]?.href || '/modules/benefits-simulator';
    const benefitsControl = page
      .locator(`a[href="${benefitsHref}"], a[href="/modules/benefits-simulator"]`)
      .filter({ hasText: BENEFITS_SIM_RE })
      .first();
    const benefitsVisible = await benefitsControl.isVisible().catch(() => false);
    console.log('BENEFITS CONTROL VISIBLE:', benefitsVisible ? 'YES' : 'NO');
    console.log('BENEFITS LINKS:', before.benefitsLinks);

    if (!benefitsVisible) {
      clickMode = 'not-found';
      classification = 'downstream flow disconnected';
      console.log('CLICK SKIPPED: Open Benefits Simulator not visible on Household inspector');
      await page.screenshot({ path: `${OUT}/step-51-after-no-cta.png`, fullPage: true });
    } else {
      console.log('ACTION: click Open Benefits Simulator once. No calculate/simulate/execute.');
      phase = 'after-benefits-open';
      try {
        await benefitsControl.click({ timeout: 8000 });
        clickMode = 'normal';
        await page.waitForURL(/benefits/i, { timeout: 15000 }).catch(() => {});
        await settle();
      } catch (error) {
        clickMode = 'failed';
        clickError = String(error.message || error).slice(0, 800);
        console.log('CLICK FAILED; force NOT used:', clickError);
      }

      after = await dumpUi();
      logDump('AFTER BENEFITS OPEN', after);
      await page.screenshot({ path: `${OUT}/step-51-after-benefits.png`, fullPage: true });

      if (autoExecutionDetected) {
        classification = 'automatic execution triggered';
        console.log('STOP: automatic execution/provider detected on open; no further action');
      } else {
        classification = classifyDestination(before, after, false);
      }
    }
  }

  await fs.writeFile(
    `${OUT}/step-51-benefits-downstream-network.json`,
    JSON.stringify(
      captured.map(e => ({
        ...e,
        requestPayload: redactSecrets(e.requestPayload),
        responseBody: redactSecrets(e.responseBody),
      })),
      null,
      2
    )
  );
  await fs.writeFile(
    `${OUT}/step-51-state-comparison.json`,
    JSON.stringify(
      {
        classification,
        savedHouseholdAvailable: hasSavedHouseholdState(before),
        autoExecutionDetected,
        clickMode,
        before: {
          url: before.url,
          lang: before.lang,
          householdComplete: before.householdComplete,
          householdSize3: before.householdSize3,
          maritalMarried: before.maritalMarried,
          inspector: before.inspector,
          benefitsLinks: before.benefitsLinks,
        },
        after: after
          ? {
              url: after.url,
              lang: after.lang,
              headings: after.headings,
              householdSize3: after.householdSize3,
              maritalMarried: after.maritalMarried,
              householdValueHits: after.householdValueHits,
              executionCtAs: after.executionCtAs,
              forms: after.formCount,
              inputs: after.inputs,
            }
          : null,
        stopReason,
      },
      null,
      2
    )
  );

  const afterNet = captured.filter(e => e.phase === 'after-benefits-open');
  const mutations = afterNet.filter(e => e.flags?.mutations);
  const writes = afterNet.filter(e => /POST|PUT|PATCH|DELETE/i.test(e.method));
  const executions = afterNet.filter(looksLikeExecution);
  const providers = afterNet.filter(looksLikeProvider);
  const unexpected = afterNet.filter(e => e.flags?.unexpectedWriteOrExecution);
  const discovery = afterNet.filter(e => e.flags?.discoveryRead);

  console.log('');
  console.log('--- STEP 51 COMPARISON ---');
  console.log('CLASSIFICATION:', classification);
  console.log('CLICK MODE:', clickMode);
  if (clickError) console.log('CLICK ERROR:', clickError);
  console.log('SAVED HOUSEHOLD AVAILABLE:', hasSavedHouseholdState(before) ? 'YES' : 'NO');
  console.log('AUTO EXECUTION ON OPEN:', autoExecutionDetected ? 'YES' : 'NO');
  console.log('AFTER-OPEN NETWORK:', afterNet.length ? summarizeNetwork(afterNet) : 'None');
  console.log('MUTATIONS:', mutations.length ? summarizeNetwork(mutations) : 'None');
  console.log('WRITES:', writes.length ? summarizeNetwork(writes) : 'None');
  console.log('DISCOVERY:', discovery.length ? summarizeNetwork(discovery) : 'None');
  console.log('EXECUTION/AI:', executions.length || providers.length ? summarizeNetwork([...executions, ...providers]) : 'None');
  console.log('UNEXPECTED WRITES:', unexpected.length ? summarizeNetwork(unexpected) : 'None');
  console.log(
    'CONSOLE ERRORS:',
    consoleErrors.filter(e => e.phase === 'after-benefits-open' || e.phase === 'before-benefits').length
      ? consoleErrors.filter(e => e.phase === 'after-benefits-open' || e.phase === 'before-benefits')
      : 'None'
  );
  console.log(
    'PAGE ERRORS:',
    pageErrors.filter(e => e.phase === 'after-benefits-open' || e.phase === 'before-benefits').length
      ? pageErrors.filter(e => e.phase === 'after-benefits-open' || e.phase === 'before-benefits')
      : 'None'
  );
  console.log(
    'REQUEST FAILURES:',
    requestFailures.filter(e => e.phase === 'after-benefits-open' || e.phase === 'before-benefits').length
      ? requestFailures.filter(e => e.phase === 'after-benefits-open' || e.phase === 'before-benefits')
      : 'None'
  );
  if (stopReason) console.log('STOP REASON:', stopReason);

  console.log('');
  console.log('========================================');
  console.log('STEP 51 SUMMARY');
  console.log('========================================');
  console.log('STEP: 51');
  console.log('classification:', classification);
  console.log('before household:', {
    complete: before.householdComplete,
    size3: before.householdSize3,
    married: before.maritalMarried,
    benefitsLinks: before.benefitsLinks,
  });
  console.log('after:', after ? { url: after.url, lang: after.lang, headings: after.headings } : 'n/a');
  if (!hasSavedHouseholdState(before)) {
    console.log(
      'STEP 51 could not verify Benefits Simulator downstream consumption because the previously saved Household & family state was not available through the normal user session.'
    );
  }
  console.log('STEP 51 performed no intentional profile modification and no Discovery execution.');
  console.log('artifact paths:');
  console.log(`  ${OUT}/step-51-before-benefits.png`);
  console.log(
    hasSavedHouseholdState(before) && after
      ? `  ${OUT}/step-51-after-benefits.png`
      : `  ${OUT}/step-51-after-unavailable.png`
  );
  console.log(`  ${OUT}/step-51-benefits-downstream-network.json`);
  console.log(`  ${OUT}/step-51-state-comparison.json`);
} finally {
  await browser.close();
}
