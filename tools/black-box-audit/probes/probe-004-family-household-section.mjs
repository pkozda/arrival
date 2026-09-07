import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE_URL = 'https://arrival-atlas.pro';
const OUT = 'tools/black-box-audit/artifacts/probe-004';
const PROFILE_NAV_RE = /Профіль|Профиль|Profile/i;
const HOUSEHOLD_SECTION_RE = /Household & family|Сім[ʼ'’']я та домогосподарство/i;
const EDIT_RE = /редагув|виправити|изменить|edit section|edit/i;
const MUTATION_CTA_RE =
  /виправити дані|редагув|змінити|изменить|edit|зберег|сохран|save|створ|создать|create|видал|удал|remove|delete|запусти|execute|submit|надіслати|отправить/i;
const FAMILY_RE =
  /family|families|partner|spouse|ehepartner|child(?:ren)?|household|familie|kinder|haushalt|сім[ʼ'’']?я|родин|партнер|дитин|діте|подружж|чоловік|дружин|батьк|домогосподар/i;

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
    profileRead: /GET/i.test(entry.method) && /\/api\/(user-context|profile-insights|ui-snapshot|profile)/i.test(entry.url),
    mutations: /\/api\/mutations/i.test(entry.url),
    writeMethod: /POST|PUT|PATCH|DELETE/i.test(entry.method),
    execute: /\/execute/i.test(entry.url),
    executionLike: looksLikeExecution(entry),
    providerLike: looksLikeProvider(entry),
    householdFamilyPath: /household-family/i.test(entry.url),
    editPath: /\/edit(\?|$)/i.test(entry.url),
    unexpectedWriteOrExecution: isUnexpectedWriteOrExecution(entry),
  };
}

async function recordResponse(response) {
  const request = response.request();
  const url = safeUrl(response.url());
  const method = request.method();
  const host = hostnameOf(url);
  const resourceType = request.resourceType();
  const isApp = /arrival-atlas\.pro$/i.test(host || '');
  const interesting =
    /\/api\/|\/modules\/|_rsc|rsc=|mutation|execute|\/run|ui-snapshot|user-context|profile|household|openai|anthropic|\/ai\//i.test(
      `${method} ${url}`
    ) ||
    looksLikeProvider({ url }) ||
    ((/POST|PUT|PATCH|DELETE/i.test(method)) && /xhr|fetch|document/i.test(resourceType));
  if (!interesting && isApp && resourceType !== 'fetch' && resourceType !== 'xhr' && resourceType !== 'document') {
    return;
  }
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
  if (phase === 'after-household-click' && isUnexpectedWriteOrExecution(entry)) {
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
    url: entry.url,
    flags: entry.flags,
    requestPayload: entry.requestPayload,
  }));
}

