import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE_URL = 'https://arrival-atlas.pro';
const OUT = 'tools/black-box-audit/artifacts/probe-003';
const DISCOVERY_NAV_RE = /Пошук|Поиск|Discovery/i;
const GUIDED_RE = /Почати супроводжуваний шлях/i;
const NEW_PROFILE_RE = /Новый профиль|Новий профіль|New profile/i;
const TYPE_COMBO_RE = /Работа \/ Розыгрыши|Jobs \/ Giveaways|Работа \/ Розіграші/i;
const JOBS_OPTION_RE = /Работа|Jobs/i;
const NAME_FIELD_RE = /Название профиля|Profile name/i;
const PROFILE_NAME_VALUE = 'Мой поиск работы';

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
let phase = 'before-name-entry';

page.on('console', msg => {
  if (msg.type() === 'error') {
    consoleErrors.push({ phase, text: msg.text() });
  }
});

page.on('pageerror', error => {
  pageErrors.push({ phase, message: error.message });
});

page.on('requestfailed', request => {
  requestFailures.push({
    phase,
    url: request.url(),
    method: request.method(),
    failure: request.failure()?.errorText ?? 'unknown',
  });
});

function isRscPrefetchAbort(failure) {
  const blob = `${failure.url} ${failure.method} ${failure.failure}`;
  return /_rsc|rsc=|prefetch|ERR_ABORTED|NS_BINDING_ABORTED|net::ERR_ABORTED/i.test(blob);
}

function looksLikeExecution(entry) {
  const blob = `${entry.method} ${entry.url} ${entry.requestPayload || ''}`;
  return /\/execute|\/generate|\/recommend|\/complet|openai|anthropic|\/ai\/|provider|prompt|generation/i.test(
    blob
  );
}

function looksLikeDiscoveryApi(entry) {
  return /\/api\/modules\/discovery/i.test(entry.url);
}

function looksLikeProfileMutation(entry) {
  const blob = `${entry.method} ${entry.url} ${entry.requestPayload || ''}`;
  const write = /POST|PUT|PATCH|DELETE/i.test(entry.method);
  return (
    write &&
    (/\/api\/modules\/discovery\/profiles/i.test(entry.url) ||
      /\/api\/mutations/i.test(entry.url) ||
      /profile.*(create|save|insert)|createProfile|saveProfile/i.test(blob))
  );
}

function classifyRequest(entry) {
  const payload = String(entry.requestPayload || '');
  return {
    discoveryApi: /\/api\/modules\/discovery/i.test(entry.url),
    discoveryPage: /\/modules\/discovery/i.test(entry.url) && !/\/api\//.test(entry.url),
    execute: /\/execute/i.test(entry.url),
    mutations: /\/api\/mutations/i.test(entry.url),
    uiSnapshot: /\/api\/ui-snapshot/i.test(entry.url),
    userContext: /\/api\/user-context/i.test(entry.url),
    payloadLooksLikeQueryOrPrompt: /prompt|query|search|generate|recommend|discovery|messages/i.test(
      payload
    ),
    executionLike: looksLikeExecution(entry),
    profileMutationLike: looksLikeProfileMutation(entry),
  };
}

async function recordResponse(response) {
  const request = response.request();
  const url = response.url();
  const method = request.method();
  const interesting =
    /\/api\/|\/modules\/discovery|_rsc|rsc=|mutation|execute|intent|ui-snapshot|user-context|profile|discover|openai|anthropic|\/ai\//i.test(
      `${method} ${url}`
    ) ||
    ((/POST|PUT|PATCH|DELETE/i.test(method)) && /xhr|fetch|document/i.test(request.resourceType()));
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
  const entry = {
    phase,
    method,
    url,
    status: response.status(),
    resourceType: request.resourceType(),
    requestPayload: request.postData() || null,
    responseBody,
  };
  entry.flags = classifyRequest(entry);
  captured.push(entry);
}

