import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE_URL = 'https://arrival-atlas.pro';
const OUT = 'tools/black-box-audit/artifacts/probe-004';
const PROFILE_NAV_RE = /Профіль|Профиль|Profile/i;
const HOUSEHOLD_SECTION_RE = /Household & family|Сім[ʼ'’']я та домогосподарство/i;
const SHOW_FULL_RE = /Показати весь розділ/i;
const FAMILY_RE =
  /family|families|partner|spouse|ehepartner|child(?:ren)?|household|familie|kinder|haushalt|сім[ʼ'’']?я|родин|партнер|дитин|діте|подружж|чоловік|дружин|батьк|домогосподар|сімейн/i;

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
    pageNavigation: /GET/i.test(entry.method) && /\/(modules|profile)/i.test(entry.url) && !/\/api\//.test(entry.url),
    documentNav: /GET/i.test(entry.method) && /document/i.test(entry.resourceType || ''),
    profileRead: /GET/i.test(entry.method) && /\/api\/(user-context|profile-insights|ui-snapshot|profile)/i.test(entry.url),
    mutations: /\/api\/mutations/i.test(entry.url),
    writeMethod: /POST|PUT|PATCH|DELETE/i.test(entry.method),
    execute: /\/execute/i.test(entry.url),
    executionLike: looksLikeExecution(entry),
    providerLike: looksLikeProvider(entry),
    householdFamilyPath: /household-family/i.test(entry.url),
    editPath: /\/edit(\?|$)/i.test(entry.url),
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
  if (phase === 'after-full-section-click' && isUnexpectedWriteOrExecution(entry)) {
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

async function dumpUi() {
  const headings = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll(
    els => els.map(e => ({ tag: e.tagName, text: e.textContent.trim() }))
  );
  const buttons = await page.getByRole('button').evaluateAll(els =>
    els.map(el => ({
      text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
      type: el.getAttribute('type'),
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
      ariaLabel: el.getAttribute('aria-label'),
    }))
  );
  const inputs = await page.locator('input, select, textarea').evaluateAll(els =>
    els.map(el => ({
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type'),
      id: el.id || null,
      label: el.getAttribute('aria-label') || el.id,
      value: 'value' in el ? String(el.value).slice(0, 120) : null,
      visible: el.offsetParent !== null || el.getClientRects().length > 0,
    }))
  );
  const snapshot = await page.locator('body').ariaSnapshot();
  const visibleText = await page.locator('body').innerText();
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
  return {
    url: page.url(),
    title: await page.title(),
    lang: await page.locator('html').getAttribute('lang'),
    headings,
    buttons,
    links,
    inputs,
    formCount: await page.locator('form').count(),
    currentItems,
    householdBtn: buttons.find(b => HOUSEHOLD_SECTION_RE.test(`${b.text} ${b.ariaLabel || ''}`)),
    showFullLink: links.find(l => SHOW_FULL_RE.test(l.text) || /\/profile\/household-family\/?$/.test(l.href || '')),
    editLinks: links.filter(l => /редагув|edit/i.test(`${l.text} ${l.href || ''}`)),
    familyHits: [...new Set((visibleText.match(new RegExp(FAMILY_RE.source, 'gi')) || []).map(s => s.toLowerCase()))],
    statusBanners: await page.locator('[role="status"]').allTextContents().catch(() => []),
    alerts: await page.locator('[role="alert"]').allTextContents().catch(() => []),
    snapshot,
    visibleText,
    loading: await page
      .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
      .count(),
  };
}

function logDump(label, dump) {
  console.log('');
  console.log(`--- ${label} ---`);
  console.log('URL:', dump.url);
  console.log('TITLE:', dump.title);
  console.log('LANG:', dump.lang);
  console.log('HEADINGS:', dump.headings);
  console.log('BUTTONS:', dump.buttons);
  console.log('LINKS:', dump.links);
  console.log('INPUTS:', dump.inputs);
  console.log('FORM COUNT:', dump.formCount);
  console.log('CURRENT/SELECTED:', dump.currentItems);
  console.log('HOUSEHOLD CONTROL:', dump.householdBtn || 'not found');
  console.log('SHOW FULL LINK:', dump.showFullLink || 'not found');
  console.log('EDIT LINKS:', dump.editLinks.length ? dump.editLinks : 'None');
  console.log('FAMILY TERM HITS:', dump.familyHits.length ? dump.familyHits : 'None');
  console.log('LOADING:', dump.loading > 0 ? `YES (${dump.loading})` : 'None');
  console.log('ALERTS:', dump.alerts.length ? dump.alerts : 'None');
  console.log('MAIN VISIBLE TEXT (first 8000 chars):');
  console.log((dump.visibleText || '').slice(0, 8000));
  console.log('ACCESSIBILITY SNAPSHOT:');
  console.log(dump.snapshot);
}

function classifyFullSection(before, after) {
  const url = after.url || '';
  const text = after.visibleText || '';
  const onFull = /\/profile\/household-family\/?(\?|$)/i.test(url) && !/\/edit/i.test(url);
  const hasForm = after.formCount > 0 || (after.inputs || []).some(i => i.visible && i.type !== 'hidden');
  if (/\/edit/i.test(url)) {
    return 'something else: landed on edit route';
  }
  if (hasForm) {
    return 'something else: destination contains a form';
  }
  const inspectorBits = /not added yet|no household details yet|household size affects/i.test(before.visibleText || '');
  const sameStatus = /not added yet|no household details yet/i.test(text);
  const moreHeadings = (after.headings || []).length > (before.headings || []).length;
  if (onFull && sameStatus && !moreHeadings) {
    return 'empty-state full section that largely duplicates the inspector';
  }
  if (onFull && /household size|marital|сімейн|розмір/i.test(text) && !sameStatus) {
    return 'richer summary than the inspector';
  }
  if (onFull && sameStatus) {
    return 'empty-state dedicated section page (read-only summary)';
  }
  if (onFull) {
    return 'read-only section page';
  }
  return 'something else — see after evidence';
}

async function settle() {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

try {
  console.log('NETWORK CAPTURE: started before onboarding');
  console.log('READ-ONLY STEP 44: click Показати весь розділ; no edit/save/simulator');

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

  console.log('SETUP: click Household & family');
  await page.getByRole('button', { name: HOUSEHOLD_SECTION_RE }).first().click({ timeout: 8000 });
  await settle();
  await page.getByRole('link', { name: SHOW_FULL_RE }).waitFor({ state: 'visible', timeout: 10000 });

  phase = 'before-full-section-click';
  const before = await dumpUi();
  logDump('BEFORE SHOW FULL SECTION (INSPECTOR)', before);
  await page.screenshot({ path: `${OUT}/step-44-before-household-full.png`, fullPage: true });

  const fullLink = page.locator('a[href="/profile/household-family"]');
  const fullVisible = await fullLink.first().isVisible().catch(() => false);
  console.log('SHOW FULL LINK VISIBLE:', fullVisible ? 'YES' : 'NO');

  let clickMode = 'skipped';
  let clickError = null;
  if (!fullVisible) {
    console.log('CLICK SKIPPED: Показати весь розділ not visible');
  } else {
    console.log('ACTION: click Показати весь розділ once. No edit. No simulator.');
    phase = 'after-full-section-click';
    try {
      await fullLink.first().click({ timeout: 8000 });
      clickMode = 'normal';
      await page.waitForURL(/\/profile\/household-family\/?$/, { timeout: 15000 }).catch(() => {});
      await settle();
    } catch (error) {
      clickMode = 'failed';
      clickError = String(error.message || error).slice(0, 800);
      console.log('CLICK FAILED; force NOT used:', clickError);
    }
  }

  const after = await dumpUi();
  logDump('AFTER SHOW FULL SECTION', after);
  await page.screenshot({ path: `${OUT}/step-44-after-household-full.png`, fullPage: true });
  await fs.writeFile(
    `${OUT}/step-44-household-full-network.json`,
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

  const afterNet = captured.filter(e => e.phase === 'after-full-section-click');
  const reads = afterNet.filter(e => /GET/i.test(e.method));
  const writes = afterNet.filter(e => /POST|PUT|PATCH|DELETE/i.test(e.method));
  const mutations = afterNet.filter(e => e.flags?.mutations);
  const executions = afterNet.filter(looksLikeExecution);
  const providers = afterNet.filter(looksLikeProvider);
  const unexpected = afterNet.filter(e => e.flags?.unexpectedWriteOrExecution);
  const rsc = afterNet.filter(e => e.flags?.rsc);
  const urlChanged = before.url !== after.url;
  const onEdit = /\/edit/i.test(after.url);
  const blob = after.visibleText || '';
  const classification = classifyFullSection(before, after);

  console.log('');
  console.log('--- STEP 44 COMPARISON ---');
  console.log('CLICK MODE:', clickMode);
  if (clickError) console.log('CLICK ERROR:', clickError);
  console.log('URL BEFORE:', before.url);
  console.log('URL AFTER:', after.url);
  console.log('NAVIGATION:', urlChanged ? 'YES' : 'NO');
  console.log('LANDED ON EDIT:', onEdit ? 'YES' : 'NO');
  console.log('CLASSIFICATION:', classification);
  console.log('AFTER-CLICK NETWORK:', afterNet.length ? summarizeNetwork(afterNet) : 'None');
  console.log(
    'CONSOLE ERRORS AFTER:',
    consoleErrors.filter(e => e.phase === 'after-full-section-click').length
      ? consoleErrors.filter(e => e.phase === 'after-full-section-click')
      : 'None'
  );
  console.log(
    'PAGE ERRORS AFTER:',
    pageErrors.filter(e => e.phase === 'after-full-section-click').length
      ? pageErrors.filter(e => e.phase === 'after-full-section-click')
      : 'None'
  );
  console.log(
    'REQUEST FAILURES AFTER:',
    requestFailures.filter(e => e.phase === 'after-full-section-click').length
      ? requestFailures.filter(e => e.phase === 'after-full-section-click')
      : 'None'
  );
  if (stopReason) console.log('STOP REASON:', stopReason);

  console.log('');
  console.log('========================================');
  console.log('STEP 44 SUMMARY');
  console.log('========================================');
  console.log('STEP: 44');
  console.log('classification:', classification);
  console.log('click mode:', clickMode);
  console.log('URL before:', before.url);
  console.log('URL after:', after.url);
  console.log('navigation:', urlChanged ? 'yes' : 'no');
  console.log('lang:', after.lang);
  console.log('forms/inputs:', { forms: after.formCount, inputs: after.inputs });
  console.log('edit available:', after.editLinks.length ? after.editLinks : 'None');
  console.log('household size in text:', /розмір домогосподарства|household size/i.test(blob));
  console.log('marital status in text:', /сімейн(ий)? стан|marital/i.test(blob));
  console.log('partner in text:', /партнер|partner|hasPartner/i.test(blob));
  console.log('children in text:', /діт|дитин|children/i.test(blob));
  console.log('reads after click:', reads.length);
  console.log('rsc after click:', rsc.length);
  console.log('mutations after click:', mutations.length ? summarizeNetwork(mutations) : 'None');
  console.log('writes after click:', writes.length ? summarizeNetwork(writes) : 'None');
  console.log('execution/AI after click:', executions.length || providers.length ? 'YES' : 'None');
  console.log('unexpected writes after click:', unexpected.length ? summarizeNetwork(unexpected) : 'None');
  console.log('STEP 44 performed no intentional profile modification and no Discovery execution.');
  console.log('artifact paths:');
  console.log(`  ${OUT}/step-44-before-household-full.png`);
  console.log(`  ${OUT}/step-44-after-household-full.png`);
  console.log(`  ${OUT}/step-44-household-full-network.json`);
} finally {
  await browser.close();
}
