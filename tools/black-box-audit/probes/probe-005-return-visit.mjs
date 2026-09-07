import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE_URL = 'https://arrival-atlas.pro';
const OUT = 'tools/black-box-audit/artifacts/probe-005';
const PROFILE_NAV_RE = /Профіль|Профиль|Profile/i;
const HOUSEHOLD_RE = /Household\s*&\s*family|Сім[ʼ'’']я та домогосподарство/i;
const WORK_INCOME_RE = /Work\s*&\s*income|Робота та дохід/i;
const LANGUAGE_RE = /Language\s*&\s*display|Мова та відображення/i;
const WHERE_LIVE_RE = /Where you live|Де ви живете/i;
const BENEFITS_RE = /Benefits\s*&\s*support|Допомог/i;
const SITUATION_RE = /Your situation|Ваша ситуація/i;
const ATLAS_HOME_RE = /Досліджувати Atlas|Explore Atlas/i;

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
  return /\/execute|\/run(?!-summary)|\/generate|openai|anthropic|\/ai\/|prompt|generation/i.test(blob);
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
    pageNavigation: /GET/i.test(entry.method) && /\/(modules|profile)|^https:\/\/arrival-atlas\.pro\/?(\?|$)/i.test(entry.url) && !/\/api\//.test(entry.url),
    profileRead: /GET/i.test(entry.method) && /\/api\/(user-context|profile-insights|ui-snapshot|profile)/i.test(entry.url),
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
    /\/api\/|\/modules\/|_rsc|rsc=|mutation|execute|\/run|ui-snapshot|user-context|profile|household|openai|anthropic|\/ai\//i.test(
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
  if (phase === 'return-visit' && isUnexpectedWriteOrExecution(entry)) {
    stopReason = `Unexpected write/execution: ${method} ${url} status=${response.status()}`;
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

function isUiDisabled(control) {
  if (!control) {
    return null;
  }
  return Boolean(control.disabled) || control.ariaDisabled === 'true';
}

function findNode(nodes, re) {
  return (nodes || []).find(n => re.test(n.text || '')) || null;
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
    const actions = [...root.querySelectorAll('a, button')].map(el => ({
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
  return {
    url: page.url(),
    title: await page.title(),
    lang: await page.locator('html').getAttribute('lang'),
    headings,
    buttons,
    links,
    graphNodes,
    inspector,
    currentItems,
    householdNode: findNode(graphNodes, HOUSEHOLD_RE),
    workIncomeNode: findNode(graphNodes, WORK_INCOME_RE),
    languageNode: findNode(graphNodes, LANGUAGE_RE),
    whereYouLiveNode: findNode(graphNodes, WHERE_LIVE_RE),
    benefitsNode: findNode(graphNodes, BENEFITS_RE),
    situationNode: findNode(graphNodes, SITUATION_RE),
    householdComplete: /household\s*&\s*family[\s\S]{0,40}complete|\bcomplete\b/i.test(
      `${findNode(graphNodes, HOUSEHOLD_RE)?.text || ''} ${inspector?.title === 'Household & family' ? inspector?.statusParagraph || '' : ''}`
    ),
    householdSize3:
      /household size[\s\S]{0,40}\b3\b|розмір домогосподарства[\s\S]{0,40}\b3\b|household of 3/i.test(text) ||
      (inspector?.terms || []).some((t, i, arr) => /household size|розмір/i.test(t.text) && arr[i + 1]?.text === '3'),
    maritalMarried: /marital status[\s\S]{0,40}married|сімейн[^\n]{0,40}одружен|одружен|заміжн|\bmarried\b/i.test(text),
    ukrainianSelected: /ukrainian|українськ/i.test(text),
    statusBanners: await page.locator('[role="status"]').allTextContents().catch(() => []),
    alerts: await page.locator('[role="alert"]').allTextContents().catch(() => []),
    snapshot,
    visibleText,
    loading: await page
      .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
      .count(),
  };
}

function hasReturningHouseholdState(dump) {
  const node = dump.householdNode;
  if (!node) {
    return false;
  }
  const nodeLooksComplete = /complete/i.test(node.text || '');
  const inspectorLooksComplete =
    /household/i.test(dump.inspector?.title || '') && /complete/i.test(dump.inspector?.statusParagraph || '');
  const hasValues = dump.householdSize3 && dump.maritalMarried;
  return Boolean((nodeLooksComplete || inspectorLooksComplete) && hasValues);
}

function summarizeProfileState(dump) {
  return {
    url: dump.url,
    lang: dump.lang,
    selected: dump.currentItems,
    situation: dump.situationNode,
    workIncome: {
      node: dump.workIncomeNode,
      disabled: isUiDisabled(dump.workIncomeNode),
    },
    language: dump.languageNode,
    whereYouLive: dump.whereYouLiveNode,
    household: {
      node: dump.householdNode,
      completeVisible: /complete/i.test(dump.householdNode?.text || '') || /complete/i.test(dump.inspector?.statusParagraph || ''),
      size3: dump.householdSize3,
      married: dump.maritalMarried,
      inspector: dump.inspector && HOUSEHOLD_RE.test(dump.inspector.title || '') ? dump.inspector : null,
    },
    benefits: dump.benefitsNode,
    graphNodes: dump.graphNodes,
    statusBanners: dump.statusBanners,
  };
}

async function settle() {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

try {
  console.log('NETWORK CAPTURE: started before onboarding');
  console.log('READ-ONLY STEP 49: return-visit persistence; no new profile mutation; no Discovery');

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

  // Prefer selecting Household & family if enabled, to reveal saved values without editing.
  const householdBtn = page.getByRole('button', { name: HOUSEHOLD_RE }).first();
  const householdVisible = await householdBtn.isVisible().catch(() => false);
  const householdDisabled =
    householdVisible &&
    ((await householdBtn.isDisabled().catch(() => false)) ||
      (await householdBtn.getAttribute('aria-disabled').catch(() => null)) === 'true');
  if (householdVisible && !householdDisabled) {
    console.log('SETUP: select Household & family once (read-only inspection of saved values)');
    await householdBtn.click({ timeout: 8000 });
    await settle();
  } else {
    console.log('SETUP: Household & family not selectable without force:', {
      visible: householdVisible,
      disabled: householdDisabled,
    });
  }

  phase = 'before-return';
  const before = await dumpUi();
  console.log('');
  console.log('--- BEFORE RETURN VISIT ---');
  console.log('URL:', before.url);
  console.log('TITLE:', before.title);
  console.log('LANG:', before.lang);
  console.log('GRAPH NODES:', before.graphNodes);
  console.log('SELECTED:', before.currentItems);
  console.log('INSPECTOR:', before.inspector);
  console.log('PROFILE STATE SUMMARY:', summarizeProfileState(before));
  console.log('RETURNING HOUSEHOLD STATE PRESENT:', hasReturningHouseholdState(before) ? 'YES' : 'NO');
  console.log('MAIN VISIBLE TEXT (first 6000 chars):');
  console.log((before.visibleText || '').slice(0, 6000));
  console.log('ACCESSIBILITY SNAPSHOT:');
  console.log(before.snapshot);
  await page.screenshot({ path: `${OUT}/step-49-before-return.png`, fullPage: true });

  let classification = 'persistent state not confirmed';
  let after = null;
  let returnClickMode = 'skipped';
  let returnClickError = null;

  if (!hasReturningHouseholdState(before)) {
    classification = 'persistent state not confirmed';
    stopReason =
      'STEP 49 could not verify return-visit persistence because the previously saved user state was not available through the normal user session.';
    console.log(stopReason);
    console.log('No storageState/credentials reuse available from STEP 45; fresh context starts a new session.');
    console.log('Return-visit leave/return NOT performed — would not test previously saved state.');
    await page.screenshot({ path: `${OUT}/step-49-after-unavailable.png`, fullPage: true });
  } else {
    console.log('Returning Household & family state available. Performing leave Profile → Atlas home → Profile.');
    phase = 'return-visit';
    try {
      console.log('ACTION 1: leave Profile via Досліджувати Atlas');
      await page
        .getByRole('navigation', { name: /Основна навігація/i })
        .getByRole('link', { name: ATLAS_HOME_RE })
        .click({ timeout: 8000 });
      await page.waitForURL(url => !/\/profile/i.test(url.pathname) || url.pathname === '/', { timeout: 15000 }).catch(() => {});
      await settle();
      console.log('ACTION 2: return to Профіль');
      await page
        .getByRole('navigation', { name: /Основна навігація/i })
        .getByRole('link', { name: PROFILE_NAV_RE })
        .click({ timeout: 8000 });
      await page.waitForURL(/\/profile/, { timeout: 15000 }).catch(() => {});
      await settle();
      const welcome2 = page.getByRole('dialog');
      if (await welcome2.first().isVisible().catch(() => false)) {
        console.log('Return visit: welcome dialog visible — leave untouched (no dismiss that mutates intent)');
      }
      const householdBtn2 = page.getByRole('button', { name: HOUSEHOLD_RE }).first();
      if (
        (await householdBtn2.isVisible().catch(() => false)) &&
        !(await householdBtn2.isDisabled().catch(() => false)) &&
        (await householdBtn2.getAttribute('aria-disabled').catch(() => null)) !== 'true'
      ) {
        await householdBtn2.click({ timeout: 8000 });
        await settle();
      }
      returnClickMode = 'normal';
    } catch (error) {
      returnClickMode = 'failed';
      returnClickError = String(error.message || error).slice(0, 800);
      console.log('RETURN NAV FAILED; force NOT used:', returnClickError);
    }

    after = await dumpUi();
    console.log('');
    console.log('--- AFTER RETURN VISIT ---');
    console.log('URL:', after.url);
    console.log('TITLE:', after.title);
    console.log('LANG:', after.lang);
    console.log('GRAPH NODES:', after.graphNodes);
    console.log('SELECTED:', after.currentItems);
    console.log('INSPECTOR:', after.inspector);
    console.log('PROFILE STATE SUMMARY:', summarizeProfileState(after));
    console.log('MAIN VISIBLE TEXT (first 6000 chars):');
    console.log((after.visibleText || '').slice(0, 6000));
    console.log('ACCESSIBILITY SNAPSHOT:');
    console.log(after.snapshot);
    await page.screenshot({ path: `${OUT}/step-49-after-return.png`, fullPage: true });

    const langOk = after.lang === 'uk' && before.lang === 'uk';
    const householdStillComplete =
      /complete/i.test(after.householdNode?.text || '') ||
      (/household/i.test(after.inspector?.title || '') && /complete/i.test(after.inspector?.statusParagraph || ''));
    const valuesStillVisible = after.householdSize3 && after.maritalMarried;
    const workStillDisabled = isUiDisabled(after.workIncomeNode) === true;
    const reset =
      (/not added yet/i.test(after.householdNode?.text || '') && /complete/i.test(before.householdNode?.text || '')) ||
      (before.householdSize3 && !after.householdSize3) ||
      (before.maritalMarried && !after.maritalMarried);

    if (reset) {
      classification = 'state unexpectedly reset';
    } else if (langOk && householdStillComplete && valuesStillVisible && workStillDisabled) {
      classification = 'persistent state confirmed';
    } else if (householdStillComplete || valuesStillVisible) {
      classification = 'ambiguous';
    } else {
      classification = 'persistent state not confirmed';
    }

    console.log('COMPARISON:', {
      langBefore: before.lang,
      langAfter: after.lang,
      ukrainianBefore: before.ukrainianSelected,
      ukrainianAfter: after.ukrainianSelected,
      householdCompleteBefore: /complete/i.test(before.householdNode?.text || ''),
      householdCompleteAfter: householdStillComplete,
      size3Before: before.householdSize3,
      size3After: after.householdSize3,
      marriedBefore: before.maritalMarried,
      marriedAfter: after.maritalMarried,
      workDisabledBefore: isUiDisabled(before.workIncomeNode),
      workDisabledAfter: isUiDisabled(after.workIncomeNode),
      selectedBefore: before.currentItems,
      selectedAfter: after.currentItems,
    });
  }

  await fs.writeFile(
    `${OUT}/step-49-return-visit-network.json`,
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
    `${OUT}/step-49-state-comparison.json`,
    JSON.stringify(
      {
        classification,
        returningStateAvailable: hasReturningHouseholdState(before),
        before: summarizeProfileState(before),
        after: after ? summarizeProfileState(after) : null,
        stopReason,
      },
      null,
      2
    )
  );

  const returnNet = captured.filter(e => e.phase === 'return-visit');
  const mutations = returnNet.filter(e => e.flags?.mutations);
  const writes = returnNet.filter(e => /POST|PUT|PATCH|DELETE/i.test(e.method));
  const executions = returnNet.filter(looksLikeExecution);
  const providers = returnNet.filter(looksLikeProvider);
  const unexpected = returnNet.filter(e => e.flags?.unexpectedWriteOrExecution);
  const reads = returnNet.filter(e => /GET/i.test(e.method));

  console.log('');
  console.log('--- STEP 49 COMPARISON ---');
  console.log('CLASSIFICATION:', classification);
  console.log('RETURN CLICK MODE:', returnClickMode);
  if (returnClickError) console.log('RETURN CLICK ERROR:', returnClickError);
  console.log('RETURNING STATE AVAILABLE:', hasReturningHouseholdState(before) ? 'YES' : 'NO');
  console.log('RETURN NETWORK:', returnNet.length ? summarizeNetwork(returnNet) : 'None');
  console.log('READS:', reads.length);
  console.log('MUTATIONS:', mutations.length ? summarizeNetwork(mutations) : 'None');
  console.log('WRITES:', writes.length ? summarizeNetwork(writes) : 'None');
  console.log('EXECUTION/AI:', executions.length || providers.length ? 'YES' : 'None');
  console.log('UNEXPECTED WRITES:', unexpected.length ? summarizeNetwork(unexpected) : 'None');
  console.log(
    'CONSOLE ERRORS:',
    consoleErrors.filter(e => e.phase === 'return-visit' || e.phase === 'before-return').length
      ? consoleErrors.filter(e => e.phase === 'return-visit' || e.phase === 'before-return')
      : 'None'
  );
  console.log(
    'PAGE ERRORS:',
    pageErrors.filter(e => e.phase === 'return-visit' || e.phase === 'before-return').length
      ? pageErrors.filter(e => e.phase === 'return-visit' || e.phase === 'before-return')
      : 'None'
  );
  console.log(
    'REQUEST FAILURES:',
    requestFailures.filter(e => e.phase === 'return-visit' || e.phase === 'before-return').length
      ? requestFailures.filter(e => e.phase === 'return-visit' || e.phase === 'before-return')
      : 'None'
  );
  if (stopReason) console.log('STOP REASON:', stopReason);

  console.log('');
  console.log('========================================');
  console.log('STEP 49 SUMMARY');
  console.log('========================================');
  console.log('STEP: 49');
  console.log('classification:', classification);
  console.log('before:', summarizeProfileState(before));
  console.log('after:', after ? summarizeProfileState(after) : 'n/a — return visit not performed');
  if (!hasReturningHouseholdState(before)) {
    console.log(
      'STEP 49 could not verify return-visit persistence because the previously saved user state was not available through the normal user session.'
    );
  }
  console.log('STEP 49 performed no intentional profile modification and no Discovery execution.');
  console.log('artifact paths:');
  console.log(`  ${OUT}/step-49-before-return.png`);
  console.log(
    hasReturningHouseholdState(before)
      ? `  ${OUT}/step-49-after-return.png`
      : `  ${OUT}/step-49-after-unavailable.png`
  );
  console.log(`  ${OUT}/step-49-return-visit-network.json`);
  console.log(`  ${OUT}/step-49-state-comparison.json`);
} finally {
  await browser.close();
}
