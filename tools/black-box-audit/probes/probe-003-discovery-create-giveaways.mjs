import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE_URL = 'https://arrival-atlas.pro';
const OUT = 'tools/black-box-audit/artifacts/probe-003';
const DISCOVERY_NAV_RE = /Пошук|Поиск|Discovery/i;
const GUIDED_RE = /Почати супроводжуваний шлях/i;
const NEW_PROFILE_RE = /Новый профиль|Новий профіль|New profile/i;
const TYPE_COMBO_RE = /Работа \/ Розыгрыши|Jobs \/ Giveaways|Работа \/ Розіграші/i;
const GIVEAWAYS_OPTION_RE = /Розыгрыши|Розіграші|Giveaways/i;
const CREATE_PROFILE_RE = /Создать профиль|Create profile/i;
const NAME_FIELD_RE = /Название профиля|Profile name/i;
const PROFILE_NAME_VALUE = 'Мои розыгрыши';

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

page.on('requestfailed', request => {
  requestFailures.push({
    phase,
    seq: seq + 1,
    url: request.url(),
    method: request.method(),
    failure: request.failure()?.errorText ?? 'unknown',
  });
});

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

function hostnameOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function looksLikeExecution(entry) {
  const blob = `${entry.method} ${entry.url} ${entry.requestPayload || ''}`;
  return /\/execute|\/run(?!-summary)|\/generate|openai|anthropic|\/ai\/|prompt|generation/i.test(blob);
}

function looksLikeProvider(entry) {
  const host = hostnameOf(entry.url) || '';
  return /openai|anthropic|generativelanguage|groq|mistral|together|fireworks|openrouter|azure\.openai|bedrock|vertexai/i.test(
    `${host} ${entry.url}`
  );
}

function looksLikeDiscoveryApi(entry) {
  return /\/api\/modules\/discovery/i.test(entry.url);
}

function looksLikeProfileCreation(entry) {
  const write = /POST|PUT|PATCH/i.test(entry.method);
  const url = entry.url || '';
  return write && /\/api\/modules\/discovery\/profiles\/?(\?|$)/i.test(url);
}

function looksLikeProfileRead(entry) {
  return /GET/i.test(entry.method) && /\/api\/modules\/discovery\/profiles/i.test(entry.url || '');
}

function looksLikeResultsRead(entry) {
  return /GET/i.test(entry.method) && /\/results/i.test(entry.url || '') && /discovery/i.test(entry.url || '');
}

function looksLikeRunSummaryRead(entry) {
  return /GET/i.test(entry.method) && /run-summary/i.test(entry.url || '');
}

