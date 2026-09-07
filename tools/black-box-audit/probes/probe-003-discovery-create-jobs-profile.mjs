import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE_URL = 'https://arrival-atlas.pro';
const OUT = 'tools/black-box-audit/artifacts/probe-003';
const DISCOVERY_NAV_RE = /Пошук|Поиск|Discovery/i;
const GUIDED_RE = /Почати супроводжуваний шлях/i;
const NEW_PROFILE_RE = /Новый профиль|Новий профіль|New profile/i;
const TYPE_COMBO_RE = /Работа \/ Розыгрыши|Jobs \/ Giveaways|Работа \/ Розіграші/i;
const JOBS_OPTION_RE = /Работа|Jobs/i;
const CREATE_PROFILE_RE = /Создать профиль|Create profile/i;
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
let seq = 0;
let phase = 'before-create';

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
    seq: seq + 1,
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
  return /\/execute|\/generate|\/recommend|openai|anthropic|\/ai\/|prompt|generation/i.test(blob);
}

function looksLikeDiscoveryApi(entry) {
  return /\/api\/modules\/discovery/i.test(entry.url);
}

function looksLikeProfileCreation(entry) {
  const write = /POST|PUT|PATCH/i.test(entry.method);
  const url = entry.url || '';
  const payload = String(entry.requestPayload || '');
  return (
    write &&
    (/\/api\/modules\/discovery\/profiles/i.test(url) ||
      (/\/api\/modules\/discovery/i.test(url) && /create|insert|saveProfile|createProfile/i.test(`${url} ${payload}`)))
  );
}

function looksLikeProfileRead(entry) {
  return /GET/i.test(entry.method) && /\/api\/modules\/discovery\/profiles/i.test(entry.url || '');
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
    payloadLooksLikeQueryOrPrompt: /prompt|query|search|generate|recommend|messages/i.test(payload),
    executionLike: looksLikeExecution(entry),
    profileCreationLike: looksLikeProfileCreation(entry),
    profileReadLike: looksLikeProfileRead(entry),
  };
}

function extractIds(value, acc = [], path = '') {
  if (value == null) {
    return acc;
  }
  if (typeof value === 'string') {
    try {
      return extractIds(JSON.parse(value), acc, path);
    } catch {
      return acc;
    }
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => extractIds(item, acc, `${path}[${i}]`));
    return acc;
  }
  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const next = path ? `${path}.${key}` : key;
      if (/^(id|profileId|profile_id|uuid)$/i.test(key) && (typeof child === 'string' || typeof child === 'number')) {
        acc.push({ path: next, value: child });
      } else {
        extractIds(child, acc, next);
      }
    }
  }
  return acc;
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
      responseBody = (await response.text()).slice(0, 8000);
    }
  } catch {
    responseBody = null;
  }
  seq += 1;
  const entry = {
    seq,
    phase,
    timestamp: new Date().toISOString(),
    method,
    url,
    status: response.status(),
    resourceType: request.resourceType(),
    requestPayload: request.postData() || null,
    responseBody,
  };
  entry.flags = classifyRequest(entry);
  entry.extractedIds = extractIds(responseBody);
  captured.push(entry);
}

page.on('response', response => {
  recordResponse(response).catch(() => {});
});