page.on('response', response => {
  recordResponse(response).catch(() => {});
});

function summarizeNetwork(list) {
  return list.map(entry => ({
    phase: entry.phase,
    method: entry.method,
    status: entry.status,
    url: entry.url,
    flags: entry.flags,
    requestPayload: entry.requestPayload,
  }));
}

function findAiWording(text) {
  const patterns = [
    /\bAI\b/gi,
    /\bLLM\b/gi,
    /OpenAI/gi,
    /Anthropic/gi,
    /provider/gi,
    /\btoken\b/gi,
    /\bcredits?\b/gi,
    /\bcost\b/gi,
    /generate/gi,
    /billable/gi,
  ];
  const hits = [];
  for (const re of patterns) {
    const found = String(text || '').match(re);
    if (found) {
      hits.push(...found);
    }
  }
  return [...new Set(hits.map(h => h.toLowerCase()))];
}

function buttonByName(buttons, re) {
  return buttons.find(b => re.test(`${b.text} ${b.ariaLabel || ''}`)) || null;
}

function buttonEnabledLabel(button) {
  if (!button) {
    return 'not found';
  }
  const disabled = Boolean(button.disabled) || button.ariaDisabled === 'true';
  return disabled ? 'disabled' : 'enabled';
}

function controlKey(control) {
  return [control.tag, control.type || '', control.id || '', control.name || '', control.label || '']
    .join('|')
    .replace(/\s+/g, ' ')
    .trim();
}

function compareForms(beforeForm, afterForm) {
  const beforeMap = new Map((beforeForm.controls || []).map(c => [controlKey(c), c]));
  const afterMap = new Map((afterForm.controls || []).map(c => [controlKey(c), c]));
  const added = [];
  const removed = [];
  const changed = [];
  for (const [key, afterCtrl] of afterMap) {
    if (!beforeMap.has(key)) {
      added.push(afterCtrl);
    }
  }
  for (const [key, beforeCtrl] of beforeMap) {
    if (!afterMap.has(key)) {
      removed.push(beforeCtrl);
    } else {
      const afterCtrl = afterMap.get(key);
      const beforeState = JSON.stringify({
        value: beforeCtrl.value,
        checked: beforeCtrl.checked,
        disabled: beforeCtrl.disabled,
        required: beforeCtrl.required,
        ariaRequired: beforeCtrl.ariaRequired,
        ariaInvalid: beforeCtrl.ariaInvalid,
        selectedOptions: beforeCtrl.selectedOptions,
      });
      const afterState = JSON.stringify({
        value: afterCtrl.value,
        checked: afterCtrl.checked,
        disabled: afterCtrl.disabled,
        required: afterCtrl.required,
        ariaRequired: afterCtrl.ariaRequired,
        ariaInvalid: afterCtrl.ariaInvalid,
        selectedOptions: afterCtrl.selectedOptions,
      });
      if (beforeState !== afterState) {
        changed.push({ before: beforeCtrl, after: afterCtrl });
      }
    }
  }
  return { added, removed, changed };
}

async function dumpDialog() {
  const dialog = page.getByRole('dialog');
  const visible = await dialog.first().isVisible().catch(() => false);
  if (!visible) {
    return { visible: false, count: await dialog.count().catch(() => 0) };
  }
  const first = dialog.first();
  const title = await first
    .evaluate(el => {
      const heading = el.querySelector('h1, h2, h3');
      return (el.getAttribute('aria-label') || heading?.textContent || '').replace(/\s+/g, ' ').trim();
    })
    .catch(() => null);
  const text = await first.innerText().catch(() => '');
  return {
    visible: true,
    count: await dialog.count().catch(() => 0),
    title,
    text: text.replace(/\s+/g, ' ').trim().slice(0, 1200),
  };
}

