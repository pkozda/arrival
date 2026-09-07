import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE_URL = 'https://arrival-atlas.pro';
const OUT = 'tools/black-box-audit/artifacts/probe-003';
const DISCOVERY_NAV_RE = /Пошук|Поиск|Discovery/i;
const GUIDED_RE = /Почати супроводжуваний шлях/i;
const NEW_PROFILE_RE = /Новый профиль|Новий профіль|New profile/i;
const TYPE_COMBO_RE = /Работа \/ Розыгрыши|Jobs \/ Giveaways|Работа \/ Розіграші/i;
const CREATE_PROFILE_RE = /Создать профиль|Create profile/i;
const NAME_FIELD_RE = /Название профиля|Profile name/i;
const ROLE_FIELD_RE = /Желаемая роль|Desired role/i;
const EDIT_CRITERIA_RE = /Изменить критерии|Змінити критерії|Edit criteria/i;
const SAVE_CHANGES_RE = /Сохранить изменения|Зберегти зміни|Save changes/i;
const RUN_NOW_RE = /Запустить сейчас|Запустити зараз|Run now/i;
const PROFILE_NAME_VALUE = 'Мой поиск работы';
const ROLE_VALUE = 'Frontend Developer';
const JOBS_TYPE_RE = /Поиск работы|Пошук роботи|Jobs/i;

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

function looksLikeProfileRead(entry) {
  return /GET/i.test(entry.method) && /\/api\/modules\/discovery\/profiles/i.test(entry.url || '');
}

function looksLikeProfileWrite(entry) {
  return (
    /POST|PUT|PATCH|DELETE/i.test(entry.method) &&
    /\/api\/modules\/discovery\/profiles/i.test(entry.url || '')
  );
}

function looksLikeResultsRead(entry) {
  return /GET/i.test(entry.method) && /\/results/i.test(entry.url || '');
}

function looksLikeRunSummaryRead(entry) {
  return /GET/i.test(entry.method) && /run-summary/i.test(entry.url || '');
}

