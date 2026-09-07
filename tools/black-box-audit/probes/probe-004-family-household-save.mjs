import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE_URL = 'https://arrival-atlas.pro';
const OUT = 'tools/black-box-audit/artifacts/probe-004';
const PROFILE_NAV_RE = /Профіль|Профиль|Profile/i;
const HOUSEHOLD_SECTION_RE = /Household & family|Сім[ʼ'’']я та домогосподарство/i;
const EDIT_SECTION_RE = /Редагувати розділ/i;
const SAVE_RE = /^Зберегти$/i;
const MARRIED_LABEL_RE = /^(Одружений\s*\/\s*заміжня|Married)$/i;
const FAMILY_RE =
  /family|families|partner|spouse|ehepartner|child(?:ren)?|household|familie|kinder|haushalt|сім[ʼ'’']?я|родин|партнер|дитин|діте|подружж|чоловік|дружин|батьк|домогосподар|сімейн|одружен|заміжн/i;

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

function isHouseholdSaveMutation(entry) {
  const payload = String(entry.requestPayload || '');
  return (
    /POST|PUT|PATCH/i.test(entry.method) &&
    /\/api\/mutations/i.test(entry.url) &&
    /household|householdSize|maritalStatus/i.test(payload)
  );
}

function isUnexpectedWriteOrExecution(entry) {
  if (looksLikeExecution(entry) || looksLikeProvider(entry)) {
    return true;
  }
  if (/\/execute/i.test(entry.url) || /\/run(?!-summary)/i.test(entry.url)) {
    return true;
  }
  if (phase === 'after-save-click' && isHouseholdSaveMutation(entry)) {
    return false;
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
    if (phase === 'after-save-click' && isHouseholdSaveMutation(entry)) {
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
    userContext: /\/api\/user-context/i.test(entry.url),
    profileInsights: /\/api\/profile-insights/i.test(entry.url),
    uiSnapshot: /\/api\/ui-snapshot/i.test(entry.url),
    lifeEvent: /life-event/i.test(entry.url),
    economicPlan: /economic/i.test(entry.url),
    mutations: /\/api\/mutations/i.test(entry.url),
    householdSave: isHouseholdSaveMutation(entry),
    writeMethod: /POST|PUT|PATCH|DELETE/i.test(entry.method),
    execute: /\/execute/i.test(entry.url),
    executionLike: looksLikeExecution(entry),
    providerLike: looksLikeProvider(entry),
    householdFamilyPath: /household-family|household/i.test(entry.url),
    editPath: /\/edit(\?|$)/i.test(entry.url),
    rsc: /[?&]_rsc=|_rsc/i.test(entry.url),
    revisionConflict: isRevisionConflict(entry),
    unexpectedWriteOrExecution: isUnexpectedWriteOrExecution(entry),
  };
}

function isRevisionConflict(entry) {
  const blob = JSON.stringify(entry.responseBody || '');
  return (
    entry.status === 409 ||
    /REVISION_CONFLICT|revision conflict|expected head revision/i.test(blob)
  );
}

function collectKeys(value, want, acc = {}, path = '') {
  if (value == null) {
    return acc;
  }
  if (Array.isArray(value)) {
    value.forEach((child, i) => collectKeys(child, want, acc, `${path}[${i}]`));
    return acc;
  }
  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const next = path ? `${path}.${key}` : key;
      if (want.test(key)) {
        acc[next] = child;
      }
      collectKeys(child, want, acc, next);
    }
  }
  return acc;
}

function householdBits(body) {
  if (body == null) {
    return null;
  }
  const keys = collectKeys(
    body,
    /household|householdSize|maritalStatus|missingDomains|completeness|confidence|revision|schemaVersion|appliedEventId/i
  );
  return Object.keys(keys).length ? keys : null;
}

function summarizeMutation(entry) {
  const payload = typeof entry.requestPayload === 'string' ? safeJson(entry.requestPayload) : entry.requestPayload;
  const body = entry.responseBody;
  return {
    seq: entry.seq,
    method: entry.method,
    status: entry.status,
    url: entry.url,
    type: payload?.type || payload?.intent || null,
    domain: payload?.domain || payload?.payload?.domain || null,
    fields: payload?.payload?.fields || payload?.fields || null,
    expectedHeadRevision: payload?.expectedHeadRevision ?? null,
    revision: body?.revision ?? body?.headRevision ?? null,
    success: body?.success,
    code: body?.code || null,
    error: body?.error || null,
    appliedEventId: body?.appliedEventId || null,
    householdFromResponse: householdBits(body),
    flags: entry.flags,
  };
}

function safeJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
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
  if (phase === 'after-save-click' && isUnexpectedWriteOrExecution(entry)) {
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
    householdBits: householdBits(entry.responseBody),
  }));
}

async function dumpFields() {
  return page.locator('input, select, textarea').evaluateAll(els => {
    const textOf = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
    const labelFor = el => {
      if (el.id) {
        const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (lab) {
          return textOf(lab);
        }
      }
      const wrap = el.closest('label');
      if (wrap) {
        return textOf(wrap);
      }
      return el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('name') || el.id || '';
    };
    return els.map(el => {
      const fieldset = el.closest('fieldset');
      const legend = fieldset?.querySelector('legend');
      return {
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type'),
        id: el.id || null,
        name: el.getAttribute('name'),
        label: labelFor(el).slice(0, 240),
        legend: legend ? textOf(legend).slice(0, 240) : null,
        value: 'value' in el ? String(el.value).slice(0, 200) : null,
        placeholder: el.getAttribute('placeholder'),
        required: Boolean(el.required),
        ariaRequired: el.getAttribute('aria-required'),
        ariaInvalid: el.getAttribute('aria-invalid'),
        ariaDescribedBy: el.getAttribute('aria-describedby'),
        disabled: Boolean(el.disabled),
        readOnly: Boolean(el.readOnly),
        checked: el.type === 'checkbox' || el.type === 'radio' ? el.checked : undefined,
        min: el.getAttribute('min'),
        max: el.getAttribute('max'),
        validationMessage: typeof el.validationMessage === 'string' ? el.validationMessage : null,
        visible: el.offsetParent !== null || el.getClientRects().length > 0,
        selectedOptions:
          el.tagName === 'SELECT'
            ? [...el.options]
                .filter(o => o.selected)
                .map(o => ({ value: o.value, text: (o.textContent || '').replace(/\s+/g, ' ').trim() }))
            : undefined,
        options:
          el.tagName === 'SELECT'
            ? [...el.options].map(o => ({
                value: o.value,
                text: (o.textContent || '').replace(/\s+/g, ' ').trim(),
                selected: o.selected,
              }))
            : undefined,
      };
    });
  });
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
  const fields = await dumpFields();
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
  const saveBtns = buttons.filter(b => SAVE_RE.test(b.text) || /зберегти/i.test(`${b.text} ${b.ariaLabel || ''}`));
  const cancelBtns = buttons.filter(b => /скасув|отмена|cancel/i.test(`${b.text} ${b.ariaLabel || ''}`));
  return {
    url: page.url(),
    title: await page.title(),
    lang: await page.locator('html').getAttribute('lang'),
    headings,
    buttons,
    links,
    fields,
    formCount: await page.locator('form').count(),
    currentItems,
    householdBtn: buttons.find(b => HOUSEHOLD_SECTION_RE.test(`${b.text} ${b.ariaLabel || ''}`)),
    saveBtns,
    cancelBtns,
    editStillOpen: /\/profile\/household-family\/edit/i.test(page.url()),
    familyHits: [...new Set((visibleText.match(new RegExp(FAMILY_RE.source, 'gi')) || []).map(s => s.toLowerCase()))],
    statusBanners: await page.locator('[role="status"]').allTextContents().catch(() => []),
    alerts: await page.locator('[role="alert"]').allTextContents().catch(() => []),
    toasts: await page
      .locator('[class*="toast"], [class*="Toast"], [class*="notification"]')
      .allTextContents()
      .catch(() => []),
    arrivingFrom: await page.getByText(/Arriving from/i).allTextContents().catch(() => []),
    successTexts: await page
      .getByText(/success|успіш|сохран|збереж|оновлен|збережено/i)
      .allTextContents()
      .catch(() => []),
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
  console.log('FIELDS:', dump.fields);
  console.log('FORM COUNT:', dump.formCount);
  console.log('CURRENT/SELECTED:', dump.currentItems);
  console.log('HOUSEHOLD CONTROL:', dump.householdBtn || 'not found');
  console.log('SAVE:', dump.saveBtns.length ? dump.saveBtns : 'None');
  console.log('CANCEL:', dump.cancelBtns.length ? dump.cancelBtns : 'None');
  console.log('EDITOR OPEN:', dump.editStillOpen ? 'YES' : 'NO');
  console.log('FAMILY TERM HITS:', dump.familyHits.length ? dump.familyHits : 'None');
  console.log('LOADING:', dump.loading > 0 ? `YES (${dump.loading})` : 'None');
  console.log('ALERTS:', dump.alerts.length ? dump.alerts : 'None');
  console.log('STATUS BANNERS:', dump.statusBanners.length ? dump.statusBanners : 'None');
  console.log('TOASTS:', dump.toasts.length ? dump.toasts : 'None');
  console.log('SUCCESS TEXTS:', dump.successTexts.length ? dump.successTexts : 'None');
  console.log('ARRIVING FROM:', dump.arrivingFrom.length ? dump.arrivingFrom : 'None');
  console.log('MAIN VISIBLE TEXT (first 8000 chars):');
  console.log((dump.visibleText || '').slice(0, 8000));
  console.log('ACCESSIBILITY SNAPSHOT:');
  console.log(dump.snapshot);
}

function textShowsHouseholdSize(text) {
  return /household size[\s\S]{0,40}\b3\b|розмір домогосподарства[\s\S]{0,40}\b3\b|household of 3/i.test(
    text || ''
  );
}

function classifySaveOutcome({ filled, after, saveNet }) {
  const mutations = saveNet.filter(e => e.flags?.mutations || e.flags?.householdSave);
  const conflicts = mutations.filter(e => e.flags?.revisionConflict);
  const ok = mutations.filter(e => e.status >= 200 && e.status < 300 && !e.flags?.revisionConflict);
  const stillEdit = after.editStillOpen;
  const text = after.visibleText || '';
  const stillNotAdded = /not added yet/i.test(text);
  const showsSize = textShowsHouseholdSize(text) || (after.fields || []).some(f => f.id === 'profile-field-householdSize' && f.value === '3');
  const showsMarried = /одружен|заміжн|married/i.test(text);
  if (!mutations.length) {
    return stillEdit ? 'save click produced no mutation; editor still open' : 'save click produced no mutation; left editor';
  }
  if (conflicts.length && !ok.length) {
    return 'revision conflict without a successful follow-up mutation';
  }
  if (conflicts.length && ok.length) {
    const suffix = stillNotAdded ? '; inspector still NOT ADDED YET' : '';
    return `revision conflict then automatic retry succeeded${suffix}`;
  }
  if (ok.length && stillEdit) {
    return showsSize || showsMarried
      ? 'mutation succeeded; editor remained open with values visible'
      : 'mutation succeeded; editor remained open';
  }
  if (ok.length && stillNotAdded && !showsSize && !showsMarried) {
    return 'mutation succeeded but inspector still shows empty/not-added state';
  }
  if (ok.length && (showsSize || showsMarried) && !stillNotAdded) {
    return 'mutation succeeded with visible household state transition off empty';
  }
  if (ok.length && /complete/i.test(text)) {
    return 'mutation succeeded; inspector left empty state (Complete)';
  }
  if (ok.length) {
    return 'mutation succeeded; see after-save evidence for inspector vs values';
  }
  return 'save outcome unclassified — see evidence';
}

async function settle() {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

try {
  console.log('NETWORK CAPTURE: started before onboarding');
  console.log('CONTROLLED MUTATION STEP 45: fill household size 3 + married; save once');

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
  console.log('SETUP: click Редагувати розділ');
  await page.locator('a[href="/profile/household-family/edit"]').first().click({ timeout: 8000 });
  await page.waitForURL(/\/profile\/household-family\/edit/, { timeout: 15000 });
  await settle();
  await page.locator('#profile-field-householdSize').waitFor({ state: 'visible', timeout: 10000 });

  phase = 'before-fill';
  const before = await dumpUi();
  logDump('BEFORE FILL (EMPTY EDITOR)', before);
  await page.screenshot({ path: `${OUT}/step-45-before-household-save.png`, fullPage: true });

  console.log('FILL: household size = 3');
  await page.locator('#profile-field-householdSize').fill('3');

  const marital = page.locator('#profile-field-maritalStatus');
  const maritalOptions = await marital.locator('option').evaluateAll(els =>
    els.map(o => ({ value: o.value, text: (o.textContent || '').replace(/\s+/g, ' ').trim() }))
  );
  console.log('MARITAL OPTIONS:', maritalOptions);
  const married = maritalOptions.find(
    o => o.value === 'married' || MARRIED_LABEL_RE.test(o.text)
  );
  if (!married || married.value === 'single') {
    throw new Error(`Married option not found among ${JSON.stringify(maritalOptions)}`);
  }
  console.log('FILL: marital status =', married.text, 'value=', married.value);
  if (married.value) {
    await marital.selectOption(married.value);
  } else {
    await marital.selectOption({ label: married.text });
  }
  await page.waitForTimeout(400);

  phase = 'filled-before-save';
  const filled = await dumpUi();
  const filledSize = filled.fields.find(f => f.id === 'profile-field-householdSize');
  const filledMarital = filled.fields.find(f => f.id === 'profile-field-maritalStatus');
  if (filledSize?.value !== '3' || filledMarital?.value !== 'married') {
    throw new Error(
      `Fill verification failed: householdSize=${filledSize?.value} maritalStatus=${filledMarital?.value}`
    );
  }
  logDump('FILLED FORM BEFORE SAVE', filled);
  await page.screenshot({ path: `${OUT}/step-45-filled-before-save.png`, fullPage: true });

  const saveBtn = page.getByRole('button', { name: SAVE_RE });
  const saveVisible = await saveBtn.isVisible().catch(() => false);
  const saveEnabled = saveVisible ? await saveBtn.isEnabled().catch(() => false) : false;
  console.log('SAVE VISIBLE:', saveVisible ? 'YES' : 'NO');
  console.log('SAVE ENABLED BEFORE CLICK:', saveEnabled ? 'YES' : 'NO');

  let clickMode = 'skipped';
  let clickError = null;
  let loadingDuring = 0;
  if (!saveVisible || !saveEnabled) {
    console.log('CLICK SKIPPED: Save not visible/enabled; force NOT used');
  } else {
    console.log('ACTION: click Зберегти once. No retry. No cancel.');
    phase = 'after-save-click';
    try {
      await saveBtn.click({ timeout: 8000 });
      clickMode = 'normal';
      loadingDuring = await page
        .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
        .count()
        .catch(() => 0);
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(3000);
    } catch (error) {
      clickMode = 'failed';
      clickError = String(error.message || error).slice(0, 800);
      console.log('CLICK FAILED; force NOT used:', clickError);
    }
  }

  const after = await dumpUi();
  logDump('AFTER SAVE', after);
  await page.screenshot({ path: `${OUT}/step-45-after-household-save.png`, fullPage: true });
  await fs.writeFile(
    `${OUT}/step-45-household-save-network.json`,
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

  const saveNet = captured.filter(e => e.phase === 'after-save-click');
  const mutations = saveNet.filter(e => e.flags?.mutations || e.flags?.householdSave);
  const writes = saveNet.filter(e => /POST|PUT|PATCH|DELETE/i.test(e.method));
  const reads = saveNet.filter(e => /GET/i.test(e.method));
  const userContext = saveNet.filter(e => e.flags?.userContext);
  const insights = saveNet.filter(e => e.flags?.profileInsights);
  const uiSnapshots = saveNet.filter(e => e.flags?.uiSnapshot);
  const lifeEvents = saveNet.filter(e => e.flags?.lifeEvent);
  const economic = saveNet.filter(e => e.flags?.economicPlan);
  const profileReads = saveNet.filter(e => e.flags?.profileRead);
  const executions = saveNet.filter(looksLikeExecution);
  const providers = saveNet.filter(looksLikeProvider);
  const unexpected = saveNet.filter(e => e.flags?.unexpectedWriteOrExecution);
  const rsc = saveNet.filter(e => e.flags?.rsc);
  const conflicts = saveNet.filter(e => e.flags?.revisionConflict);
  const urlChanged = filled.url !== after.url;
  const blob = after.visibleText || '';
  const classification = classifySaveOutcome({ filled, after, saveNet });

  const beforeContext = captured.filter(e => e.phase === 'setup' && e.flags?.userContext).slice(-1)[0];
  const afterContext = userContext.slice(-1)[0] || captured.filter(e => e.flags?.userContext).slice(-1)[0];

  console.log('');
  console.log('--- STEP 45 COMPARISON ---');
  console.log('CLICK MODE:', clickMode);
  if (clickError) console.log('CLICK ERROR:', clickError);
  console.log('SAVE ENABLED BEFORE CLICK:', saveEnabled ? 'YES' : 'NO');
  console.log('LOADING DURING SAVE:', loadingDuring > 0 ? `YES (${loadingDuring})` : 'None observed immediately after click');
  console.log('URL BEFORE SAVE:', filled.url);
  console.log('URL AFTER SAVE:', after.url);
  console.log('NAVIGATION:', urlChanged ? 'YES' : 'NO');
  console.log('EDITOR REMAINS OPEN:', after.editStillOpen ? 'YES' : 'NO');
  console.log('CLASSIFICATION:', classification);
  console.log('MUTATION SUMMARIES:', mutations.length ? mutations.map(summarizeMutation) : 'None');
  console.log('REVISION CONFLICTS:', conflicts.length ? mutations.filter(e => e.flags?.revisionConflict).map(summarizeMutation) : 'None');
  console.log('AFTER-SAVE NETWORK:', saveNet.length ? summarizeNetwork(saveNet) : 'None');
  console.log(
    'CONSOLE ERRORS AFTER SAVE:',
    consoleErrors.filter(e => e.phase === 'after-save-click').length
      ? consoleErrors.filter(e => e.phase === 'after-save-click')
      : 'None'
  );
  console.log(
    'PAGE ERRORS AFTER SAVE:',
    pageErrors.filter(e => e.phase === 'after-save-click').length
      ? pageErrors.filter(e => e.phase === 'after-save-click')
      : 'None'
  );
  console.log(
    'REQUEST FAILURES AFTER SAVE:',
    requestFailures.filter(e => e.phase === 'after-save-click').length
      ? requestFailures.filter(e => e.phase === 'after-save-click')
      : 'None'
  );
  if (stopReason) console.log('STOP REASON:', stopReason);

  console.log('');
  console.log('========================================');
  console.log('STEP 45 SUMMARY');
  console.log('========================================');
  console.log('STEP: 45');
  console.log('classification:', classification);
  console.log('click mode:', clickMode);
  console.log('data entered:', { householdSize: '3', maritalStatus: married });
  console.log('fields before fill:', before.fields);
  console.log('fields filled:', filled.fields);
  console.log('fields after save:', after.fields);
  console.log('save enabled before click:', saveEnabled);
  console.log('URL before:', filled.url);
  console.log('URL after:', after.url);
  console.log('navigation:', urlChanged ? 'yes' : 'no');
  console.log('lang:', after.lang);
  console.log('editor remains open:', after.editStillOpen);
  console.log('save/cancel after:', { save: after.saveBtns, cancel: after.cancelBtns });
  console.log('selected node:', after.householdBtn || after.currentItems);
  console.log('household size shown in UI:', textShowsHouseholdSize(blob) || /householdSize/.test(JSON.stringify(after.fields)));
  console.log('marital status shown in UI:', /одружен|заміжн|married/i.test(blob));
  console.log('not added yet still visible:', /not added yet/i.test(blob));
  console.log('partner shown:', /партнер|partner|hasPartner/i.test(blob));
  console.log('children shown:', /діт|дитин|children/i.test(blob));
  console.log('mutations after save:', mutations.length ? mutations.map(summarizeMutation) : 'None');
  console.log('writes after save:', writes.length ? summarizeNetwork(writes) : 'None');
  console.log('profile/read-model GETs after save:', profileReads.length ? summarizeNetwork(profileReads) : 'None');
  console.log('user-context GETs after save:', userContext.length ? summarizeNetwork(userContext) : 'None');
  console.log('profile-insights GETs after save:', insights.length ? summarizeNetwork(insights) : 'None');
  console.log('ui-snapshot GETs after save:', uiSnapshots.length ? summarizeNetwork(uiSnapshots) : 'None');
  console.log('life-event reads after save:', lifeEvents.length ? summarizeNetwork(lifeEvents) : 'None');
  console.log('economic-plan reads after save:', economic.length ? summarizeNetwork(economic) : 'None');
  console.log('rsc after save:', rsc.length);
  console.log('reads after save:', reads.length);
  console.log('execution/AI after save:', executions.length || providers.length ? 'YES' : 'None');
  console.log('unexpected writes after save:', unexpected.length ? summarizeNetwork(unexpected) : 'None');
  console.log('user-context household bits before (last setup):', beforeContext ? householdBits(beforeContext.responseBody) : 'None');
  console.log('user-context household bits after:', afterContext ? householdBits(afterContext.responseBody) : 'None');
  console.log('STEP 45 performed one intentional Household & family profile modification and no Discovery execution.');
  console.log('artifact paths:');
  console.log(`  ${OUT}/step-45-before-household-save.png`);
  console.log(`  ${OUT}/step-45-filled-before-save.png`);
  console.log(`  ${OUT}/step-45-after-household-save.png`);
  console.log(`  ${OUT}/step-45-household-save-network.json`);
} finally {
  await browser.close();
}