function summarizeNetwork(list) {
  return list.map(entry => ({
    seq: entry.seq,
    phase: entry.phase,
    timestamp: entry.timestamp,
    method: entry.method,
    status: entry.status,
    url: entry.url,
    flags: entry.flags,
    requestPayload: entry.requestPayload,
    extractedIds: entry.extractedIds,
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
            };
          }
          return {
            tag: el.tagName,
            value: el.value || null,
            label: (el.textContent || '').replace(/\s+/g, ' ').trim(),
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
      return [...root.querySelectorAll('input, textarea, select, button')].map(el => {
        const validity = el.validity
          ? {
              valid: el.validity.valid,
              valueMissing: el.validity.valueMissing,
            }
          : null;
        return {
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute('type'),
          id: el.id || null,
          name: el.getAttribute('name'),
          placeholder: el.getAttribute('placeholder'),
          label: labelFor(el).slice(0, 240),
          value: 'value' in el ? el.value : null,
          checked: el.type === 'checkbox' || el.type === 'radio' ? el.checked : undefined,
          disabled: Boolean(el.disabled) || el.getAttribute('aria-disabled') === 'true',
          required: Boolean(el.required),
          ariaInvalid: el.getAttribute('aria-invalid'),
          validationMessage: typeof el.validationMessage === 'string' ? el.validationMessage : null,
          validity,
          selectedOptions:
            el.tagName === 'SELECT'
              ? [...el.options]
                  .filter(o => o.selected)
                  .map(o => ({
                    value: o.value,
                    text: (o.textContent || '').replace(/\s+/g, ' ').trim(),
                  }))
              : undefined,
        };
      });
    })
    .catch(() => []);
  const headings = await first.locator('h1, h2, h3, h4, h5, h6').evaluateAll(els =>
    els.map(e => ({ tag: e.tagName, text: e.textContent.trim() }))
  );
  const text = await first.innerText().catch(() => '');
  const snapshot = await first.ariaSnapshot().catch(() => '');
  const nameControl = (controls || []).find(c => /Название профиля|Profile name/i.test(c.label || ''));
  const countryControl = (controls || []).find(c => /Код страны|Country/i.test(c.label || ''));
  const roleControl = (controls || []).find(c => /Желаемая роль|Desired role/i.test(c.label || ''));
  return {
    visible: true,
    headings,
    profileType,
    controls,
    nameControl,
    countryControl,
    roleControl,
    text: (text || '').replace(/\s+/g, ' ').trim(),
    snapshot,
  };
}