function classifyRequest(entry) {
  const payload = String(entry.requestPayload || '');
  return {
    discoveryApi: /\/api\/modules\/discovery/i.test(entry.url),
    execute: /\/execute/i.test(entry.url),
    mutations: /\/api\/mutations/i.test(entry.url),
    writeMethod: /POST|PUT|PATCH|DELETE/i.test(entry.method),
    payloadLooksLikeQueryOrPrompt: /prompt|query|search|generate|recommend|messages/i.test(payload),
    executionLike: looksLikeExecution(entry),
    profileReadLike: looksLikeProfileRead(entry),
    profileWriteLike: looksLikeProfileWrite(entry),
    resultsReadLike: looksLikeResultsRead(entry),
    runSummaryReadLike: looksLikeRunSummaryRead(entry),
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
      if (
        /^(id|profileId|profile_id|uuid|version|revision|updatedAt|createdAt)$/i.test(key) &&
        (typeof child === 'string' || typeof child === 'number')
      ) {
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

function fieldByLabel(fields, re) {
  return (fields || []).find(f => re.test(f.label || '')) || null;
}

async function dumpFields(scope) {
  return scope
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
        readOnly: Boolean(el.readOnly),
        ariaInvalid: el.getAttribute('aria-invalid'),
        validationMessage: typeof el.validationMessage === 'string' ? el.validationMessage : null,
        text: el.tagName === 'BUTTON' ? textOf(el).slice(0, 160) : undefined,
      }));
    })
    .catch(() => []);
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
    }))
  );
  const snapshot = await page.locator('body').ariaSnapshot();
  const visibleText = await page.locator('body').innerText();
  const statusBanners = await page.locator('[role="status"]').allTextContents().catch(() => []);
  const alerts = await page.locator('[role="alert"]').allTextContents().catch(() => []);
  const arrivingFrom = await page.getByText(/Arriving from/i).allTextContents().catch(() => []);
  const dialogVisible = await page.getByRole('dialog').first().isVisible().catch(() => false);
  const fields = await dumpFields(page.locator('body'));
  const editorVisible = await page.getByRole('heading', { name: /Изменить критерии профиля/i }).first().isVisible().catch(() => false);
  const namedProfileVisible = await page.getByText(PROFILE_NAME_VALUE).first().isVisible().catch(() => false);
  const roleValueVisible = await page.getByText(ROLE_VALUE).first().isVisible().catch(() => false);
  const jobsTypeVisible = await page.getByText(JOBS_TYPE_RE).first().isVisible().catch(() => false);
  const enabledVisible = /Включён|ВКЛЮЧЁН|Enabled/i.test(visibleText);
  const lastRunNone = /Запусков пока нет|No runs yet/i.test(visibleText);
  const resultsNone = /результатов пока нет|no results/i.test(visibleText);
  const lastRunVisible = /Последний запуск|Last run/i.test(visibleText);
  const resultsHeadingVisible = /Результаты|Results/i.test(visibleText);
  const saveBtn = buttonByName(buttons, SAVE_CHANGES_RE);
  const cancelBtn = buttonByName(buttons, /Отмена|Скасувати|Cancel/i);
  const runBtn = buttonByName(buttons, RUN_NOW_RE);
  const editBtn = buttonByName(buttons, EDIT_CRITERIA_RE);
  const dirtyLike = (
    `${visibleText}\n${snapshot}`.match(
      /изменен[^\n]{0,40}|змінен[^\n]{0,40}|unsaved[^\n]{0,40}|dirty[^\n]{0,40}|не сохран[^\n]{0,40}/gi
    ) || []
  ).map(s => s.replace(/\s+/g, ' ').trim());
  const successLike = (
    `${visibleText}\n${(statusBanners || []).join('\n')}`.match(
      /сохран[^\n]{0,80}|збереж[^\n]{0,80}|success[^\n]{0,80}|успеш[^\n]{0,80}|updated[^\n]{0,80}|оновлен[^\n]{0,80}/gi
    ) || []
  ).map(s => s.replace(/\s+/g, ' ').trim());
  const aiHits = findAiWording(`${visibleText}\n${snapshot}`);
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
    dialogVisible,
    fields,
    nameField: fieldByLabel(fields, /Название профиля|Profile name/i),
    countryField: fieldByLabel(fields, /Код страны|Country/i),
    roleField: fieldByLabel(fields, ROLE_FIELD_RE),
    editorVisible,
    namedProfileVisible,
    roleValueVisible,
    jobsTypeVisible,
    enabledVisible,
    lastRunNone,
    resultsNone,
    lastRunVisible,
    resultsHeadingVisible,
    saveBtn,
    cancelBtn,
    runBtn,
    editBtn,
    dirtyLike: [...new Set(dirtyLike)],
    successLike: [...new Set(successLike)],
    aiHits,
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
  console.log('EDITOR VISIBLE:', dump.editorVisible ? 'YES' : 'NO');
  console.log('NAME FIELD:', dump.nameField || 'not found');
  console.log('COUNTRY FIELD:', dump.countryField || 'not found');
  console.log('ROLE FIELD:', dump.roleField || 'not found');
  console.log('ALL INPUT/SELECT/TEXTAREA FIELDS:', (dump.fields || []).filter(f => ['input', 'textarea', 'select'].includes(f.tag)));
  console.log('SAVE BUTTON:', dump.saveBtn || 'not found');
  console.log('CANCEL BUTTON:', dump.cancelBtn || 'not found');
  console.log('RUN NOW BUTTON:', dump.runBtn || 'not found');
  console.log('EDIT CRITERIA BUTTON:', dump.editBtn || 'not found');
  console.log('DIRTY-LIKE TEXT:', dump.dirtyLike.length ? dump.dirtyLike : 'None');
  console.log('SUCCESS-LIKE TEXT:', dump.successLike.length ? dump.successLike : 'None');
  console.log('ROLE VALUE VISIBLE IN PAGE:', dump.roleValueVisible ? 'YES' : 'NO');
  console.log('NAMED PROFILE VISIBLE:', dump.namedProfileVisible ? 'YES' : 'NO');
  console.log('JOBS TYPE VISIBLE:', dump.jobsTypeVisible ? 'YES' : 'NO');
  console.log('ENABLED VISIBLE:', dump.enabledVisible ? 'YES' : 'NO');
  console.log('LAST RUN NONE:', dump.lastRunNone ? 'YES' : 'NO');
  console.log('RESULTS NONE:', dump.resultsNone ? 'YES' : 'NO');
  console.log('ARRIVING FROM:', dump.arrivingFrom.length ? dump.arrivingFrom : 'Not found');
  console.log('AI / COST / PROVIDER WORD HITS:', dump.aiHits.length ? dump.aiHits : 'None');
  console.log('LOADING:', dump.loading > 0 ? `YES (${dump.loading})` : 'None');
  console.log('ALERTS:', dump.alerts.length ? dump.alerts : 'None');
  console.log('STATUS BANNERS:', dump.statusBanners.length ? dump.statusBanners : 'None');
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
  await settle();

  console.log('SETUP: click Discovery nav');
  await page
    .getByRole('navigation', { name: /Основна навігація/i })
    .getByRole('link', { name: DISCOVERY_NAV_RE })
    .click({ timeout: 8000 });
  await page.waitForURL(/\/modules\/discovery/, { timeout: 15000 }).catch(() => {});
  await settle();

  const welcome = page.getByRole('dialog');
  if (await welcome.first().isVisible().catch(() => false)) {
    console.log('SETUP: click Почати супроводжуваний шлях');
    await welcome.getByRole('button', { name: GUIDED_RE }).click({ timeout: 8000 });
    await welcome.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    await settle();
  }

  let namedVisible = await page.getByText(PROFILE_NAME_VALUE).first().isVisible().catch(() => false);
  console.log('SETUP: named profile visible:', namedVisible ? 'YES' : 'NO');
  if (!namedVisible) {
    console.log('SETUP: recreate Jobs profile (name only). NOT STEP 35.');
    await page.getByRole('button', { name: NEW_PROFILE_RE }).first().click({ timeout: 8000 });
    await page.getByRole('region', { name: /Создать профиль поиска/i }).waitFor({
      state: 'visible',
      timeout: 15000,
    });
    await page.waitForTimeout(1000);
    const typeCombo = page.getByRole('combobox', { name: TYPE_COMBO_RE });
    const setupType = await typeCombo.evaluate(el => {
      if (el.tagName === 'SELECT') {
        const opt = el.options[el.selectedIndex];
        return { value: el.value, label: (opt?.textContent || '').replace(/\s+/g, ' ').trim() };
      }
      return { value: el.value || null, label: (el.textContent || '').replace(/\s+/g, ' ').trim() };
    });
    console.log('SETUP recreate type:', setupType);
    await page.getByRole('textbox', { name: NAME_FIELD_RE }).fill(PROFILE_NAME_VALUE);
    await page.getByRole('button', { name: CREATE_PROFILE_RE }).click({ timeout: 8000 });
    await settle();
    await page.waitForTimeout(2000);
    namedVisible = await page.getByText(PROFILE_NAME_VALUE).first().isVisible().catch(() => false);
    console.log('SETUP: named profile visible after recreate:', namedVisible ? 'YES' : 'NO');
  }

  if (!(await page.getByRole('button', { name: EDIT_CRITERIA_RE }).first().isVisible().catch(() => false))) {
    console.log('SETUP: select profile');
    await page.getByRole('button', { name: new RegExp(PROFILE_NAME_VALUE, 'i') }).first().click({ timeout: 8000 });
    await settle();
  }

  console.log('SETUP: click Изменить критерии (setup/editor-open, not the save action)');
  phase = 'after-editor-open';
  await page.getByRole('button', { name: EDIT_CRITERIA_RE }).first().click({ timeout: 8000 });
  await settle();
  await page.getByRole('heading', { name: /Изменить критерии профиля/i }).waitFor({
    state: 'visible',
    timeout: 10000,
  });
  console.log('SETUP: Запустить сейчас will NOT be clicked');

  const baseline = await dumpUi();
  logDump('BASELINE (EDITOR OPEN, BEFORE ROLE CHANGE)', baseline);
  await page.screenshot({
    path: `${OUT}/step-35-before-role-change.png`,
    fullPage: true,
  });
  console.log('SCREENSHOT BASELINE:', `${OUT}/step-35-before-role-change.png`);
  console.log('BASELINE ROLE:', JSON.stringify(baseline.roleField?.value ?? ''));
  console.log('LAST RUN NONE:', baseline.lastRunNone ? 'YES' : 'NO');
  console.log('RESULTS NONE:', baseline.resultsNone ? 'YES' : 'NO');
  console.log('SAVE BEFORE CHANGE:', baseline.saveBtn);
  console.log('RUN NOW VISIBLE:', baseline.runBtn ? 'YES' : 'NO');

  const roleField = page.getByRole('textbox', { name: ROLE_FIELD_RE });
  const roleVisible = await roleField.first().isVisible().catch(() => false);
  const roleEnabled = roleVisible ? await roleField.first().isEnabled().catch(() => false) : false;
  console.log('ROLE FIELD VISIBLE/ENABLED:', roleVisible, roleEnabled);

  let fillMode = 'skipped';
  let fillError = null;
  if (!roleVisible || !roleEnabled) {
    console.log('ROLE CHANGE: SKIPPED — field not available');
  } else {
    console.log(`ROLE CHANGE: set Желаемая роль = "${ROLE_VALUE}" only`);
    phase = 'after-role-change';
    try {
      await roleField.first().fill(ROLE_VALUE);
      fillMode = 'fill';
      await page.waitForTimeout(800);
    } catch (error) {
      fillMode = 'failed';
      fillError = String(error.message || error).slice(0, 800);
      console.log('FILL FAILED:', fillError);
    }
  }

  const afterChange = await dumpUi();
  logDump('AFTER ROLE CHANGE, BEFORE SAVE', afterChange);
  await page.screenshot({
    path: `${OUT}/step-35-after-role-change-before-save.png`,
    fullPage: true,
  });
  console.log('SCREENSHOT AFTER ROLE CHANGE:', `${OUT}/step-35-after-role-change-before-save.png`);
  console.log('ROLE AFTER CHANGE:', JSON.stringify(afterChange.roleField?.value ?? ''));
  console.log('SAVE AFTER CHANGE:', afterChange.saveBtn);
  console.log('CANCEL AFTER CHANGE:', afterChange.cancelBtn);
  console.log('DIRTY-LIKE AFTER CHANGE:', afterChange.dirtyLike.length ? afterChange.dirtyLike : 'None');

  const saveBtn = page.getByRole('button', { name: SAVE_CHANGES_RE });
  const saveVisible = await saveBtn.first().isVisible().catch(() => false);
  const saveEnabled = saveVisible ? await saveBtn.first().isEnabled().catch(() => false) : false;
  const roleReady = afterChange.roleField?.value === ROLE_VALUE;
  console.log('SAVE TARGET VISIBLE/ENABLED:', saveVisible, saveEnabled);
  console.log('ROLE READY:', roleReady ? 'YES' : 'NO');

  let saveMode = 'skipped';
  let saveError = null;
  if (fillMode !== 'fill' || !roleReady || !saveVisible) {
    console.log('SAVE: SKIPPED');
  } else {
    console.log('ACTION: click Сохранить изменения (normal). No retry. No run.');
    phase = 'after-save';
    try {
      await saveBtn.first().click({ timeout: 8000 });
      saveMode = 'normal';
      console.log('SAVE CLICK MODE: normal');
      await settle();
      await page.waitForTimeout(2500);
    } catch (error) {
      saveMode = 'failed';
      saveError = String(error.message || error).slice(0, 800);
      console.log('SAVE CLICK FAILED; force NOT used');
      console.log('SAVE ERROR:', saveError);
    }
  }

  console.log('FILL MODE:', fillMode);
  console.log('SAVE MODE:', saveMode);
  console.log('STOP: no reopen editor / refresh / run / second edit');

  const afterSave = await dumpUi();
  logDump('AFTER SAVE', afterSave);
  await page.screenshot({
    path: `${OUT}/step-35-after-save.png`,
    fullPage: true,
  });

  await fs.writeFile(`${OUT}/step-35-save-network.json`, JSON.stringify(captured, null, 2));

  const setupNet = captured.filter(e => e.phase === 'setup');
  const editorNet = captured.filter(e => e.phase === 'after-editor-open');
  const changeNet = captured.filter(e => e.phase === 'after-role-change');
  const saveNet = captured.filter(e => e.phase === 'after-save');
  const saveWrites = saveNet.filter(e => /POST|PUT|PATCH|DELETE/i.test(e.method));
  const saveProfileWrites = saveNet.filter(looksLikeProfileWrite);
  const saveMutations = saveNet.filter(e => /\/api\/mutations/i.test(e.url));
  const postSaveReads = saveNet.filter(e => /GET/i.test(e.method));
  const postSaveResults = saveNet.filter(looksLikeResultsRead);
  const postSaveRunSummary = saveNet.filter(looksLikeRunSummaryRead);
  const execution = saveNet.filter(looksLikeExecution);
  const aiProvider = saveNet.filter(e => /openai|anthropic|\/ai\//i.test(e.url));
  const urlChanged = baseline.url !== afterSave.url;
  const autoExecution = execution.length > 0;
  const saveIds = saveProfileWrites.flatMap(e => e.extractedIds || []);
  const profileId =
    saveIds.find(x => /profile\.id$|id$/i.test(x.path))?.value ||
    setupNet.concat(editorNet).flatMap(e => e.extractedIds || []).find(x => /profile\.id$/.test(x.path))?.value ||
    null;

  if (autoExecution) {
    console.log('STOP: execution-like request after save. No further interaction.');
    for (const entry of execution) {
      console.log('EXECUTION REQUEST:', summarizeNetwork([entry]));
      console.log('EXECUTION RESPONSE:', JSON.stringify(entry.responseBody)?.slice(0, 4000));
    }
  }

  console.log('');
  console.log('--- STEP 35 COMPARISON ---');
  console.log('URL BEFORE:', baseline.url);
  console.log('URL AFTER SAVE:', afterSave.url);
  console.log('NAVIGATION:', urlChanged ? 'YES' : 'NO');
  console.log('LANG:', afterSave.lang);
  console.log('FILL MODE:', fillMode);
  console.log('SAVE MODE:', saveMode);
  if (fillError) console.log('FILL ERROR:', fillError);
  if (saveError) console.log('SAVE ERROR:', saveError);
  console.log('BASELINE ROLE:', JSON.stringify(baseline.roleField?.value ?? ''));
  console.log('CHANGED ROLE IN EDITOR:', JSON.stringify(afterChange.roleField?.value ?? ''));
  console.log('ROLE VISIBLE AFTER SAVE (no editor reopen):', afterSave.roleValueVisible ? 'YES' : 'NO');
  console.log('EDITOR OPEN BEFORE/AFTER SAVE:', baseline.editorVisible, '→', afterSave.editorVisible);
  console.log('SUCCESS-LIKE AFTER SAVE:', afterSave.successLike.length ? afterSave.successLike : 'None');
  console.log('ALERTS AFTER SAVE:', afterSave.alerts);
  console.log('LAST RUN AFTER SAVE NONE:', afterSave.lastRunNone ? 'YES' : 'NO');
  console.log('RESULTS AFTER SAVE NONE:', afterSave.resultsNone ? 'YES' : 'NO');
  console.log('RUN NOW AFTER SAVE:', afterSave.runBtn || 'not found');
  console.log('A SETUP REQUESTS:', setupNet.length ? summarizeNetwork(setupNet) : 'None classified in setup phase');
  console.log('B FIELD-CHANGE REQUESTS:', changeNet.length ? summarizeNetwork(changeNet) : 'None');
  console.log('C SAVE WRITES:', saveWrites.length ? summarizeNetwork(saveWrites) : 'None');
  console.log('C SAVE PROFILE WRITES:', saveProfileWrites.length ? summarizeNetwork(saveProfileWrites) : 'None');
  console.log('C SAVE MUTATIONS:', saveMutations.length ? summarizeNetwork(saveMutations) : 'None');
  console.log('D POST-SAVE READS:', postSaveReads.length ? summarizeNetwork(postSaveReads) : 'None');
  console.log('D POST-SAVE RESULTS:', postSaveResults.length ? summarizeNetwork(postSaveResults) : 'None');
  console.log('D POST-SAVE RUN-SUMMARY:', postSaveRunSummary.length ? summarizeNetwork(postSaveRunSummary) : 'None');
  console.log('E EXECUTION/AI AFTER SAVE:', execution.length || aiProvider.length ? summarizeNetwork([...execution, ...aiProvider]) : 'None');
  if (saveProfileWrites.length) {
    for (const entry of saveProfileWrites) {
      console.log('SAVE REQUEST:', `${entry.method} ${entry.url} → ${entry.status}`);
      console.log('SAVE PAYLOAD:', entry.requestPayload);
      console.log('SAVE RESPONSE:', JSON.stringify(entry.responseBody)?.slice(0, 8000));
    }
  }
  console.log(
    autoExecution
      ? 'Saving the Jobs profile criteria triggered an execution request. No further Discovery interaction was performed.'
      : 'Saving the Jobs profile criteria caused no observed AI/execution request.'
  );
  console.log('NETWORK ARTIFACT:', `${OUT}/step-35-save-network.json`);
  console.log('SCREENSHOT AFTER SAVE:', `${OUT}/step-35-after-save.png`);

  console.log('');
  console.log('========================================');
  console.log('STEP 35 SUMMARY');
  console.log('========================================');
  console.log('STEP: 35');
  console.log('URL before:', baseline.url);
  console.log('URL after:', afterSave.url);
  console.log('navigation:', urlChanged ? 'yes' : 'no');
  console.log('lang:', afterSave.lang);
  console.log('profile ID:', profileId || 'not directly observed in save response ids');
  console.log('baseline role:', JSON.stringify(baseline.roleField?.value ?? ''));
  console.log('changed role:', ROLE_VALUE);
  console.log(
    'save result:',
    saveProfileWrites.length
      ? saveProfileWrites.map(e => `${e.method} ${e.url} ${e.status}`).join('; ')
      : saveWrites.length
        ? saveWrites.map(e => `${e.method} ${e.url} ${e.status}`).join('; ')
        : saveMode
  );
  console.log(
    'visible post-save state:',
    `editorOpen=${afterSave.editorVisible}; namedProfile=${afterSave.namedProfileVisible}; jobsType=${afterSave.jobsTypeVisible}; enabled=${afterSave.enabledVisible}; roleVisible=${afterSave.roleValueVisible}; roleField=${JSON.stringify(afterSave.roleField?.value ?? null)}`
  );
  console.log('last run:', afterSave.lastRunNone ? 'Запусков пока нет (copy still present)' : 'copy not observed');
  console.log('results:', afterSave.resultsNone ? 'Для этого профиля результатов пока нет (copy still present)' : 'copy not observed');
  console.log('execution CTA state:', afterSave.runBtn || 'not found');
  console.log('success/error feedback:', {
    successLike: afterSave.successLike,
    alerts: afterSave.alerts,
    status: afterSave.statusBanners,
  });
  console.log(
    'save endpoint:',
    saveProfileWrites.length
      ? saveProfileWrites.map(e => `${e.method} ${e.url}`)
      : saveWrites.length
        ? saveWrites.map(e => `${e.method} ${e.url}`)
        : 'None observed'
  );
  console.log(
    'save payload:',
    saveProfileWrites[0]?.requestPayload || saveWrites[0]?.requestPayload || 'n/a'
  );
  console.log(
    'save response:',
    JSON.stringify(saveProfileWrites[0]?.responseBody || saveWrites[0]?.responseBody || null)?.slice(0, 4000)
  );
  console.log('post-save reads:', postSaveReads.length ? summarizeNetwork(postSaveReads) : 'None');
  console.log('execution/AI/provider requests:', autoExecution || aiProvider.length ? summarizeNetwork([...execution, ...aiProvider]) : 'None');
  console.log(
    autoExecution
      ? 'Saving the Jobs profile criteria triggered an execution request. No further Discovery interaction was performed.'
      : 'Saving the Jobs profile criteria caused no observed AI/execution request.'
  );
  console.log('artifact paths:');
  console.log(`  ${OUT}/step-35-before-role-change.png`);
  console.log(`  ${OUT}/step-35-after-role-change-before-save.png`);
  console.log(`  ${OUT}/step-35-after-save.png`);
  console.log(`  ${OUT}/step-35-save-network.json`);
} finally {
  await browser.close();
}
