import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE_URL = 'https://arrival-atlas.pro';
const OUT = 'tools/black-box-audit/artifacts/probe-004';
const PROFILE_NAV_RE = /Профіль|Профиль|Profile/i;
const HOUSEHOLD_SECTION_RE = /Household & family|Сім[ʼ'’']я та домогосподарство/i;
const EDIT_SECTION_RE = /Редагувати розділ/i;
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
  if (phase === 'after-edit-click' && isUnexpectedWriteOrExecution(entry)) {
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
        minLength: el.getAttribute('minlength'),
        maxLength: el.getAttribute('maxlength'),
        pattern: el.getAttribute('pattern'),
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
    editSectionLink: links.find(l => /household-family\/edit/i.test(l.href || '') || EDIT_SECTION_RE.test(l.text)),
    saveBtns: buttons.filter(b => /зберег|сохран|save/i.test(`${b.text} ${b.ariaLabel || ''}`)),
    cancelBtns: buttons.filter(b => /скасув|отмена|cancel/i.test(`${b.text} ${b.ariaLabel || ''}`)),
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
  console.log('FIELDS:', dump.fields);
  console.log('FORM COUNT:', dump.formCount);
  console.log('CURRENT/SELECTED:', dump.currentItems);
  console.log('HOUSEHOLD CONTROL:', dump.householdBtn || 'not found');
  console.log('EDIT SECTION LINK:', dump.editSectionLink || 'not found');
  console.log('SAVE:', dump.saveBtns.length ? dump.saveBtns : 'None');
  console.log('CANCEL:', dump.cancelBtns.length ? dump.cancelBtns : 'None');
  console.log('FAMILY TERM HITS:', dump.familyHits.length ? dump.familyHits : 'None');
  console.log('LOADING:', dump.loading > 0 ? `YES (${dump.loading})` : 'None');
  console.log('ALERTS:', dump.alerts.length ? dump.alerts : 'None');
  console.log('STATUS BANNERS:', dump.statusBanners.length ? dump.statusBanners : 'None');
  console.log('MAIN VISIBLE TEXT (first 8000 chars):');
  console.log((dump.visibleText || '').slice(0, 8000));
  console.log('ACCESSIBILITY SNAPSHOT:');
  console.log(dump.snapshot);
}

function classifyEditor(dump) {
  const url = dump.url || '';
  const fields = dump.fields || [];
  const visible = fields.filter(f => f.visible && f.type !== 'hidden');
  if (/\/profile\/household-family\/edit/i.test(url)) {
    return visible.length ? 'editing form at /profile/household-family/edit' : 'edit URL with no visible fields';
  }
  if (dump.formCount > 0 || visible.length) {
    return 'editing form (on-page, URL may differ)';
  }
  return 'destination reached but not classified as a visible editor — see evidence';
}