function classifyRequest(entry) {
  const payload = String(entry.requestPayload || '');
  return {
    languagePref: /\/api\/mutations/i.test(entry.url) && /preferredLanguage/i.test(payload),
    discoveryApi: /\/api\/modules\/discovery/i.test(entry.url),
    discoveryPage: /\/modules\/discovery/i.test(entry.url) && !/\/api\//.test(entry.url),
    execute: /\/execute/i.test(entry.url),
    runEndpoint: /\/run(?!-summary)/i.test(entry.url),
    mutations: /\/api\/mutations/i.test(entry.url),
    executionLike: looksLikeExecution(entry),
    providerLike: looksLikeProvider(entry),
    profileCreationLike: looksLikeProfileCreation(entry),
    profileReadLike: looksLikeProfileRead(entry),
    resultsReadLike: looksLikeResultsRead(entry),
    runSummaryReadLike: looksLikeRunSummaryRead(entry),
    unexpectedWrite:
      /PUT|PATCH|DELETE/i.test(entry.method) ||
      (/POST/i.test(entry.method) &&
        !looksLikeProfileCreation(entry) &&
        !/\/api\/mutations/i.test(entry.url) &&
        !/\/api\/session/i.test(entry.url)),
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

function countProfilesInBody(body) {
  if (!body || typeof body !== 'object') {
    return null;
  }
  if (Array.isArray(body.profiles)) {
    return body.profiles.length;
  }
  if (Array.isArray(body)) {
    return body.length;
  }
  return null;
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
    requestPayload: redactSecrets(request.postData() || null),
    responseBody: redactSecrets(responseBody),
  };
  entry.flags = classifyRequest(entry);
  entry.extractedIds = extractIds(responseBody);
  captured.push(entry);

  if (
    (phase === 'after-create' || phase === 'after-name-fill') &&
    (looksLikeExecution(entry) || looksLikeProvider(entry))
  ) {
    stopReason = `Unexpected execution/AI traffic: ${method} ${url} status=${response.status()}`;
  }
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
        required: Boolean(el.required),
        selectedOptions:
          el.tagName === 'SELECT'
            ? [...el.options]
                .filter(o => o.selected)
                .map(o => ({
                  value: o.value,
                  text: (o.textContent || '').replace(/\s+/g, ' ').trim(),
                }))
            : undefined,
        text: el.tagName === 'BUTTON' ? textOf(el).slice(0, 160) : undefined,
      }));
    })
    .catch(() => []);
  const headings = await first.locator('h1, h2, h3, h4, h5, h6').evaluateAll(els =>
    els.map(e => ({ tag: e.tagName, text: e.textContent.trim() }))
  );
  const nameControl = (controls || []).find(c => /Название профиля|Profile name/i.test(c.label || ''));
  const countryControl = (controls || []).find(c => /Код страны|Country/i.test(c.label || ''));
  return {
    visible: true,
    headings,
    profileType,
    controls,
    nameControl,
    countryControl,
    text: ((await first.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim(),
    snapshot: await first.ariaSnapshot().catch(() => ''),
  };
}

async function dumpProfilesRegion() {
  const region = page.getByRole('region', { name: /Ваши профили|Your profiles/i });
  const visible = await region.first().isVisible().catch(() => false);
  if (!visible) {
    return { visible: false, text: '', snapshot: '', buttons: [], items: [], cards: [] };
  }
  const first = region.first();
  const buttons = await first.getByRole('button').evaluateAll(els =>
    els.map(el => ({
      text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
      pressed: el.getAttribute('aria-pressed'),
      disabled: el.disabled,
    }))
  );
  const items = await first.locator('[role="listitem"], li, article').evaluateAll(els =>
    els
      .map(el => ({
        tag: el.tagName,
        role: el.getAttribute('role'),
        text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 400),
      }))
      .filter(item => item.text)
      .slice(0, 20)
  );
  const text = ((await first.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  const namedVisible = new RegExp(PROFILE_NAME_VALUE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(text);
  const cards = [];
  if (namedVisible) {
    cards.push({
      name: PROFILE_NAME_VALUE,
      typeGuess: /розыгрыш|giveaway|розыгрыши/i.test(text)
        ? 'giveaways'
        : /работ|jobs|поиск работы/i.test(text)
          ? 'jobs'
          : 'unknown',
      enabled: /ВКЛЮЧЁН|Включен|Enabled|Увімкнен/i.test(text),
      disabled: /ОТКЛЮЧЁН|Отключен|Disabled|Вимкнен/i.test(text),
    });
  }
  return {
    visible: true,
    text,
    snapshot: await first.ariaSnapshot().catch(() => ''),
    buttons,
    items,
    cards,
    namedVisible,
    emptyState: /Профилей поиска пока нет|No search profiles/i.test(text),
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
  const createForm = await dumpCreateForm();
  const profilesRegion = await dumpProfilesRegion();
  const successLike = (
    `${visibleText}\n${(await page.locator('[role="status"]').allTextContents().catch(() => [])).join('\n')}`.match(
      /создан[^\n]{0,80}|створен[^\n]{0,80}|сохран[^\n]{0,80}|збереж[^\n]{0,80}|success[^\n]{0,80}|успеш[^\n]{0,80}/gi
    ) || []
  ).map(s => s.replace(/\s+/g, ' ').trim());
  const lastRunText =
    (visibleText.match(/Последн[^\n]{0,80}|Останн[^\n]{0,80}|Last run[^\n]{0,80}|Запусков пока нет[^\n]{0,80}/gi) ||
      []
    ).map(s => s.replace(/\s+/g, ' ').trim());
  return {
    url: page.url(),
    title: await page.title(),
    lang: await page.locator('html').getAttribute('lang'),
    headings,
    buttons,
    snapshot,
    visibleText,
    statusBanners: await page.locator('[role="status"]').allTextContents().catch(() => []),
    alerts: await page.locator('[role="alert"]').allTextContents().catch(() => []),
    arrivingFrom: await page.getByText(/Arriving from/i).allTextContents().catch(() => []),
    createForm,
    profilesRegion,
    createBtn: buttonByName(buttons, CREATE_PROFILE_RE),
    cancelBtn: buttonByName(buttons, /Отмена|Скасувати|Cancel/i),
    executeSearchBtns: buttons.filter(b =>
      /запустить сейчас|выполняется|execute|generate|find|рекоменд/i.test(`${b.text} ${b.ariaLabel || ''}`)
    ),
    editBtns: buttons.filter(b => /изменить|редакт|edit criteria/i.test(`${b.text} ${b.ariaLabel || ''}`)),
    disableBtns: buttons.filter(b => /отключ|disable|вимкн/i.test(`${b.text} ${b.ariaLabel || ''}`)),
    aiHits: findAiWording(`${visibleText}\n${snapshot}`),
    successLike: [...new Set(successLike)],
    lastRunText,
    namedProfileVisible: await page.getByText(PROFILE_NAME_VALUE).first().isVisible().catch(() => false),
    emptyStateVisible: /Профилей поиска пока нет|No search profiles/i.test(visibleText),
    resultsEmpty: /Результатов пока нет|No results|Найденных результатов нет/i.test(visibleText),
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
  console.log('CREATE FORM VISIBLE:', dump.createForm.visible ? 'YES' : 'NO');
  console.log('PROFILE TYPE:', dump.createForm.profileType || 'not found');
  console.log('NAME CONTROL:', dump.createForm.nameControl || 'not found');
  console.log('COUNTRY CONTROL:', dump.createForm.countryControl || 'not found');
  console.log('CREATE PROFILE BUTTON:', dump.createBtn || 'not found');
  console.log('CANCEL BUTTON:', dump.cancelBtn || 'not found');
  console.log('CREATE FORM CONTROLS:', dump.createForm.controls || []);
  console.log('CREATE FORM TEXT:', (dump.createForm.text || '').slice(0, 4000));
  console.log('CREATE FORM SNAPSHOT:');
  console.log(dump.createForm.snapshot || 'n/a');
  console.log('PROFILES REGION:', dump.profilesRegion);
  console.log('NAMED PROFILE VISIBLE:', dump.namedProfileVisible ? 'YES' : 'NO');
  console.log('EMPTY STATE VISIBLE:', dump.emptyStateVisible ? 'YES' : 'NO');
  console.log('LAST-RUN TEXT:', dump.lastRunText.length ? dump.lastRunText : 'None');
  console.log('SUCCESS-LIKE TEXT:', dump.successLike.length ? dump.successLike : 'None');
  console.log('EXECUTE/SEARCH BUTTONS:', dump.executeSearchBtns.length ? dump.executeSearchBtns : 'None');
  console.log('EDIT BUTTONS:', dump.editBtns.length ? dump.editBtns : 'None');
  console.log('DISABLE BUTTONS:', dump.disableBtns.length ? dump.disableBtns : 'None');
  console.log('ARRIVING FROM:', dump.arrivingFrom.length ? dump.arrivingFrom : 'Not found');
  console.log('AI / COST / PROVIDER WORD HITS:', dump.aiHits.length ? dump.aiHits : 'None');
  console.log('LOADING:', dump.loading > 0 ? `YES (${dump.loading})` : 'None');
  console.log('ALERTS:', dump.alerts.length ? dump.alerts : 'None');
  console.log('MAIN VISIBLE TEXT (first 8000 chars):');
  console.log((dump.visibleText || '').slice(0, 8000));
  console.log('ACCESSIBILITY SNAPSHOT:');
  console.log(dump.snapshot);
}

try {
  console.log('NETWORK CAPTURE: started before opening Discovery');
  console.log('ONE WRITE: create Giveaways profile; do not execute');

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
  await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);

  console.log('SETUP: click Новый профиль');
  await page.getByRole('button', { name: NEW_PROFILE_RE }).first().click({ timeout: 8000 });
  await page.getByRole('region', { name: /Создать профиль поиска/i }).waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(1000);

  const typeCombo = page.getByRole('combobox', { name: TYPE_COMBO_RE });
  await typeCombo.waitFor({ state: 'visible', timeout: 15000 });
  const setupType = await typeCombo.evaluate(el => {
    if (el.tagName === 'SELECT') {
      const opt = el.options[el.selectedIndex];
      return { value: el.value, label: (opt?.textContent || '').replace(/\s+/g, ' ').trim() };
    }
    return { value: el.value || null, label: (el.textContent || '').trim() };
  });
  console.log('SETUP: default type:', setupType);

  console.log('SETUP: change type Работа → Розыгрыши (no other field)');
  phase = 'type-switch';
  await typeCombo.selectOption({ label: 'Розыгрыши' });
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1000);

  const afterSwitchType = await typeCombo.evaluate(el => {
    if (el.tagName === 'SELECT') {
      const opt = el.options[el.selectedIndex];
      return { value: el.value, label: (opt?.textContent || '').replace(/\s+/g, ' ').trim() };
    }
    return { value: el.value || null, label: (el.textContent || '').trim() };
  });
  const giveawaysSelected = GIVEAWAYS_OPTION_RE.test(`${afterSwitchType.label} ${afterSwitchType.value}`);
  console.log('SETUP: type after switch:', afterSwitchType, 'Giveaways:', giveawaysSelected ? 'YES' : 'NO');

  phase = 'pre-create';
  const before = await dumpUi();
  logDump('PRE-CREATE GIVEAWAYS FORM', before);
  await page.screenshot({ path: `${OUT}/step-39-before-create-giveaways.png`, fullPage: true });
  console.log('SCREENSHOT BEFORE:', `${OUT}/step-39-before-create-giveaways.png`);

  const nameField = page.getByRole('textbox', { name: NAME_FIELD_RE });
  const nameVisible = await nameField.first().isVisible().catch(() => false);
  const nameEnabled = nameVisible ? await nameField.first().isEnabled().catch(() => false) : false;
  const createBtn = page.getByRole('button', { name: CREATE_PROFILE_RE });
  const createVisible = await createBtn.first().isVisible().catch(() => false);

  let fillMode = 'skipped';
  let fillError = null;
  let nameValidity = null;
  if (!giveawaysSelected) {
    console.log('FILL: SKIPPED — type is not Розыгрыши');
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
  if (stopReason) {
    console.log('CREATE CLICK: SKIPPED —', stopReason);
  } else if (!formReady) {
    console.log('CREATE CLICK: SKIPPED — form not ready');
  } else if (!createVisible) {
    console.log('CREATE CLICK: SKIPPED — Создать профиль not visible');
  } else {
    console.log('ACTION: click Создать профиль once. No retry. No execute.');
    phase = 'after-create';
    try {
      await createBtn.first().click({ timeout: 8000 });
      clickMode = 'normal';
      await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(3000);
    } catch (error) {
      clickMode = 'failed';
      clickError = String(error.message || error).slice(0, 800);
      console.log('CLICK FAILED; force NOT used:', clickError);
    }
  }

  console.log('STOP: no edit, no execute, no second create');
  if (stopReason) {
    console.log('EARLY STOP REASON:', stopReason);
  }

  const after = await dumpUi();
  logDump('IMMEDIATE POST-CREATE', after);
  await page.screenshot({ path: `${OUT}/step-39-after-create-giveaways.png`, fullPage: true });
  await fs.writeFile(`${OUT}/step-39-create-giveaways-network.json`, JSON.stringify(captured, null, 2));

  const byPhase = name => captured.filter(e => e.phase === name);
  const setupNet = byPhase('setup');
  const typeSwitchNet = byPhase('type-switch');
  const fillNet = byPhase('after-name-fill');
  const afterCreate = byPhase('after-create');
  const creationAfter = afterCreate.filter(looksLikeProfileCreation);
  const readAfter = afterCreate.filter(looksLikeProfileRead);
  const resultsAfter = afterCreate.filter(looksLikeResultsRead);
  const runSummaryAfter = afterCreate.filter(looksLikeRunSummaryRead);
  const executionAfter = afterCreate.filter(looksLikeExecution);
  const providerAfter = afterCreate.filter(looksLikeProvider);
  const mutationsAfter = afterCreate.filter(e => /\/api\/mutations/i.test(e.url));
  const unexpectedWrites = afterCreate.filter(
    e =>
      /PUT|PATCH|DELETE/i.test(e.method) ||
      (/POST/i.test(e.method) && !looksLikeProfileCreation(e) && !/\/api\/mutations/i.test(e.url))
  );
  const urlChanged = before.url !== after.url;
  const createdIds = creationAfter.flatMap(e => e.extractedIds || []);
  const creationBody = creationAfter[0]?.responseBody || null;
  const creationPayload = creationAfter[0]?.requestPayload || null;
  let parsedPayload = creationPayload;
  try {
    parsedPayload = typeof creationPayload === 'string' ? JSON.parse(creationPayload) : creationPayload;
  } catch {
    parsedPayload = creationPayload;
  }
  const profileCountFromListGets = readAfter
    .map(e => countProfilesInBody(e.responseBody))
    .filter(n => n != null);
  const namedCount = await page.getByText(PROFILE_NAME_VALUE).count().catch(() => 0);
  const moreThanOne =
    (profileCountFromListGets.some(n => n > 1) && profileCountFromListGets[profileCountFromListGets.length - 1] > 1) ||
    namedCount > 2;
  if (moreThanOne) {
    stopReason = stopReason || 'More than one profile observed after create';
  }

  let profileCreated = 'ambiguous';
  if (creationAfter.length && (after.namedProfileVisible || !after.emptyStateVisible)) {
    profileCreated = 'yes';
  } else if (creationAfter.length && after.emptyStateVisible && !after.namedProfileVisible) {
    profileCreated = 'creation request observed; list still empty';
  } else if (!creationAfter.length && after.namedProfileVisible) {
    profileCreated = 'yes (UI shows named profile; no classified creation request)';
  } else if (!creationAfter.length && after.emptyStateVisible && !after.namedProfileVisible) {
    profileCreated = 'no';
  }

  const typeAfter = after.createForm.profileType
    ? `${after.createForm.profileType.label} (${after.createForm.profileType.value})`
    : after.profilesRegion.text.match(/розыгрыш[^\s,]*/i)?.[0] || 'see profile card';
  const costSafety =
    executionAfter.length === 0 && providerAfter.length === 0
      ? 'Creating the Giveaways profile caused no observed AI/execution request.'
      : 'Creating the Giveaways profile triggered an execution/AI request. No further Discovery interaction was performed.';

  console.log('');
  console.log('--- STEP 39 NETWORK ---');
  console.log('A SETUP:', setupNet.length);
  console.log('B TYPE-SWITCH:', typeSwitchNet.length ? summarizeNetwork(typeSwitchNet) : 'None');
  console.log('C NAME FILL:', fillNet.length ? summarizeNetwork(fillNet) : 'None');
  console.log('D AFTER-CREATE ALL:', afterCreate.length ? summarizeNetwork(afterCreate) : 'None');
  console.log('CREATION:', creationAfter.length ? summarizeNetwork(creationAfter) : 'None');
  console.log('CREATION REQUEST PAYLOAD:', parsedPayload);
  if (creationAfter.length) {
    console.log('CREATION RESPONSE BODY:', JSON.stringify(creationBody)?.slice(0, 8000));
  }
  console.log('POST-CREATE PROFILE READS:', readAfter.length ? summarizeNetwork(readAfter) : 'None');
  console.log('POST-CREATE RESULTS READS:', resultsAfter.length ? summarizeNetwork(resultsAfter) : 'None');
  console.log('POST-CREATE RUN-SUMMARY READS:', runSummaryAfter.length ? summarizeNetwork(runSummaryAfter) : 'None');
  console.log('EXECUTION-LIKE:', executionAfter.length ? summarizeNetwork(executionAfter) : 'None');
  console.log('PROVIDER-LIKE:', providerAfter.length ? summarizeNetwork(providerAfter) : 'None');
  console.log('MUTATIONS AFTER CREATE:', mutationsAfter.length ? summarizeNetwork(mutationsAfter) : 'None');
  console.log('UNEXPECTED WRITES AFTER CREATE:', unexpectedWrites.length ? summarizeNetwork(unexpectedWrites) : 'None');
  console.log(costSafety);

  console.log('');
  console.log('========================================');
  console.log('STEP 39 SUMMARY');
  console.log('========================================');
  console.log('STEP: 39');
  console.log('profile ID:', createdIds.length ? createdIds : 'None observed');
  console.log('profile name:', PROFILE_NAME_VALUE);
  console.log('profile type:', typeAfter);
  console.log('URL before:', before.url);
  console.log('URL after:', after.url);
  console.log('navigation:', urlChanged ? 'yes' : 'no');
  console.log('lang:', after.lang);
  console.log('creation result:', profileCreated);
  console.log('fill mode:', fillMode);
  console.log('click mode:', clickMode);
  if (fillError) console.log('fill error:', fillError);
  if (clickError) console.log('click error:', clickError);
  if (stopReason) console.log('stop reason:', stopReason);
  console.log('profile status / card:', after.profilesRegion.text);
  console.log('create form still visible:', after.createForm.visible ? 'yes' : 'no');
  console.log('empty state after:', after.emptyStateVisible ? 'yes' : 'no');
  console.log('named profile visible:', after.namedProfileVisible ? 'yes' : 'no');
  console.log('named text count:', namedCount);
  console.log('last run:', after.lastRunText.length ? after.lastRunText : 'None observed');
  console.log('results:', after.resultsEmpty ? 'empty-state copy present' : 'see visible text');
  console.log('success/error:', { success: after.successLike, alerts: after.alerts });
  console.log('execution controls:', after.executeSearchBtns.length ? after.executeSearchBtns : 'None');
  console.log('available actions:', {
    execute: after.executeSearchBtns,
    edit: after.editBtns,
    disable: after.disableBtns,
    newProfile: after.buttons.filter(b => /Новый профиль/i.test(b.text)),
  });
  console.log('creation request:', creationAfter.length ? summarizeNetwork(creationAfter) : 'None');
  console.log('creation payload:', parsedPayload);
  console.log('creation response:', creationBody);
  console.log('post-create reads:', {
    profiles: readAfter.length,
    results: resultsAfter.length,
    runSummary: runSummaryAfter.length,
  });
  console.log('execution/AI/provider traffic:', executionAfter.length || providerAfter.length ? 'YES' : 'None');
  console.log('unexpected writes:', unexpectedWrites.length ? unexpectedWrites : 'None');
  console.log(costSafety);
  console.log('artifact paths:');
  console.log(`  ${OUT}/step-39-before-create-giveaways.png`);
  console.log(`  ${OUT}/step-39-after-create-giveaways.png`);
  console.log(`  ${OUT}/step-39-create-giveaways-network.json`);
} finally {
  await browser.close();
}