async function dumpCreateForm() {
  const region = page.getByRole('region', { name: /Создать профиль поиска|Create search profile/i });
  const visible = await region.first().isVisible().catch(() => false);
  if (!visible) {
    return { visible: false };
  }
  const first = region.first();
  const combo = first.getByRole('combobox').first();
  const comboVisible = await combo.isVisible().catch(() => false);
  const profileType = comboVisible
    ? await combo
        .evaluate(el => {
          if (el.tagName === 'SELECT') {
            const opt = el.options[el.selectedIndex];
            return {
              tag: el.tagName,
              value: el.value,
              label: (opt?.textContent || '').replace(/\s+/g, ' ').trim(),
              options: [...el.options].map(o => ({
                value: o.value,
                label: (o.textContent || '').replace(/\s+/g, ' ').trim(),
                selected: o.selected,
              })),
            };
          }
          return {
            tag: el.tagName,
            value: el.value || null,
            label: (el.textContent || '').replace(/\s+/g, ' ').trim(),
            options: [],
          };
        })
        .catch(() => null)
    : null;
  const controls = await first
    .evaluate(root => {
      const textOf = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
      const labelFor = el => {
        if (el.id) {
          const lab = root.querySelector(`label[for="${CSS.escape(el.id)}"]`);
          if (lab) {
            return textOf(lab);
          }
        }
        const wrap = el.closest('label');
        if (wrap) {
          return textOf(wrap);
        }
        return (
          el.getAttribute('aria-label') ||
          el.getAttribute('placeholder') ||
          el.getAttribute('name') ||
          el.id ||
          ''
        );
      };
      return [...root.querySelectorAll('input, textarea, select, button')].map(el => ({
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type'),
        id: el.id || null,
        name: el.getAttribute('name'),
        placeholder: el.getAttribute('placeholder'),
        label: labelFor(el).slice(0, 240),
        value: 'value' in el ? el.value : null,
        checked: el.type === 'checkbox' || el.type === 'radio' ? el.checked : undefined,
        disabled: Boolean(el.disabled) || el.getAttribute('aria-disabled') === 'true',
        required: Boolean(el.required) || el.getAttribute('required') !== null,
        ariaRequired: el.getAttribute('aria-required'),
        ariaInvalid: el.getAttribute('aria-invalid'),
        validationMessage: typeof el.validationMessage === 'string' ? el.validationMessage : null,
        selectedOptions:
          el.tagName === 'SELECT'
            ? [...el.options]
                .filter(o => o.selected)
                .map(o => ({
                  value: o.value,
                  text: (o.textContent || '').replace(/\s+/g, ' ').trim(),
                }))
            : undefined,
      }));
    })
    .catch(() => []);
  const headings = await first.locator('h1, h2, h3, h4, h5, h6').evaluateAll(els =>
    els.map(e => ({ tag: e.tagName, text: e.textContent.trim() }))
  );
  const fieldLabels = await first.locator('label').evaluateAll(els =>
    els.map(e => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
  );
  const text = await first.innerText().catch(() => '');
  const snapshot = await first.ariaSnapshot().catch(() => '');
  const validationLike = (text.match(
    /обязательн[^\n]{0,80}|обов.язков[^\n]{0,80}|required[^\n]{0,80}|invalid[^\n]{0,80}|ошибк[^\n]{0,80}|помилк[^\n]{0,80}|необязательно[^\n]{0,80}/gi
  ) || []).map(s => s.replace(/\s+/g, ' ').trim());
  const nameControl = (controls || []).find(c => /Название профиля|Profile name/i.test(c.label || ''));
  return {
    visible: true,
    headings,
    fieldLabels,
    profileType,
    controls,
    nameControl,
    validationLike: [...new Set(validationLike)],
    text: (text || '').replace(/\s+/g, ' ').trim(),
    snapshot,
  };
}

async function dumpUi() {
  const headings = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll(
    els => els.map(e => ({ tag: e.tagName, text: e.textContent.trim() }))
  );
  const buttons = await page.getByRole('button').evaluateAll(els =>
    els.map(el => ({
      text: el.textContent.trim(),
      type: el.getAttribute('type'),
      disabled: el.disabled,
      ariaDisabled: el.getAttribute('aria-disabled'),
      ariaLabel: el.getAttribute('aria-label'),
    }))
  );
  const snapshot = await page.locator('body').ariaSnapshot();
  const visibleText = await page.locator('body').innerText();
  const statusBanners = await page.locator('[role="status"]').allTextContents().catch(() => []);
  const alerts = await page.locator('[role="alert"]').allTextContents().catch(() => []);
  const dialog = await dumpDialog();
  const createForm = await dumpCreateForm();
  const createBtn = buttonByName(buttons, /Создать профиль|Create profile/i);
  const saveEmailBtn = buttonByName(buttons, /Зберегти email|Save email/i);
  const cancelBtn = buttonByName(buttons, /Отмена|Скасувати|Cancel/i);
  const executeSearchBtns = buttons.filter(b =>
    /execute|search|поиск|пошук|discover|generate|find|рекоменд|найти|знайти/i.test(
      `${b.text} ${b.ariaLabel || ''}`
    )
  );
  const aiHits = findAiWording(`${visibleText}\n${snapshot}\n${createForm.text || ''}`);
  const focused = await page
    .evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) {
        return null;
      }
      return {
        tag: el.tagName,
        id: el.id || null,
        type: el.getAttribute('type'),
        name: el.getAttribute('name'),
        ariaLabel: el.getAttribute('aria-label'),
        value: 'value' in el ? String(el.value).slice(0, 200) : null,
      };
    })
    .catch(() => null);
  return {
    url: page.url(),
    title: await page.title(),
    lang: await page.locator('html').getAttribute('lang'),
    headings,
    buttons,
    snapshot,
    visibleText,
    statusBanners,
    alerts,
    dialog,
    createForm,
    createBtn,
    saveEmailBtn,
    cancelBtn,
    executeSearchBtns,
    aiHits,
    focused,
    formCount: await page.locator('form').count(),
    dialogCount: await page.locator('[role="dialog"]').count(),
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
  console.log('PATH:', (() => {
    try {
      return new URL(dump.url).pathname + new URL(dump.url).search;
    } catch {
      return dump.url;
    }
  })());
  console.log('HEADINGS:', dump.headings);
  console.log('BUTTONS:', dump.buttons);
  console.log('DIALOG:', dump.dialog);
  console.log('CREATE FORM VISIBLE:', dump.createForm.visible ? 'YES' : 'NO');
  console.log('PROFILE TYPE:', dump.createForm.profileType || 'not found');
  console.log('NAME CONTROL:', dump.createForm.nameControl || 'not found');
  console.log('CREATE PROFILE BUTTON:', dump.createBtn || 'not found');
  console.log('SAVE EMAIL BUTTON:', dump.saveEmailBtn || 'not found');
  console.log('CANCEL BUTTON:', dump.cancelBtn || 'not found');
  console.log('CREATE FORM HEADINGS:', dump.createForm.headings || []);
  console.log('CREATE FORM LABELS:', dump.createForm.fieldLabels || []);
  console.log('CREATE FORM CONTROLS:', dump.createForm.controls || []);
  console.log('REQUIRED/OPTIONAL / VALIDATION-LIKE TEXT:', dump.createForm.validationLike || []);
  console.log('CREATE FORM TEXT:', (dump.createForm.text || '').slice(0, 4000));
  console.log('CREATE FORM SNAPSHOT:');
  console.log(dump.createForm.snapshot || 'n/a');
  console.log('FOCUSED ELEMENT:', dump.focused || 'none');
  console.log('EXECUTE/SEARCH BUTTONS:', dump.executeSearchBtns.length ? dump.executeSearchBtns : 'None');
  console.log('STATUS BANNERS:', dump.statusBanners.length ? dump.statusBanners : 'None');
  console.log('AI / COST / PROVIDER WORD HITS:', dump.aiHits.length ? dump.aiHits : 'None');
  console.log('DIALOGS COUNT:', dump.dialogCount);
  console.log('LOADING:', dump.loading > 0 ? `YES (${dump.loading})` : 'None');
  console.log('ALERTS:', dump.alerts.length ? dump.alerts : 'None');
  console.log('MAIN VISIBLE TEXT (first 8000 chars):');
  console.log((dump.visibleText || '').slice(0, 8000));
  console.log('ACCESSIBILITY SNAPSHOT:');
  console.log(dump.snapshot);
}

