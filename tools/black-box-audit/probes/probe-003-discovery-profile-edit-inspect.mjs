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
const EDIT_CRITERIA_RE = /Изменить критерии|Змінити критерії|Edit criteria/i;
const RUN_NOW_RE = /Запустить сейчас|Запустити зараз|Run now/i;
const PROFILE_NAME_VALUE = 'Мой поиск работы';
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
let phase = 'before-discovery';

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

function looksLikeProfileRead(entry) {
  return /GET/i.test(entry.method) && /\/api\/modules\/discovery\/profiles/i.test(entry.url || '');
}

function looksLikeProfileWrite(entry) {
  return (
    /POST|PUT|PATCH|DELETE/i.test(entry.method) &&
    /\/api\/modules\/discovery\/profiles/i.test(entry.url || '')
  );
}

function looksLikeCriteriaRead(entry) {
  return (
    /GET/i.test(entry.method) &&
    /\/api\/modules\/discovery\/profiles/i.test(entry.url || '') &&
    /criteria|profile/i.test(entry.url || '')
  );
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
    criteriaReadLike: looksLikeCriteriaRead(entry),
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
        selectedOptions:
          el.tagName === 'SELECT'
            ? [...el.options]
                .filter(o => o.selected)
                .map(o => ({
                  value: o.value,
                  text: (o.textContent || '').replace(/\s+/g, ' ').trim(),
                }))
            : undefined,
        options:
          el.tagName === 'SELECT'
            ? [...el.options].map(o => ({
                value: o.value,
                text: (o.textContent || '').replace(/\s+/g, ' ').trim(),
                selected: o.selected,
              }))
            : undefined,
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
  const links = await page.getByRole('link').evaluateAll(els =>
    els.map(el => ({
      text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
      href: el.getAttribute('href'),
    }))
  );
  const snapshot = await page.locator('body').ariaSnapshot();
  const visibleText = await page.locator('body').innerText();
  const statusBanners = await page.locator('[role="status"]').allTextContents().catch(() => []);
  const alerts = await page.locator('[role="alert"]').allTextContents().catch(() => []);
  const arrivingFrom = await page.getByText(/Arriving from/i).allTextContents().catch(() => []);
  const dialog = page.getByRole('dialog');
  const dialogVisible = await dialog.first().isVisible().catch(() => false);
  const dialogSnap = dialogVisible ? await dialog.first().ariaSnapshot().catch(() => '') : '';
  const dialogText = dialogVisible
    ? ((await dialog.first().innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim()
    : '';
  const fields = await dumpFields(page.locator('body'));
  const profilesRegion = page.getByRole('region', { name: /Ваши профили|Your profiles/i });
  const profilesVisible = await profilesRegion.first().isVisible().catch(() => false);
  const profilesText = profilesVisible
    ? ((await profilesRegion.first().innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim()
    : '';
  const profilesSnap = profilesVisible ? await profilesRegion.first().ariaSnapshot().catch(() => '') : '';
  const namedProfileVisible = await page.getByText(PROFILE_NAME_VALUE).first().isVisible().catch(() => false);
  const jobsTypeVisible = await page.getByText(JOBS_TYPE_RE).first().isVisible().catch(() => false);
  const enabledVisible = /Включён|ВКЛЮЧЁН|Enabled/i.test(visibleText);
  const lastRunNone = /Запусков пока нет|No runs yet/i.test(visibleText);
  const resultsNone = /результатов пока нет|no results/i.test(visibleText);
  const lastRunVisible = /Последний запуск|Last run/i.test(visibleText);
  const resultsHeadingVisible = /Результаты|Results/i.test(visibleText);
  const editBtn = buttonByName(buttons, EDIT_CRITERIA_RE);
  const runBtn = buttonByName(buttons, RUN_NOW_RE);
  const saveBtns = buttons.filter(b =>
    /сохран|зберег|save|применит|застосув/i.test(`${b.text} ${b.ariaLabel || ''}`)
  );
  const cancelBtns = buttons.filter(b => /отмена|скасувати|cancel/i.test(`${b.text} ${b.ariaLabel || ''}`));
  const executeSearchBtns = buttons.filter(b =>
    /запустить сейчас|запустити зараз|execute|generate|find|рекоменд/i.test(`${b.text} ${b.ariaLabel || ''}`)
  );
  const aiHits = findAiWording(`${visibleText}\n${snapshot}`);
  const profileButtons = buttons.filter(b => b.text.includes(PROFILE_NAME_VALUE));
  return {
    url: page.url(),
    title: await page.title(),
    lang: await page.locator('html').getAttribute('lang'),
    headings,
    buttons,
    links,
    snapshot,
    visibleText,
    statusBanners,
    alerts,
    arrivingFrom,
    dialogVisible,
    dialogText,
    dialogSnap,
    fields,
    profilesVisible,
    profilesText,
    profilesSnap,
    namedProfileVisible,
    jobsTypeVisible,
    enabledVisible,
    lastRunNone,
    resultsNone,
    lastRunVisible,
    resultsHeadingVisible,
    editBtn,
    runBtn,
    saveBtns,
    cancelBtns,
    executeSearchBtns,
    aiHits,
    profileButtons,
    profileCountGuess: profileButtons.length,
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
  console.log('DIALOG VISIBLE:', dump.dialogVisible ? 'YES' : 'NO');
  console.log('DIALOG TEXT:', dump.dialogText || 'n/a');
  console.log('DIALOG SNAPSHOT:');
  console.log(dump.dialogSnap || 'n/a');
  console.log('FIELDS:', dump.fields);
  console.log('PROFILES REGION VISIBLE:', dump.profilesVisible ? 'YES' : 'NO');
  console.log('PROFILES TEXT:', dump.profilesText);
  console.log('PROFILES SNAPSHOT:');
  console.log(dump.profilesSnap || 'n/a');
  console.log('NAMED PROFILE VISIBLE:', dump.namedProfileVisible ? 'YES' : 'NO');
  console.log('JOBS TYPE VISIBLE:', dump.jobsTypeVisible ? 'YES' : 'NO');
  console.log('ENABLED VISIBLE:', dump.enabledVisible ? 'YES' : 'NO');
  console.log('LAST RUN NONE:', dump.lastRunNone ? 'YES' : 'NO');
  console.log('RESULTS NONE:', dump.resultsNone ? 'YES' : 'NO');
  console.log('LAST RUN HEADING VISIBLE:', dump.lastRunVisible ? 'YES' : 'NO');
  console.log('RESULTS HEADING VISIBLE:', dump.resultsHeadingVisible ? 'YES' : 'NO');
  console.log('EDIT CRITERIA BUTTON:', dump.editBtn || 'not found');
  console.log('RUN NOW BUTTON:', dump.runBtn || 'not found');
  console.log('SAVE BUTTONS:', dump.saveBtns.length ? dump.saveBtns : 'None');
  console.log('CANCEL BUTTONS:', dump.cancelBtns.length ? dump.cancelBtns : 'None');
  console.log('EXECUTION CONTROLS:', dump.executeSearchBtns.length ? dump.executeSearchBtns : 'None');
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
  console.log('NETWORK CAPTURE: started before any app interaction / before entering Discovery');

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

  phase = 'after-discovery-open';
  console.log('SETUP: click Discovery nav (network phase after-discovery-open)');
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
  console.log('SETUP: named profile visible after Discovery open:', namedVisible ? 'YES' : 'NO');

  if (!namedVisible) {
    console.log('SETUP: profile not in this fresh session; recreate Jobs profile (minimum name only). Not the STEP 34 action.');
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

  phase = 'after-profile-open';
  const editVisibleAlready = await page.getByRole('button', { name: EDIT_CRITERIA_RE }).first().isVisible().catch(() => false);
  if (!editVisibleAlready) {
    console.log('SETUP: select/open profile Мой поиск работы');
    const profileBtn = page.getByRole('button', { name: new RegExp(PROFILE_NAME_VALUE, 'i') });
    if (await profileBtn.first().isVisible().catch(() => false)) {
      await profileBtn.first().click({ timeout: 8000 });
      await settle();
    }
  } else {
    console.log('SETUP: profile detail already visible; not clicking the profile card');
  }

  console.log('SETUP: Запустить сейчас will NOT be clicked');

  const before = await dumpUi();
  logDump('BEFORE EDIT CRITERIA', before);
  await page.screenshot({
    path: `${OUT}/step-34-before-edit-criteria.png`,
    fullPage: true,
  });
  console.log('SCREENSHOT BEFORE:', `${OUT}/step-34-before-edit-criteria.png`);

  console.log('');
  console.log('========================================');
  console.log('PRE-ACTION VERIFICATION');
  console.log('========================================');
  console.log('exactly one named profile button:', before.profileCountGuess);
  console.log('name visible:', before.namedProfileVisible ? 'YES' : 'NO');
  console.log('Jobs type visible:', before.jobsTypeVisible ? 'YES' : 'NO');
  console.log('enabled visible:', before.enabledVisible ? 'YES' : 'NO');
  console.log('last run none:', before.lastRunNone ? 'YES' : 'NO');
  console.log('results none:', before.resultsNone ? 'YES' : 'NO');
  console.log('Изменить критерии visible:', before.editBtn ? 'YES' : 'NO');
  console.log('Запустить сейчас visible:', before.runBtn ? 'YES' : 'NO');

  const discoveryOpen = captured.filter(e => e.phase === 'after-discovery-open');
  const profileOpen = captured.filter(e => e.phase === 'after-profile-open');
  console.log('');
  console.log('NETWORK AFTER OPENING DISCOVERY:', discoveryOpen.length ? summarizeNetwork(discoveryOpen) : 'None classified after phase start');
  console.log('NETWORK AFTER OPENING PROFILE:', profileOpen.length ? summarizeNetwork(profileOpen) : 'None classified after phase start');

  const editBtn = page.getByRole('button', { name: EDIT_CRITERIA_RE });
  const editVisible = await editBtn.first().isVisible().catch(() => false);
  const editEnabled = editVisible ? await editBtn.first().isEnabled().catch(() => false) : false;
  console.log('EDIT TARGET VISIBLE/ENABLED:', editVisible, editEnabled);

  let clickMode = 'skipped';
  let clickError = null;
  if (!before.namedProfileVisible || !editVisible) {
    console.log('ACTION: SKIPPED — profile or Изменить критерии not available');
  } else {
    console.log('ACTION: click Изменить критерии (normal). No field changes. No save. No run.');
    phase = 'after-edit-click';
    try {
      await editBtn.first().click({ timeout: 8000 });
      clickMode = 'normal';
      console.log('CLICK MODE: normal');
      await settle();
      await page.waitForTimeout(1500);
    } catch (error) {
      clickMode = 'failed';
      clickError = String(error.message || error).slice(0, 800);
      console.log('CLICK MODE: failed; force NOT used');
      console.log('CLICK ERROR:', clickError);
    }
  }

  console.log('CLICK MODE USED:', clickMode);
  console.log('STOP: no save / cancel / run / field edit / second profile');

  const after = await dumpUi();
  logDump('AFTER EDIT CRITERIA', after);
  await page.screenshot({
    path: `${OUT}/step-34-after-edit-criteria.png`,
    fullPage: true,
  });

  await fs.writeFile(`${OUT}/step-34-edit-criteria-network.json`, JSON.stringify(captured, null, 2));

  const afterEdit = captured.filter(e => e.phase === 'after-edit-click');
  const reads = afterEdit.filter(looksLikeProfileRead);
  const writes = afterEdit.filter(e => /POST|PUT|PATCH|DELETE/i.test(e.method));
  const mutations = afterEdit.filter(e => /\/api\/mutations/i.test(e.url));
  const execution = afterEdit.filter(looksLikeExecution);
  const executeUrls = [...new Set(execution.map(e => `${e.method} ${e.url}`))];
  const profileWrites = afterEdit.filter(looksLikeProfileWrite);
  const criteriaReads = afterEdit.filter(looksLikeCriteriaRead);
  const aiProvider = afterEdit.filter(e => /openai|anthropic|\/ai\//i.test(e.url));
  const urlChanged = before.url !== after.url;
  const newFailures = requestFailures.filter(f => f.phase === 'after-edit-click');
  const otherFailures = newFailures.filter(f => !isRscPrefetchAbort(f));
  const editableFields = (after.fields || []).filter(
    f => ['input', 'textarea', 'select'].includes(f.tag) && !f.disabled
  );
  const autoExecution = execution.length > 0;

  if (autoExecution) {
    console.log('STOP: execution-like request observed after Изменить критерии. No further interaction.');
  }

  console.log('');
  console.log('--- STEP 34 COMPARISON ---');
  console.log('URL BEFORE:', before.url);
  console.log('URL AFTER:', after.url);
  console.log('NAVIGATION OCCURRED:', urlChanged ? 'YES' : 'NO');
  console.log('TITLE AFTER:', after.title);
  console.log('LANG BEFORE/AFTER:', before.lang, '→', after.lang);
  console.log('CLICK MODE:', clickMode);
  if (clickError) {
    console.log('CLICK ERROR:', clickError);
  }
  console.log('DIALOG BEFORE/AFTER:', before.dialogVisible, '→', after.dialogVisible);
  console.log('PROFILE LIST STILL VISIBLE:', after.profilesVisible ? 'YES' : 'NO');
  console.log('NAMED PROFILE STILL VISIBLE:', after.namedProfileVisible ? 'YES' : 'NO');
  console.log('LAST RUN STILL VISIBLE:', after.lastRunVisible ? 'YES' : 'NO');
  console.log('RESULTS STILL VISIBLE:', after.resultsHeadingVisible ? 'YES' : 'NO');
  console.log('SAVE CONTROLS AFTER:', after.saveBtns.length ? after.saveBtns : 'None');
  console.log('CANCEL CONTROLS AFTER:', after.cancelBtns.length ? after.cancelBtns : 'None');
  console.log('EXECUTION CONTROLS AFTER:', after.executeSearchBtns.length ? after.executeSearchBtns : 'None');
  console.log('RUN NOW STILL PRESENT:', after.runBtn ? 'YES' : 'NO');
  console.log('EDITABLE FIELDS AFTER:', editableFields.length ? editableFields : 'None');
  console.log(
    'AFTER-EDIT INTERESTING NETWORK:',
    afterEdit.length ? summarizeNetwork(afterEdit) : 'None'
  );
  console.log('AFTER-EDIT PROFILE READS:', reads.length ? summarizeNetwork(reads) : 'None');
  console.log('AFTER-EDIT CRITERIA READS:', criteriaReads.length ? summarizeNetwork(criteriaReads) : 'None');
  console.log('AFTER-EDIT WRITES:', writes.length ? summarizeNetwork(writes) : 'None');
  console.log('AFTER-EDIT PROFILE WRITES:', profileWrites.length ? summarizeNetwork(profileWrites) : 'None');
  console.log('AFTER-EDIT MUTATIONS:', mutations.length ? summarizeNetwork(mutations) : 'None');
  console.log('AFTER-EDIT EXECUTION-LIKE:', execution.length ? summarizeNetwork(execution) : 'None');
  console.log('AFTER-EDIT AI/PROVIDER:', aiProvider.length ? summarizeNetwork(aiProvider) : 'None');
  console.log(
    autoExecution
      ? 'Opening "Изменить критерии" triggered an execution-like request. No further Discovery interaction was performed.'
      : 'Opening "Изменить критерии" caused no observed AI/execution request.'
  );
  console.log('REQUEST FAILURES (after edit):', newFailures.length ? newFailures : 'None');
  console.log('OTHER REQUEST FAILURES (after edit):', otherFailures.length ? otherFailures : 'None');
  console.log('SCREENSHOT AFTER:', `${OUT}/step-34-after-edit-criteria.png`);

  console.log('');
  console.log('========================================');
  console.log('STEP 34 SUMMARY');
  console.log('========================================');
  console.log('STEP: 34');
  console.log('URL before:', before.url);
  console.log('URL after:', after.url);
  console.log('navigation:', urlChanged ? 'yes' : 'no');
  console.log('lang:', after.lang);
  console.log(
    'profile state before:',
    `nameVisible=${before.namedProfileVisible}; jobsType=${before.jobsTypeVisible}; enabled=${before.enabledVisible}; lastRunNone=${before.lastRunNone}; resultsNone=${before.resultsNone}; edit=${Boolean(before.editBtn)}; runNow=${Boolean(before.runBtn)}; profiles=${before.profilesText}`
  );
  console.log(
    'editor state after:',
    `dialog=${after.dialogVisible}; save=${after.saveBtns.length}; cancel=${after.cancelBtns.length}; fields=${(after.fields || []).filter(f => ['input', 'textarea', 'select'].includes(f.tag)).length}; formHeadings=${(after.headings || []).map(h => h.text).join(' | ')}`
  );
  console.log('all visible editable fields:', editableFields.length ? editableFields : 'None');
  console.log('save/cancel controls:', { save: after.saveBtns, cancel: after.cancelBtns });
  console.log('execution controls:', after.executeSearchBtns.length ? after.executeSearchBtns : 'None');
  console.log(
    'results state:',
    `headingVisible=${after.resultsHeadingVisible}; noneCopy=${after.resultsNone}; lastRunHeading=${after.lastRunVisible}; lastRunNone=${after.lastRunNone}`
  );
  console.log('profile list remaining visible:', after.profilesVisible ? 'yes' : 'no');
  console.log('last run / results remaining visible:', after.lastRunVisible, after.resultsHeadingVisible);
  console.log('Arriving from:', after.arrivingFrom.length ? after.arrivingFrom : 'Not found');
  console.log('profile read requests after click:', reads.length ? summarizeNetwork(reads) : 'None');
  console.log('profile criteria read requests after click:', criteriaReads.length ? summarizeNetwork(criteriaReads) : 'None');
  console.log('any write request after click:', writes.length ? summarizeNetwork(writes) : 'None');
  console.log('any mutation after click:', mutations.length ? summarizeNetwork(mutations) : 'None');
  console.log('any execution request after click:', execution.length ? summarizeNetwork(execution) : 'None');
  console.log('any AI/provider request after click:', aiProvider.length ? summarizeNetwork(aiProvider) : 'None');
  console.log(
    autoExecution
      ? 'Opening "Изменить критерии" triggered an execution-like request. No further Discovery interaction was performed.'
      : 'Opening "Изменить критерии" caused no observed AI/execution request.'
  );
  console.log('artifact paths:');
  console.log(`  ${OUT}/step-34-before-edit-criteria.png`);
  console.log(`  ${OUT}/step-34-after-edit-criteria.png`);
  console.log(`  ${OUT}/step-34-edit-criteria-network.json`);
} finally {
  await browser.close();
}