async function dumpProfilesRegion() {
  const region = page.getByRole('region', { name: /Ваши профили|Your profiles/i });
  const visible = await region.first().isVisible().catch(() => false);
  if (!visible) {
    return { visible: false, text: '', snapshot: '', buttons: [], items: [] };
  }
  const first = region.first();
  const buttons = await first.getByRole('button').evaluateAll(els =>
    els.map(el => ({
      text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
      pressed: el.getAttribute('aria-pressed'),
      disabled: el.disabled,
    }))
  );
  const items = await first.locator('[role="listitem"], li, article, button').evaluateAll(els =>
    els
      .map(el => ({
        tag: el.tagName,
        role: el.getAttribute('role'),
        text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 240),
      }))
      .filter(item => item.text)
      .slice(0, 20)
  );
  return {
    visible: true,
    text: ((await first.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim(),
    snapshot: await first.ariaSnapshot().catch(() => ''),
    buttons,
    items,
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
      pressed: el.getAttribute('aria-pressed'),
    }))
  );
  const snapshot = await page.locator('body').ariaSnapshot();
  const visibleText = await page.locator('body').innerText();
  const statusBanners = await page.locator('[role="status"]').allTextContents().catch(() => []);
  const alerts = await page.locator('[role="alert"]').allTextContents().catch(() => []);
  const arrivingFrom = await page.getByText(/Arriving from/i).allTextContents().catch(() => []);
  const dialog = await dumpDialog();
  const createForm = await dumpCreateForm();
  const profilesRegion = await dumpProfilesRegion();
  const createBtn = buttonByName(buttons, CREATE_PROFILE_RE);
  const cancelBtn = buttonByName(buttons, /Отмена|Скасувати|Cancel/i);
  const executeSearchBtns = buttons.filter(b =>
    /execute|search|поиск|пошук|discover|generate|find|рекоменд|найти|знайти|запусти/i.test(
      `${b.text} ${b.ariaLabel || ''}`
    )
  );
  const aiHits = findAiWording(`${visibleText}\n${snapshot}\n${createForm.text || ''}`);
  const successLike = (
    `${visibleText}\n${(statusBanners || []).join('\n')}\n${(alerts || []).join('\n')}`.match(
      /создан[^\n]{0,80}|створен[^\n]{0,80}|сохран[^\n]{0,80}|збереж[^\n]{0,80}|success[^\n]{0,80}|успеш[^\n]{0,80}/gi
    ) || []
  ).map(s => s.replace(/\s+/g, ' ').trim());
  const namedProfileVisible = await page.getByText(PROFILE_NAME_VALUE).first().isVisible().catch(() => false);
  const emptyStateVisible = /Профилей поиска пока нет|No search profiles/i.test(visibleText);
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
    arrivingFrom,
    dialog,
    createForm,
    profilesRegion,
    createBtn,
    cancelBtn,
    executeSearchBtns,
    aiHits,
    successLike: [...new Set(successLike)],
    namedProfileVisible,
    emptyStateVisible,
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
  console.log('COUNTRY CONTROL:', dump.createForm.countryControl || 'not found');
  console.log('ROLE CONTROL:', dump.createForm.roleControl || 'not found');
  console.log('CREATE PROFILE BUTTON:', dump.createBtn || 'not found');
  console.log('CANCEL BUTTON:', dump.cancelBtn || 'not found');
  console.log('CREATE FORM CONTROLS:', dump.createForm.controls || []);
  console.log('CREATE FORM TEXT:', (dump.createForm.text || '').slice(0, 4000));
  console.log('CREATE FORM SNAPSHOT:');
  console.log(dump.createForm.snapshot || 'n/a');
  console.log('PROFILES REGION:', dump.profilesRegion);
  console.log('NAMED PROFILE VISIBLE:', dump.namedProfileVisible ? 'YES' : 'NO');
  console.log('EMPTY STATE VISIBLE:', dump.emptyStateVisible ? 'YES' : 'NO');
  console.log('SUCCESS-LIKE TEXT:', dump.successLike.length ? dump.successLike : 'None');
  console.log('ARRIVING FROM:', dump.arrivingFrom.length ? dump.arrivingFrom : 'Not found');
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
  }
  console.log('SETUP: country / role / excluded / schedule / email NOT used');

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
    'BASELINE PROFILE-CREATION-LIKE:',
    baseline.filter(looksLikeProfileCreation).length
      ? summarizeNetwork(baseline.filter(looksLikeProfileCreation))
      : 'None'
  );

  console.log('');
  console.log('========================================');
  console.log('PROBE-002 / STEP 33 — CREATE ONE JOBS PROFILE');
  console.log('========================================');
  console.log('INTENT: fill name only, then click Создать профиль once; do not execute');

  const before = await dumpUi();
  logDump('BEFORE CREATE (EMPTY FORM)', before);
  await page.screenshot({
    path: `${OUT}/step-33-before-create.png`,
    fullPage: true,
  });
  console.log('SCREENSHOT BEFORE:', `${OUT}/step-33-before-create.png`);

  const nameField = page.getByRole('textbox', { name: NAME_FIELD_RE });
  const nameVisible = await nameField.first().isVisible().catch(() => false);
  const nameEnabled = nameVisible ? await nameField.first().isEnabled().catch(() => false) : false;
  const createBtn = page.getByRole('button', { name: CREATE_PROFILE_RE });
  const createVisible = await createBtn.first().isVisible().catch(() => false);
  console.log('NAME EMPTY BEFORE FILL:', JSON.stringify(before.createForm.nameControl?.value ?? ''));
  console.log('COUNTRY BEFORE FILL:', JSON.stringify(before.createForm.countryControl?.value ?? ''));
  console.log('CREATE PROFILE VISIBLE:', createVisible);

  let fillMode = 'skipped';
  let fillError = null;
  let nameValidity = null;
  if (!jobsSelected) {
    console.log('FILL: SKIPPED — profile type is not Работа');
  } else if (!nameVisible || !nameEnabled) {
    console.log('FILL: SKIPPED — Название профиля not available');
  } else {
    console.log(`FILL: Название профиля = "${PROFILE_NAME_VALUE}" only`);
    phase = 'after-name-fill';
    try {
      await nameField.first().fill(PROFILE_NAME_VALUE);
      fillMode = 'fill';
      nameValidity = await nameField.first().evaluate(el => ({
        value: el.value,
        valid: el.validity.valid,
        valueMissing: el.validity.valueMissing,
        validationMessage: el.validationMessage,
      }));
      console.log('FILL MODE: fill');
      console.log('NAME VALIDITY AFTER FILL:', nameValidity);
    } catch (error) {
      fillMode = 'failed';
      fillError = String(error.message || error).slice(0, 800);
      console.log('FILL FAILED:', fillError);
    }
  }

  const formReady =
    fillMode === 'fill' &&
    nameValidity &&
    nameValidity.value === PROFILE_NAME_VALUE &&
    nameValidity.valid === true;
  console.log('FORM READY FOR SUBMIT:', formReady ? 'YES' : 'NO');

  let clickMode = 'skipped';
  let clickError = null;
  if (!formReady) {
    console.log('CREATE CLICK: SKIPPED — form not ready');
  } else if (!createVisible) {
    console.log('CREATE CLICK: SKIPPED — Создать профиль not visible');
  } else {
    console.log('ACTION: click Создать профиль (normal). No retry. No execute.');
    phase = 'after-create';
    try {
      await createBtn.first().click({ timeout: 8000 });
      clickMode = 'normal';
      console.log('CLICK MODE: normal');
      await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(3000);
    } catch (error) {
      clickMode = 'failed';
      clickError = String(error.message || error).slice(0, 800);
      console.log('CLICK MODE: failed; force NOT used');
      console.log('CLICK ERROR:', clickError);
    }
  }

  console.log('FILL MODE USED:', fillMode);
  console.log('CLICK MODE USED:', clickMode);
  console.log('STOP: no second create, no execute, no open profile, no results');

  const after = await dumpUi();
  logDump('AFTER CREATE', after);
  await page.screenshot({
    path: `${OUT}/step-33-after-create.png`,
    fullPage: true,
  });

  await fs.writeFile(`${OUT}/step-33-create-jobs-profile-network.json`, JSON.stringify(captured, null, 2));

  const afterFill = captured.filter(entry => entry.phase === 'after-name-fill');
  const afterCreate = captured.filter(entry => entry.phase === 'after-create');
  const creationAfter = afterCreate.filter(looksLikeProfileCreation);
  const readAfter = afterCreate.filter(looksLikeProfileRead);
  const executionAfter = afterCreate.filter(looksLikeExecution);
  const mutationsAfter = afterCreate.filter(e => /\/api\/mutations/i.test(e.url));
  const discoveryAfter = afterCreate.filter(looksLikeDiscoveryApi);
  const executeUrls = [...new Set(executionAfter.map(e => `${e.method} ${e.url}`))];
  const creationEndpoints = creationAfter.map(e => `${e.method} ${e.url} → ${e.status}`);
  const newFailures = requestFailures.filter(f => f.phase === 'after-create');
  const rscPrefetchAborts = newFailures.filter(isRscPrefetchAbort);
  const otherFailures = newFailures.filter(failure => !isRscPrefetchAbort(failure));
  const urlChanged = before.url !== after.url;
  const autoExecution = executionAfter.length > 0;
  const creationRequest = creationAfter.length > 0;
  const errorsYes =
    consoleErrors.filter(e => e.phase === 'after-create').length > 0 ||
    pageErrors.filter(e => e.phase === 'after-create').length > 0 ||
    otherFailures.length > 0 ||
    (after.alerts || []).some(t => (t || '').trim());
  const typeLabel = before.createForm.profileType
    ? `${before.createForm.profileType.label} (${before.createForm.profileType.value})`
    : 'unknown';
  const createdIds = creationAfter.flatMap(e => e.extractedIds || []);
  const emptyBefore = before.emptyStateVisible;
  const emptyAfter = after.emptyStateVisible;
  const namedVisible = after.namedProfileVisible;
  let profileCreated = 'ambiguous';
  if (creationRequest && (namedVisible || !emptyAfter)) {
    profileCreated = 'yes';
  } else if (creationRequest && emptyAfter && !namedVisible) {
    profileCreated = 'creation request observed; list still empty';
  } else if (!creationRequest && namedVisible) {
    profileCreated = 'yes (UI shows named profile; no classified creation request)';
  } else if (!creationRequest && emptyAfter && !namedVisible) {
    profileCreated = 'no';
  }
  const aiIndication = after.aiHits.some(h =>
    ['llm', 'openai', 'anthropic', 'provider', 'token', 'credit', 'credits', 'cost', 'generate', 'billable'].includes(
      h
    )
  );

  console.log('');
  console.log('--- STEP 33 COMPARISON ---');
  console.log('PROFILE TYPE:', typeLabel);
  console.log('NAME ENTERED:', PROFILE_NAME_VALUE);
  console.log('URL BEFORE:', before.url);
  console.log('URL AFTER:', after.url);
  console.log('NAVIGATION OCCURRED:', urlChanged ? 'YES' : 'NO');
  console.log('TITLE AFTER:', after.title);
  console.log('LANG BEFORE/AFTER:', before.lang, '→', after.lang);
  console.log('FILL MODE:', fillMode);
  console.log('CLICK MODE:', clickMode);
  if (fillError) {
    console.log('FILL ERROR:', fillError);
  }
  if (clickError) {
    console.log('CLICK ERROR:', clickError);
  }
  console.log('CREATE FORM VISIBLE BEFORE/AFTER:', before.createForm.visible, '→', after.createForm.visible);
  console.log('EMPTY STATE BEFORE/AFTER:', emptyBefore, '→', emptyAfter);
  console.log('NAMED PROFILE VISIBLE AFTER:', namedVisible ? 'YES' : 'NO');
  console.log('PROFILES REGION AFTER:', after.profilesRegion.text);
  console.log('SUCCESS-LIKE AFTER:', after.successLike.length ? after.successLike : 'None');
  console.log('CREATED IDS FROM CREATION RESPONSES:', createdIds.length ? createdIds : 'None');
  console.log('PROFILE CREATED (OBSERVABLE):', profileCreated);
  console.log(
    'AFTER-NAME-FILL INTERESTING NETWORK:',
    afterFill.length ? summarizeNetwork(afterFill) : 'None'
  );
  console.log(
    'AFTER-CREATE INTERESTING NETWORK:',
    afterCreate.length ? summarizeNetwork(afterCreate) : 'None'
  );
  console.log(
    'AFTER-CREATE PROFILE-CREATION:',
    creationAfter.length ? summarizeNetwork(creationAfter) : 'None'
  );
  console.log('AFTER-CREATE PROFILE-READ:', readAfter.length ? summarizeNetwork(readAfter) : 'None');
  console.log(
    'AFTER-CREATE EXECUTION-LIKE:',
    executionAfter.length ? summarizeNetwork(executionAfter) : 'None'
  );
  console.log(
    'AFTER-CREATE DISCOVERY API:',
    discoveryAfter.length ? summarizeNetwork(discoveryAfter) : 'None'
  );
  console.log(
    'AFTER-CREATE MUTATIONS:',
    mutationsAfter.length ? summarizeNetwork(mutationsAfter) : 'None'
  );
  if (creationAfter.length) {
    for (const entry of creationAfter) {
      console.log('CREATION REQUEST PAYLOAD:', entry.requestPayload);
      console.log('CREATION RESPONSE BODY:', JSON.stringify(entry.responseBody)?.slice(0, 8000));
    }
  }
  console.log(
    autoExecution
      ? 'Creating the Jobs profile triggered an execution request. No further Discovery interaction was performed.'
      : 'Creating the Jobs profile caused no observed AI/execution request.'
  );
  console.log('NETWORK ARTIFACT:', `${OUT}/step-33-create-jobs-profile-network.json`);
  console.log(
    'CONSOLE ERRORS (after create):',
    consoleErrors.filter(e => e.phase === 'after-create').length
      ? consoleErrors.filter(e => e.phase === 'after-create')
      : 'None'
  );
  console.log(
    'PAGE ERRORS (after create):',
    pageErrors.filter(e => e.phase === 'after-create').length
      ? pageErrors.filter(e => e.phase === 'after-create')
      : 'None'
  );
  console.log('REQUEST FAILURES (after create):', newFailures.length ? newFailures : 'None');
  console.log(
    'RSC/PREFETCH ABORTS (technical observation):',
    rscPrefetchAborts.length ? rscPrefetchAborts : 'None'
  );
  console.log('OTHER REQUEST FAILURES (after create):', otherFailures.length ? otherFailures : 'None');
  console.log('SCREENSHOT AFTER:', `${OUT}/step-33-after-create.png`);

  console.log('');
  console.log('========================================');
  console.log('STEP 33 SUMMARY');
  console.log('========================================');
  console.log('STEP: 33');
  console.log('profile type:', typeLabel);
  console.log('profile name:', PROFILE_NAME_VALUE);
  console.log('URL before:', before.url);
  console.log('URL after:', after.url);
  console.log('navigation yes/no:', urlChanged ? 'yes' : 'no');
  console.log('document language:', after.lang);
  console.log('profile created yes/no/ambiguous:', profileCreated);
  console.log(
    'created profile ID if directly returned:',
    createdIds.length ? createdIds : 'None observed in creation response'
  );
  console.log(
    'resulting UI summary:',
    `formVisible=${after.createForm.visible}; emptyState=${emptyAfter}; namedProfileVisible=${namedVisible}; profilesText=${(after.profilesRegion.text || '').slice(0, 300)}`
  );
  console.log('profile list visible yes/no:', after.profilesRegion.visible ? 'yes' : 'no');
  console.log('created profile visible yes/no:', namedVisible ? 'yes' : 'no');
  console.log('success message yes/no:', after.successLike.length ? 'yes' : 'no');
  console.log('error yes/no:', errorsYes ? 'yes' : 'no');
  console.log('create form still visible yes/no:', after.createForm.visible ? 'yes' : 'no');
  console.log(
    'search/execution controls visible yes/no:',
    after.executeSearchBtns.length ? 'yes' : 'no'
  );
  console.log(
    'AI/cost/provider indication yes/no:',
    aiIndication ? `yes (${after.aiHits.join(', ')})` : after.aiHits.length ? `no explicit (${after.aiHits.join(', ')})` : 'no'
  );
  console.log('profile creation request observed yes/no:', creationRequest ? 'yes' : 'no');
  console.log('exact profile creation endpoint(s):', creationEndpoints.length ? creationEndpoints : 'None');
  console.log(
    'profile creation status:',
    creationAfter.length ? creationAfter.map(e => e.status) : 'n/a'
  );
  console.log('/api/mutations observed yes/no:', mutationsAfter.length ? 'yes' : 'no');
  console.log(
    'read/refresh requests after creation:',
    readAfter.length ? summarizeNetwork(readAfter) : 'None'
  );
  console.log('execution request observed yes/no:', autoExecution ? 'yes' : 'no');
  console.log('execution endpoint(s), if any:', executeUrls.length ? executeUrls : 'None');
  console.log(
    'AI/provider request observed yes/no:',
    afterCreate.some(e => /openai|anthropic|\/ai\//i.test(e.url)) ? 'yes' : 'no'
  );
  console.log(
    autoExecution
      ? 'Creating the Jobs profile triggered an execution request. No further Discovery interaction was performed.'
      : 'Creating the Jobs profile caused no observed AI/execution request.'
  );
  console.log('artifact paths:');
  console.log(`  ${OUT}/step-33-before-create.png`);
  console.log(`  ${OUT}/step-33-after-create.png`);
  console.log(`  ${OUT}/step-33-create-jobs-profile-network.json`);
} finally {
  await browser.close();
}