function extractFamilyFields(value, acc = [], path = '') {
  if (value == null) {
    return acc;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => extractFamilyFields(item, acc, `${path}[${i}]`));
    return acc;
  }
  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const next = path ? `${path}.${key}` : key;
      if (/partner|child|children|household|family|hasPartner|hasChildren|spouse/i.test(key)) {
        acc.push({ path: next, value: child });
      } else if (typeof child === 'object') {
        extractFamilyFields(child, acc, next);
      }
    }
  }
  return acc;
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
      pressed: el.getAttribute('aria-pressed'),
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
      name: el.getAttribute('name'),
      value: 'value' in el ? String(el.value).slice(0, 120) : null,
      placeholder: el.getAttribute('placeholder'),
      disabled: el.disabled,
      required: el.required,
      visible: el.offsetParent !== null,
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
  const householdBtn = buttons.find(b => HOUSEHOLD_SECTION_RE.test(`${b.text} ${b.ariaLabel || ''}`));
  const editLinks = links.filter(l => EDIT_RE.test(`${l.text} ${l.ariaLabel || ''} ${l.href || ''}`));
  const editBtns = buttons.filter(b => EDIT_RE.test(`${b.text} ${b.ariaLabel || ''}`));
  const dialogVisible = await page.getByRole('dialog').first().isVisible().catch(() => false);
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
    householdBtn,
    editLinks,
    editBtns,
    mutationCtas: buttons.filter(b => MUTATION_CTA_RE.test(`${b.text} ${b.ariaLabel || ''}`)),
    familyHits: [...new Set((visibleText.match(new RegExp(FAMILY_RE.source, 'gi')) || []).map(s => s.toLowerCase()))],
    dialogVisible,
    dialogText: dialogVisible
      ? ((await page.getByRole('dialog').first().innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim().slice(0, 800)
      : null,
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
  console.log('HOUSEHOLD SECTION CONTROL:', dump.householdBtn || 'not found');
  console.log('EDIT LINKS:', dump.editLinks.length ? dump.editLinks : 'None');
  console.log('EDIT BUTTONS:', dump.editBtns.length ? dump.editBtns : 'None');
  console.log('MUTATION CTAs:', dump.mutationCtas.length ? dump.mutationCtas : 'None');
  console.log('FAMILY TERM HITS:', dump.familyHits.length ? dump.familyHits : 'None');
  console.log('DIALOG:', dump.dialogVisible ? dump.dialogText : 'not visible');
  console.log('LOADING:', dump.loading > 0 ? `YES (${dump.loading})` : 'None');
  console.log('ALERTS:', dump.alerts.length ? dump.alerts : 'None');
  console.log('MAIN VISIBLE TEXT (first 8000 chars):');
  console.log((dump.visibleText || '').slice(0, 8000));
  console.log('ACCESSIBILITY SNAPSHOT:');
  console.log(dump.snapshot);
}

function classifySurface(dump) {
  const url = dump.url || '';
  const text = dump.visibleText || '';
  if (/\/profile\/household-family\/edit/i.test(url)) {
    return 'e) editing form (URL is household-family/edit)';
  }
  const visibleInputs = (dump.inputs || []).filter(i => i.visible && i.type !== 'hidden');
  if (dump.formCount > 0 && visibleInputs.length > 0) {
    return 'e) editing form';
  }
  if (/nothing saved|no information saved|incomplete|немає збереж|неповн/i.test(text) && HOUSEHOLD_SECTION_RE.test(text)) {
    return 'b) empty state';
  }
  if ((dump.editLinks.length || dump.editBtns.length) && /complete|confidence|context|unlocks/i.test(text)) {
    return 'a) read-only summary / inspector-style details with edit affordance';
  }
  if (/complete|confidence|context|unlocks|blocked|actions/i.test(text) && HOUSEHOLD_SECTION_RE.test(text)) {
    return 'c) inspector/details surface';
  }
  if (/\/profile\/household-family\/?(\?|$)/i.test(url) && !/\/edit/i.test(url)) {
    return 'c) inspector/details surface or d) navigation entry point';
  }
  return 'f) something else — see after evidence';
}

async function settle() {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

try {
  console.log('NETWORK CAPTURE: started before onboarding');
  console.log('READ-ONLY STEP 42: one click Household & family; no edit/save/execute');

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
    console.log('SETUP: welcome dialog visible — click Досліджувати самостійно so Profile is actionable');
    const explore = welcome.getByRole('button', { name: /Досліджувати самостійно/i });
    if (await explore.isVisible().catch(() => false)) {
      await explore.click({ timeout: 8000 });
      await welcome.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
      await settle();
    }
  }

  phase = 'before-household-click';
  const before = await dumpUi();
  logDump('BEFORE HOUSEHOLD & FAMILY CLICK', before);
  await page.screenshot({ path: `${OUT}/step-42-before-household-family.png`, fullPage: true });

  const sectionBtn = page.getByRole('button', { name: HOUSEHOLD_SECTION_RE });
  const sectionVisible = await sectionBtn.first().isVisible().catch(() => false);
  console.log('HOUSEHOLD SECTION VISIBLE:', sectionVisible ? 'YES' : 'NO');

  let clickMode = 'skipped';
  let clickError = null;
  if (stopReason) {
    console.log('CLICK SKIPPED:', stopReason);
  } else if (!sectionVisible) {
    console.log('CLICK SKIPPED: Household & family control not visible');
  } else {
    console.log('ACTION: click Household & family once. No edit. No further click.');
    phase = 'after-household-click';
    try {
      await sectionBtn.first().click({ timeout: 8000 });
      clickMode = 'normal';
      await settle();
    } catch (error) {
      clickMode = 'failed';
      clickError = String(error.message || error).slice(0, 800);
      console.log('CLICK FAILED; force NOT used:', clickError);
    }
  }

  const after = await dumpUi();
  logDump('AFTER HOUSEHOLD & FAMILY CLICK', after);
  await page.screenshot({ path: `${OUT}/step-42-after-household-family.png`, fullPage: true });
  await fs.writeFile(
    `${OUT}/step-42-household-family-network.json`,
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

  const afterClickNet = captured.filter(e => e.phase === 'after-household-click');
  const reads = afterClickNet.filter(e => /GET/i.test(e.method));
  const writes = afterClickNet.filter(e => /POST|PUT|PATCH|DELETE/i.test(e.method));
  const mutations = afterClickNet.filter(e => e.flags?.mutations);
  const executions = afterClickNet.filter(looksLikeExecution);
  const providers = afterClickNet.filter(looksLikeProvider);
  const unexpected = afterClickNet.filter(e => e.flags?.unexpectedWriteOrExecution);
  const backendFamily = afterClickNet.flatMap(e =>
    extractFamilyFields(e.responseBody).map(f => ({ seq: e.seq, url: e.url, ...f }))
  );
  const urlChanged = before.url !== after.url;
  const landedOnEdit = /\/profile\/household-family\/edit/i.test(after.url);
  const surface = classifySurface(after);

  console.log('');
  console.log('--- STEP 42 COMPARISON ---');
  console.log('CLICK MODE:', clickMode);
  if (clickError) console.log('CLICK ERROR:', clickError);
  console.log('URL BEFORE:', before.url);
  console.log('URL AFTER:', after.url);
  console.log('NAVIGATION:', urlChanged ? 'YES' : 'NO');
  console.log('LANDED ON EDIT URL:', landedOnEdit ? 'YES' : 'NO');
  console.log('SURFACE CLASS:', surface);
  console.log('AFTER-CLICK NETWORK:', afterClickNet.length ? summarizeNetwork(afterClickNet) : 'None');
  console.log('BACKEND FAMILY FIELDS AFTER CLICK:', backendFamily.length ? backendFamily : 'None');
  console.log(
    'CONSOLE ERRORS AFTER CLICK:',
    consoleErrors.filter(e => e.phase === 'after-household-click').length
      ? consoleErrors.filter(e => e.phase === 'after-household-click')
      : 'None'
  );
  console.log(
    'PAGE ERRORS AFTER CLICK:',
    pageErrors.filter(e => e.phase === 'after-household-click').length
      ? pageErrors.filter(e => e.phase === 'after-household-click')
      : 'None'
  );
  console.log(
    'REQUEST FAILURES AFTER CLICK:',
    requestFailures.filter(e => e.phase === 'after-household-click').length
      ? requestFailures.filter(e => e.phase === 'after-household-click')
      : 'None'
  );
  if (stopReason) console.log('STOP REASON:', stopReason);

  console.log('');
  console.log('========================================');
  console.log('STEP 42 SUMMARY');
  console.log('========================================');
  console.log('STEP: 42');
  console.log('classification:', surface);
  console.log('click mode:', clickMode);
  console.log('URL before:', before.url);
  console.log('URL after:', after.url);
  console.log('navigation:', urlChanged ? 'yes' : 'no');
  console.log('lang:', after.lang);
  console.log('edit affordances after:', { links: after.editLinks, buttons: after.editBtns });
  console.log('forms/inputs after:', { forms: after.formCount, inputs: after.inputs });
  console.log('reads after click:', reads.length);
  console.log('mutations after click:', mutations.length ? summarizeNetwork(mutations) : 'None');
  console.log('writes after click:', writes.length ? summarizeNetwork(writes) : 'None');
  console.log('execution/AI after click:', executions.length || providers.length ? 'YES' : 'None');
  console.log('unexpected writes after click:', unexpected.length ? summarizeNetwork(unexpected) : 'None');
  console.log('STEP 42 performed no intentional profile modification and no Discovery execution.');
  console.log('artifact paths:');
  console.log(`  ${OUT}/step-42-before-household-family.png`);
  console.log(`  ${OUT}/step-42-after-household-family.png`);
  console.log(`  ${OUT}/step-42-household-family-network.json`);
} finally {
  await browser.close();
}