try {
  console.log('NETWORK CAPTURE: started before any app interaction');

  await page.goto(`${BASE_URL}/`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
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
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);

  console.log('SETUP: click Discovery nav');
  await page
    .getByRole('navigation', { name: /Основна навігація/i })
    .getByRole('link', { name: DISCOVERY_NAV_RE })
    .click({ timeout: 8000 });
  await page.waitForURL(/\/modules\/discovery/, { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(1000);

  console.log('SETUP: click Почати супроводжуваний шлях');
  await page.getByRole('dialog').getByRole('button', { name: GUIDED_RE }).click({ timeout: 8000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);

  console.log('SETUP: click Новый профиль');
  const newProfileBtn = page.getByRole('button', { name: NEW_PROFILE_RE });
  await newProfileBtn.first().waitFor({ state: 'visible', timeout: 15000 });
  await newProfileBtn.first().click({ timeout: 8000 });
  await page.getByRole('region', { name: /Создать профиль поиска/i }).waitFor({
    state: 'visible',
    timeout: 15000,
  });
  await page.waitForTimeout(1500);

  const typeCombo = page.getByRole('combobox', { name: TYPE_COMBO_RE });
  await typeCombo.waitFor({ state: 'visible', timeout: 15000 });
  const setupType = await typeCombo.evaluate(el => {
    if (el.tagName === 'SELECT') {
      const opt = el.options[el.selectedIndex];
      return {
        value: el.value,
        label: (opt?.textContent || '').replace(/\s+/g, ' ').trim(),
      };
    }
    return { value: el.value || null, label: (el.textContent || '').replace(/\s+/g, ' ').trim() };
  });
  const jobsSelected = JOBS_OPTION_RE.test(`${setupType.label} ${setupType.value}`);
  console.log('SETUP: create-profile form visible; profile type:', setupType);
  console.log('SETUP: Jobs/Работа currently selected:', jobsSelected ? 'YES' : 'NO');
  if (jobsSelected) {
    console.log('SETUP: default type is Работа — combobox not interacted with');
  } else {
    console.log('SETUP: type is not Работа; not changing it (single-action probe would be invalid)');
  }
  console.log('SETUP: name / country / role / schedule / email / save / execute NOT used');

  await page.waitForTimeout(500);
  const baseline = captured.slice();
  console.log('');
  console.log('========================================');
  console.log('PRE-ACTION NETWORK BASELINE');
  console.log('========================================');
  console.log('BASELINE REQUEST COUNT (interesting):', baseline.length);
  console.log(
    'BASELINE EXECUTION-LIKE:',
    baseline.filter(looksLikeExecution).length ? summarizeNetwork(baseline.filter(looksLikeExecution)) : 'None'
  );
  console.log(
    'BASELINE DISCOVERY API:',
    baseline.filter(looksLikeDiscoveryApi).length
      ? summarizeNetwork(baseline.filter(looksLikeDiscoveryApi))
      : 'None'
  );
  console.log(
    'BASELINE MUTATIONS:',
    baseline.filter(e => /\/api\/mutations/i.test(e.url)).length
      ? summarizeNetwork(baseline.filter(e => /\/api\/mutations/i.test(e.url)))
      : 'None'
  );
  console.log(
    'BASELINE PROFILE-MUTATION-LIKE:',
    baseline.filter(looksLikeProfileMutation).length
      ? summarizeNetwork(baseline.filter(looksLikeProfileMutation))
      : 'None'
  );

  console.log('');
  console.log('========================================');
  console.log('PROBE-002 / STEP 31 — DISCOVERY JOBS PROFILE NAME');
  console.log('========================================');
  console.log('INTENT/ACTION: type into Название профиля only; do not blur/submit/save/execute');

  const before = await dumpUi();
  logDump('BEFORE PROFILE NAME ENTRY', before);
  await page.screenshot({
    path: `${OUT}/step-31-before-profile-name.png`,
    fullPage: true,
  });
  console.log('SCREENSHOT BEFORE:', `${OUT}/step-31-before-profile-name.png`);

  const nameField = page.getByRole('textbox', { name: NAME_FIELD_RE });
  const nameVisible = await nameField.first().isVisible().catch(() => false);
  const nameEnabled = nameVisible ? await nameField.first().isEnabled().catch(() => false) : false;
  console.log('NAME FIELD VISIBLE/ENABLED:', nameVisible, nameEnabled);
  console.log('CREATE PROFILE BEFORE:', buttonEnabledLabel(before.createBtn), before.createBtn);
  console.log('SAVE EMAIL BEFORE:', buttonEnabledLabel(before.saveEmailBtn), before.saveEmailBtn);

  let actionMode = 'skipped';
  let actionError = null;
  if (!jobsSelected) {
    console.log('ACTION: SKIPPED — profile type is not Работа');
  } else if (!nameVisible || !nameEnabled) {
    console.log('ACTION: SKIPPED — Название профиля not available');
  } else {
    console.log(`ACTION: fill Название профиля with "${PROFILE_NAME_VALUE}". No Enter/blur/submit.`);
    phase = 'after-name-entry';
    try {
      await nameField.first().fill(PROFILE_NAME_VALUE);
      actionMode = 'fill';
      console.log('ACTION MODE: fill');
      await page.waitForTimeout(2000);
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    } catch (error) {
      actionMode = 'failed';
      actionError = String(error.message || error).slice(0, 800);
      console.log('ACTION MODE: failed; force NOT used; Enter NOT pressed');
      console.log('ACTION ERROR:', actionError);
    }
  }

  console.log('ACTION MODE USED:', actionMode);
  console.log('STOP: blur / Enter / create / save email / other fields / execute NOT USED');

  const after = await dumpUi();
  logDump('AFTER PROFILE NAME ENTRY', after);
  await page.screenshot({
    path: `${OUT}/step-31-after-profile-name.png`,
    fullPage: true,
  });

  await fs.writeFile(`${OUT}/step-31-profile-name-network.json`, JSON.stringify(captured, null, 2));

  const afterEntry = captured.filter(entry => entry.phase === 'after-name-entry');
  const executionAfter = afterEntry.filter(looksLikeExecution);
  const discoveryAfter = afterEntry.filter(looksLikeDiscoveryApi);
  const mutationsAfter = afterEntry.filter(e => /\/api\/mutations/i.test(e.url));
  const profileMutAfter = afterEntry.filter(looksLikeProfileMutation);
  const executeUrls = [...new Set(executionAfter.map(e => `${e.method} ${e.url}`))];
  const newFailures = requestFailures.filter(f => f.phase === 'after-name-entry');
  const rscPrefetchAborts = newFailures.filter(isRscPrefetchAbort);
  const otherFailures = newFailures.filter(failure => !isRscPrefetchAbort(failure));
  const urlChanged = before.url !== after.url;
  const autoExecution = executionAfter.length > 0;
  const profileMutation = profileMutAfter.length > 0;
  const networkObserved = afterEntry.length > 0;
  const errorsYes =
    consoleErrors.filter(e => e.phase === 'after-name-entry').length > 0 ||
    pageErrors.filter(e => e.phase === 'after-name-entry').length > 0 ||
    otherFailures.length > 0;
  const diff = compareForms(before.createForm || {}, after.createForm || {});
  const typeLabel = after.createForm.profileType
    ? `${after.createForm.profileType.label} (${after.createForm.profileType.value})`
    : 'unknown';
  const nameBefore = before.createForm.nameControl?.value ?? '';
  const nameAfter = after.createForm.nameControl?.value ?? '';
  const createBefore = buttonEnabledLabel(before.createBtn);
  const createAfter = buttonEnabledLabel(after.createBtn);
  const saveBefore = buttonEnabledLabel(before.saveEmailBtn);
  const saveAfter = buttonEnabledLabel(after.saveEmailBtn);
  const validationBefore = before.createForm.validationLike || [];
  const validationAfter = after.createForm.validationLike || [];
  const alertsChanged = JSON.stringify(before.alerts) !== JSON.stringify(after.alerts);
  const aiIndication = after.aiHits.some(h =>
    ['llm', 'openai', 'anthropic', 'provider', 'token', 'credit', 'credits', 'cost', 'generate', 'billable'].includes(
      h
    )
  );

  console.log('');
  console.log('--- STEP 31 COMPARISON ---');
  console.log('PROFILE TYPE:', typeLabel);
  console.log('NAME BEFORE:', JSON.stringify(nameBefore));
  console.log('NAME AFTER:', JSON.stringify(nameAfter));
  console.log('URL BEFORE:', before.url);
  console.log('URL AFTER:', after.url);
  console.log('NAVIGATION OCCURRED:', urlChanged ? 'YES' : 'NO');
  console.log('TITLE AFTER:', after.title);
  console.log('LANG BEFORE/AFTER:', before.lang, '→', after.lang);
  console.log('ACTION MODE USED:', actionMode);
  if (actionError) {
    console.log('ACTION ERROR:', actionError);
  }
  console.log('CREATE PROFILE BEFORE/AFTER:', createBefore, '→', createAfter);
  console.log('SAVE EMAIL BEFORE/AFTER:', saveBefore, '→', saveAfter);
  console.log('CANCEL BEFORE/AFTER:', buttonEnabledLabel(before.cancelBtn), '→', buttonEnabledLabel(after.cancelBtn));
  console.log('FIELDS ADDED:', diff.added.length ? diff.added : 'None');
  console.log('FIELDS REMOVED:', diff.removed.length ? diff.removed : 'None');
  console.log('FIELDS CHANGED:', diff.changed.length ? diff.changed : 'None');
  console.log('VALIDATION-LIKE BEFORE:', validationBefore.length ? validationBefore : 'None');
  console.log('VALIDATION-LIKE AFTER:', validationAfter.length ? validationAfter : 'None');
  console.log('ALERTS CHANGED:', alertsChanged ? 'YES' : 'NO');
  console.log('FOCUSED AFTER:', after.focused || 'none');
  console.log(
    'AFTER-NAME-ENTRY INTERESTING NETWORK:',
    afterEntry.length ? summarizeNetwork(afterEntry) : 'None'
  );
  console.log(
    'AFTER-NAME-ENTRY EXECUTION-LIKE:',
    executionAfter.length ? summarizeNetwork(executionAfter) : 'None'
  );
  console.log(
    'AFTER-NAME-ENTRY DISCOVERY API:',
    discoveryAfter.length ? summarizeNetwork(discoveryAfter) : 'None'
  );
  console.log(
    'AFTER-NAME-ENTRY MUTATIONS:',
    mutationsAfter.length ? summarizeNetwork(mutationsAfter) : 'None'
  );
  console.log(
    'AFTER-NAME-ENTRY PROFILE-MUTATION-LIKE:',
    profileMutAfter.length ? summarizeNetwork(profileMutAfter) : 'None'
  );
  if (autoExecution) {
    console.log(
      'Entering the Discovery profile name triggered an execution request. No further Discovery interaction was performed.'
    );
  } else if (!networkObserved) {
    console.log('Entering the Discovery profile name caused no observed network request.');
  } else {
    console.log('Entering the Discovery profile name caused observed network activity, but no execution request.');
  }
  console.log('NETWORK ARTIFACT:', `${OUT}/step-31-profile-name-network.json`);
  console.log(
    'CONSOLE ERRORS (after name entry):',
    consoleErrors.filter(e => e.phase === 'after-name-entry').length
      ? consoleErrors.filter(e => e.phase === 'after-name-entry')
      : 'None'
  );
  console.log(
    'PAGE ERRORS (after name entry):',
    pageErrors.filter(e => e.phase === 'after-name-entry').length
      ? pageErrors.filter(e => e.phase === 'after-name-entry')
      : 'None'
  );
  console.log('REQUEST FAILURES (after name entry):', newFailures.length ? newFailures : 'None');
  console.log(
    'RSC/PREFETCH ABORTS (technical observation):',
    rscPrefetchAborts.length ? rscPrefetchAborts : 'None'
  );
  console.log('OTHER REQUEST FAILURES (after name entry):', otherFailures.length ? otherFailures : 'None');
  console.log('SCREENSHOT AFTER:', `${OUT}/step-31-after-profile-name.png`);

  console.log('');
  console.log('========================================');
  console.log('STEP 31 SUMMARY');
  console.log('========================================');
  console.log('STEP: 31');
  console.log('profile type:', typeLabel);
  console.log('field edited: Название профиля');
  console.log('value entered:', PROFILE_NAME_VALUE);
  console.log('URL before:', before.url);
  console.log('URL after:', after.url);
  console.log('navigation yes/no:', urlChanged ? 'yes' : 'no');
  console.log('document language:', after.lang);
  console.log(
    'form state summary:',
    `name=${JSON.stringify(nameAfter)}; type=${typeLabel}; create=${createAfter}; saveEmail=${saveAfter}; changedFields=${diff.changed.length}`
  );
  console.log('Create Profile enabled/disabled before and after:', `${createBefore} → ${createAfter}`);
  console.log('Save Email enabled/disabled before and after:', `${saveBefore} → ${saveAfter}`);
  console.log(
    'validation/error changes:',
    `validationLike ${JSON.stringify(validationBefore)} → ${JSON.stringify(validationAfter)}; alertsChanged=${alertsChanged}`
  );
  console.log(
    'execution/search controls:',
    after.executeSearchBtns.length ? after.executeSearchBtns : 'None'
  );
  console.log(
    'AI/cost/provider indication yes/no:',
    aiIndication ? `yes (${after.aiHits.join(', ')})` : after.aiHits.length ? `no explicit (${after.aiHits.join(', ')})` : 'no'
  );
  console.log('network request observed yes/no:', networkObserved ? 'yes' : 'no');
  console.log('execution request observed yes/no:', autoExecution ? 'yes' : 'no');
  console.log('profile mutation observed yes/no:', profileMutation ? 'yes' : 'no');
  console.log('/api/mutations observed yes/no:', mutationsAfter.length ? 'yes' : 'no');
  console.log('errors yes/no:', errorsYes ? 'yes' : 'no');
  if (autoExecution) {
    console.log(
      'Entering the Discovery profile name triggered an execution request. No further Discovery interaction was performed.'
    );
  } else if (!networkObserved) {
    console.log('Entering the Discovery profile name caused no observed network request.');
  }
  console.log('artifact paths:');
  console.log(`  ${OUT}/step-31-before-profile-name.png`);
  console.log(`  ${OUT}/step-31-after-profile-name.png`);
  console.log(`  ${OUT}/step-31-profile-name-network.json`);
} finally {
  await browser.close();
}