async function settle() {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

try {
  console.log('NETWORK CAPTURE: started before onboarding');
  console.log('READ-ONLY STEP 43: open editor via Редагувати розділ; do not change/save');

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
  await page.getByRole('link', { name: EDIT_SECTION_RE }).waitFor({ state: 'visible', timeout: 10000 });

  phase = 'before-edit-click';
  const before = await dumpUi();
  logDump('BEFORE EDIT CLICK (HOUSEHOLD INSPECTOR)', before);
  await page.screenshot({ path: `${OUT}/step-43-before-household-edit.png`, fullPage: true });

  const editLink = page.locator('a[href="/profile/household-family/edit"]');
  const editVisible = await editLink.first().isVisible().catch(() => false);
  console.log('EDIT LINK VISIBLE:', editVisible ? 'YES' : 'NO');

  let clickMode = 'skipped';
  let clickError = null;
  if (!editVisible) {
    console.log('CLICK SKIPPED: Редагувати розділ (household-family/edit) not visible');
  } else {
    console.log('ACTION: click Редагувати розділ once. No field change. No save.');
    phase = 'after-edit-click';
    try {
      await editLink.first().click({ timeout: 8000 });
      clickMode = 'normal';
      await page.waitForURL(/\/profile\/household-family\/edit/, { timeout: 15000 }).catch(() => {});
      await settle();
    } catch (error) {
      clickMode = 'failed';
      clickError = String(error.message || error).slice(0, 800);
      console.log('CLICK FAILED; force NOT used:', clickError);
    }
  }

  const after = await dumpUi();
  logDump('AFTER EDIT CLICK (EDITOR SURFACE)', after);
  await page.screenshot({ path: `${OUT}/step-43-after-household-edit.png`, fullPage: true });
  await fs.writeFile(
    `${OUT}/step-43-household-edit-network.json`,
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

  const afterNet = captured.filter(e => e.phase === 'after-edit-click');
  const reads = afterNet.filter(e => /GET/i.test(e.method));
  const writes = afterNet.filter(e => /POST|PUT|PATCH|DELETE/i.test(e.method));
  const mutations = afterNet.filter(e => e.flags?.mutations);
  const executions = afterNet.filter(looksLikeExecution);
  const providers = afterNet.filter(looksLikeProvider);
  const unexpected = afterNet.filter(e => e.flags?.unexpectedWriteOrExecution);
  const urlChanged = before.url !== after.url;
  const onEditUrl = /\/profile\/household-family\/edit/i.test(after.url);
  const blob = `${after.visibleText}\n${(after.fields || []).map(f => f.label).join('\n')}`;
  const asksPartner = /partner|партнер|spouse|подруж|чоловік|дружин/i.test(blob);
  const asksChildren = /child|діт|дитин|kinder/i.test(blob);
  const asksSize = /household size|розмір домогосподар|householdSize/i.test(blob);
  const asksOtherMembers = /other (household )?member|інш(і|их) член/i.test(blob);

  console.log('');
  console.log('--- STEP 43 COMPARISON ---');
  console.log('CLICK MODE:', clickMode);
  if (clickError) console.log('CLICK ERROR:', clickError);
  console.log('URL BEFORE:', before.url);
  console.log('URL AFTER:', after.url);
  console.log('NAVIGATION:', urlChanged ? 'YES' : 'NO');
  console.log('ON EDIT URL:', onEditUrl ? 'YES' : 'NO');
  console.log('CLASSIFICATION:', classifyEditor(after));
  console.log('ASKS PARTNER:', asksPartner);
  console.log('ASKS CHILDREN:', asksChildren);
  console.log('ASKS HOUSEHOLD SIZE:', asksSize);
  console.log('ASKS OTHER MEMBERS:', asksOtherMembers);
  console.log('AFTER-CLICK NETWORK:', afterNet.length ? summarizeNetwork(afterNet) : 'None');
  console.log(
    'CONSOLE ERRORS AFTER:',
    consoleErrors.filter(e => e.phase === 'after-edit-click').length
      ? consoleErrors.filter(e => e.phase === 'after-edit-click')
      : 'None'
  );
  console.log(
    'PAGE ERRORS AFTER:',
    pageErrors.filter(e => e.phase === 'after-edit-click').length
      ? pageErrors.filter(e => e.phase === 'after-edit-click')
      : 'None'
  );
  console.log(
    'REQUEST FAILURES AFTER:',
    requestFailures.filter(e => e.phase === 'after-edit-click').length
      ? requestFailures.filter(e => e.phase === 'after-edit-click')
      : 'None'
  );
  if (stopReason) console.log('STOP REASON:', stopReason);

  console.log('');
  console.log('========================================');
  console.log('STEP 43 SUMMARY');
  console.log('========================================');
  console.log('STEP: 43');
  console.log('classification:', classifyEditor(after));
  console.log('click mode:', clickMode);
  console.log('URL before:', before.url);
  console.log('URL after:', after.url);
  console.log('navigation:', urlChanged ? 'yes' : 'no');
  console.log('lang:', after.lang);
  console.log('fields:', after.fields);
  console.log('save/cancel:', { save: after.saveBtns, cancel: after.cancelBtns });
  console.log('reads after click:', reads.length);
  console.log('mutations after click:', mutations.length ? summarizeNetwork(mutations) : 'None');
  console.log('writes after click:', writes.length ? summarizeNetwork(writes) : 'None');
  console.log('execution/AI after click:', executions.length || providers.length ? 'YES' : 'None');
  console.log('unexpected writes after click:', unexpected.length ? summarizeNetwork(unexpected) : 'None');
  console.log('STEP 43 performed no intentional profile modification and no Discovery execution.');
  console.log('artifact paths:');
  console.log(`  ${OUT}/step-43-before-household-edit.png`);
  console.log(`  ${OUT}/step-43-after-household-edit.png`);
  console.log(`  ${OUT}/step-43-household-edit-network.json`);
} finally {
  await browser.close();
}
