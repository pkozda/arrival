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
const OBSERVE_MS = 30000;

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
let abortForSecondExecution = false;

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
  const blob = `${host} ${entry.url}`;
  return /openai|anthropic|generativelanguage|groq|mistral|together|fireworks|openrouter|azure\.openai|bedrock|vertexai|googleapis\.com\/v1beta/i.test(
    blob
  );
}

function looksLikeProfileWrite(entry) {
  return (
    /POST|PUT|PATCH|DELETE/i.test(entry.method) &&
    /\/api\/modules\/discovery\/profiles/i.test(entry.url || '')
  );
}

function classifyRequest(entry) {
  const payload = String(entry.requestPayload || '');
  return {
    discoveryApi: /\/api\/modules\/discovery/i.test(entry.url),
    execute: /\/execute/i.test(entry.url),
    runPath: /\/run(?!-summary)/i.test(entry.url),
    mutations: /\/api\/mutations/i.test(entry.url),
    writeMethod: /POST|PUT|PATCH|DELETE/i.test(entry.method),
    resultsReadLike: /GET/i.test(entry.method) && /\/results/i.test(entry.url),
    runSummaryReadLike: /GET/i.test(entry.method) && /run-summary/i.test(entry.url),
    uiSnapshot: /\/api\/ui-snapshot/i.test(entry.url),
    executionLike: looksLikeExecution(entry),
    providerLike: looksLikeProvider(entry),
    profileWriteLike: looksLikeProfileWrite(entry),
    payloadLooksLikeQueryOrPrompt: /prompt|query|search|generate|recommend|messages/i.test(payload),
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
        /^(id|profileId|profile_id|runId|run_id|executionId|execution_id|uuid)$/i.test(key) &&
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
  const url = safeUrl(response.url());
  const method = request.method();
  const host = hostnameOf(url);
  const resourceType = request.resourceType();
  const isApp = /arrival-atlas\.pro$/i.test(host || '');
  const providerLooking = /openai|anthropic|generativelanguage|groq|mistral|together|fireworks|openrouter|azure|bedrock|vertex/i.test(
    `${host} ${url}`
  );
  const interesting =
    /\/api\/|\/modules\/discovery|_rsc|rsc=|mutation|execute|\/run|intent|ui-snapshot|user-context|profile|discover|openai|anthropic|\/ai\//i.test(
      `${method} ${url}`
    ) ||
    providerLooking ||
    (!isApp && /xhr|fetch/i.test(resourceType)) ||
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
      responseBody = (await response.text()).slice(0, 8000);
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
  entry.extractedIds = extractIds(entry.responseBody);
  captured.push(entry);
  if (phase === 'after-run-click' && looksLikeExecution(entry)) {
    const execCount = captured.filter(e => e.phase === 'after-run-click' && looksLikeExecution(e)).length;
    if (execCount > 1) {
      abortForSecondExecution = true;
    }
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
    durationMs: entry.durationMs,
    method: entry.method,
    status: entry.status,
    hostname: entry.hostname,
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
  const namedProfileVisible = await page.getByText(PROFILE_NAME_VALUE).first().isVisible().catch(() => false);
  const roleVisible = await page.getByText(ROLE_VALUE).first().isVisible().catch(() => false);
  const countryVisible = /country:\s*DE|Код страны[\s\S]{0,20}DE/i.test(`${visibleText}\n${snapshot}`);
  const jobsTypeVisible = await page.getByText(JOBS_TYPE_RE).first().isVisible().catch(() => false);
  const enabledVisible = /Включён|ВКЛЮЧЁН|Enabled/i.test(visibleText);
  const lastRunNone = /Запусков пока нет|No runs yet/i.test(visibleText);
  const resultsNone = /результатов пока нет|no results/i.test(visibleText);
  const lastRunVisible = /Последний запуск|Last run/i.test(visibleText);
  const loading = await page
    .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
    .count();
  const busy = await page.locator('[aria-busy="true"]').count();
  const runBtn = buttonByName(buttons, RUN_NOW_RE);
  const retryBtns = buttons.filter(b => /повтор|retry|try again|ещё раз|ще раз/i.test(`${b.text} ${b.ariaLabel || ''}`));
  const resultsRegion = page.getByRole('region', { name: /Результаты|Results/i });
  const resultsText = (await resultsRegion.allTextContents().catch(() => [])).map(t => t.replace(/\s+/g, ' ').trim());
  const resultItems = await page
    .evaluate(() => {
      const regions = [...document.querySelectorAll('[role="region"]')].filter(el =>
        /Результаты|Results/i.test(el.getAttribute('aria-label') || el.querySelector('h2,h3')?.textContent || '')
      );
      const root = regions[0] || null;
      if (!root) {
        return [];
      }
      return [...root.querySelectorAll('article, li, a, [role="listitem"]')]
        .map(el => ({
          tag: el.tagName,
          text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 300),
          href: el.getAttribute('href'),
        }))
        .filter(item => item.text && !/Выберите результат|Select a result|результатов пока нет/i.test(item.text))
        .slice(0, 20);
    })
    .catch(() => []);
  const lastRunBlock = (visibleText.match(/Последний запуск[\s\S]{0,400}/i) || [''])[0].replace(/\s+/g, ' ').trim();
  const runIdVisible = (visibleText.match(/(run|execution|запуск)[^\n]{0,80}\b[a-z0-9_-]{8,}\b/gi) || []).slice(0, 5);
  const inProgress = /выполня|running|in progress|запуск[а-я]*\.\.\.|loading|загруз/i.test(visibleText) || loading > 0 || busy > 0;
  const errorLike = /ошибк|помилк|failed|failure|не удалось|не вдалося/i.test(visibleText);
  const successLike = /завершен|completed|готово|успеш|виконан/i.test(visibleText);
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
    namedProfileVisible,
    roleVisible,
    countryVisible,
    jobsTypeVisible,
    enabledVisible,
    lastRunNone,
    resultsNone,
    lastRunVisible,
    lastRunBlock,
    runIdVisible,
    loading,
    busy,
    inProgress,
    errorLike,
    successLike,
    runBtn,
    retryBtns,
    resultsText,
    resultItems,
    aiHits: findAiWording(`${visibleText}\n${snapshot}`),
    profileButtonCount: buttons.filter(b => b.text.includes(PROFILE_NAME_VALUE)).length,
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
  console.log('NAMED PROFILE:', dump.namedProfileVisible ? 'YES' : 'NO');
  console.log('JOBS TYPE:', dump.jobsTypeVisible ? 'YES' : 'NO');
  console.log('ENABLED:', dump.enabledVisible ? 'YES' : 'NO');
  console.log('COUNTRY DE VISIBLE:', dump.countryVisible ? 'YES' : 'NO');
  console.log('ROLE VISIBLE:', dump.roleVisible ? 'YES' : 'NO');
  console.log('LAST RUN NONE:', dump.lastRunNone ? 'YES' : 'NO');
  console.log('LAST RUN BLOCK:', dump.lastRunBlock || 'n/a');
  console.log('RESULTS NONE:', dump.resultsNone ? 'YES' : 'NO');
  console.log('RESULT ITEMS:', dump.resultItems.length ? dump.resultItems : 'None');
  console.log('RESULTS TEXT:', dump.resultsText);
  console.log('RUN NOW:', dump.runBtn || 'not found');
  console.log('RETRY:', dump.retryBtns.length ? dump.retryBtns : 'None');
  console.log('IN PROGRESS:', dump.inProgress ? 'YES' : 'NO');
  console.log('LOADING COUNT:', dump.loading);
  console.log('ERROR-LIKE:', dump.errorLike ? 'YES' : 'NO');
  console.log('SUCCESS-LIKE:', dump.successLike ? 'YES' : 'NO');
  console.log('RUN/EXEC ID VISIBLE:', dump.runIdVisible.length ? dump.runIdVisible : 'None');
  console.log('ARRIVING FROM:', dump.arrivingFrom.length ? dump.arrivingFrom : 'Not found');
  console.log('AI / COST / PROVIDER WORD HITS:', dump.aiHits.length ? dump.aiHits : 'None');
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
  console.log('SECRET REDACTION: tokens/cookies/auth headers will not be stored');

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
    console.log('SETUP: recreate Jobs profile (name only). NOT STEP 36 execution.');
    await page.getByRole('button', { name: NEW_PROFILE_RE }).first().click({ timeout: 8000 });
    await page.getByRole('region', { name: /Создать профиль поиска/i }).waitFor({
      state: 'visible',
      timeout: 15000,
    });
    await page.waitForTimeout(1000);
    await page.getByRole('textbox', { name: NAME_FIELD_RE }).fill(PROFILE_NAME_VALUE);
    await page.getByRole('button', { name: CREATE_PROFILE_RE }).click({ timeout: 8000 });
    await settle();
    await page.waitForTimeout(2000);
    namedVisible = await page.getByText(PROFILE_NAME_VALUE).first().isVisible().catch(() => false);
    console.log('SETUP: named profile after recreate:', namedVisible ? 'YES' : 'NO');
  }

  if (!(await page.getByRole('button', { name: EDIT_CRITERIA_RE }).first().isVisible().catch(() => false))) {
    await page.getByRole('button', { name: new RegExp(PROFILE_NAME_VALUE, 'i') }).first().click({ timeout: 8000 });
    await settle();
  }

  let roleAlready = await page.getByText(ROLE_VALUE).first().isVisible().catch(() => false);
  if (!roleAlready) {
    console.log('SETUP: save preferred role Frontend Developer. NOT STEP 36 execution.');
    await page.getByRole('button', { name: EDIT_CRITERIA_RE }).first().click({ timeout: 8000 });
    await page.getByRole('heading', { name: /Изменить критерии профиля/i }).waitFor({
      state: 'visible',
      timeout: 10000,
    });
    await page.getByRole('textbox', { name: ROLE_FIELD_RE }).fill(ROLE_VALUE);
    await page.getByRole('button', { name: SAVE_CHANGES_RE }).click({ timeout: 8000 });
    await settle();
    await page.waitForTimeout(2000);
    roleAlready = await page.getByText(ROLE_VALUE).first().isVisible().catch(() => false);
    console.log('SETUP: role visible after save:', roleAlready ? 'YES' : 'NO');
  } else {
    console.log('SETUP: preferred role already visible; editor not opened');
  }

  console.log('SETUP: Запустить сейчас will NOT be clicked during setup');

  const before = await dumpUi();
  logDump('PRE-EXECUTION', before);
  await page.screenshot({
    path: `${OUT}/step-36-before-run.png`,
    fullPage: true,
  });
  console.log('SCREENSHOT BEFORE RUN:', `${OUT}/step-36-before-run.png`);

  const configOk =
    before.namedProfileVisible &&
    before.jobsTypeVisible &&
    before.countryVisible &&
    before.roleVisible &&
    before.lastRunNone &&
    before.resultsNone &&
    before.profileButtonCount === 1 &&
    Boolean(before.runBtn) &&
    !before.runBtn.disabled &&
    before.runBtn.ariaDisabled !== 'true' &&
    !before.inProgress &&
    before.resultItems.length === 0;

  console.log('');
  console.log('========================================');
  console.log('PRE-EXECUTION VERIFICATION');
  console.log('========================================');
  console.log('named profile:', before.namedProfileVisible);
  console.log('jobs type:', before.jobsTypeVisible);
  console.log('country DE:', before.countryVisible);
  console.log('role Frontend Developer:', before.roleVisible);
  console.log('last run none:', before.lastRunNone);
  console.log('results none:', before.resultsNone);
  console.log('profile count:', before.profileButtonCount);
  console.log('run now:', before.runBtn);
  console.log('in progress:', before.inProgress);
  console.log('result items:', before.resultItems.length);
  console.log('CONFIG OK FOR EXECUTION:', configOk ? 'YES' : 'NO');

  let stopReason = null;
  if (!before.lastRunNone) {
    stopReason = 'A previous run already exists in this session. STOP without executing.';
  } else if (!configOk) {
    stopReason = 'Required profile state could not be reproduced exactly. STOP without executing.';
  }

  let clickMode = 'skipped';
  let clickError = null;
  let afterClick = null;
  let finalState = null;
  let observedMs = 0;
  let terminalReason = null;

  if (stopReason) {
    console.log('EXECUTION SKIPPED:', stopReason);
    afterClick = before;
    finalState = before;
  } else {
    console.log('ACTION: click Запустить сейчас once (normal). No retry. No second click.');
    phase = 'after-run-click';
    const runBtn = page.getByRole('button', { name: RUN_NOW_RE });
    try {
      await runBtn.first().click({ timeout: 8000 });
      clickMode = 'normal';
      console.log('CLICK MODE: normal; second click will NOT be performed');
    } catch (error) {
      clickMode = 'failed';
      clickError = String(error.message || error).slice(0, 800);
      console.log('CLICK FAILED; force NOT used; no retry');
    }

    afterClick = await dumpUi();
    logDump('IMMEDIATE AFTER CLICK', afterClick);
    await page.screenshot({
      path: `${OUT}/step-36-after-click.png`,
      fullPage: true,
    });
    console.log('SCREENSHOT AFTER CLICK:', `${OUT}/step-36-after-click.png`);

    const observeStart = Date.now();
    finalState = afterClick;
    while (Date.now() - observeStart < OBSERVE_MS) {
      if (abortForSecondExecution) {
        terminalReason = 'unexpected second execution-like request; STOP';
        finalState = await dumpUi();
        break;
      }
      const current = await dumpUi();
      finalState = current;
      const lastRunChanged = before.lastRunNone && !current.lastRunNone;
      const resultsChanged = before.resultsNone && !current.resultsNone;
      const hasItems = current.resultItems.length > 0;
      const finishedLoading = afterClick.inProgress && !current.inProgress;
      const terminalCopy = current.successLike || current.errorLike || lastRunChanged || resultsChanged || hasItems;
      if (terminalCopy && !current.inProgress) {
        terminalReason = lastRunChanged
          ? 'last-run state changed'
          : resultsChanged || hasItems
            ? 'results state changed'
            : current.errorLike
              ? 'error-like copy'
              : 'success-like copy / loading ended';
        break;
      }
      if (finishedLoading && (lastRunChanged || resultsChanged || hasItems || current.errorLike || current.successLike)) {
        terminalReason = 'loading ended with terminal copy';
        break;
      }
      await page.waitForTimeout(1000);
    }
    observedMs = Date.now() - observeStart;
    if (!terminalReason) {
      terminalReason = finalState.inProgress
        ? 'observation window ended while still loading/running'
        : 'observation window ended with stable non-loading state';
    }
    console.log('OBSERVATION MS:', observedMs);
    console.log('TERMINAL REASON:', terminalReason);
  }

  logDump('FINAL / TERMINAL STATE', finalState);
  await page.screenshot({
    path: `${OUT}/step-36-final-state.png`,
    fullPage: true,
  });

  const sanitized = captured.map(entry => ({
    ...entry,
    requestPayload: redactSecrets(entry.requestPayload),
    responseBody: redactSecrets(entry.responseBody),
  }));
  await fs.writeFile(`${OUT}/step-36-run-network.json`, JSON.stringify(sanitized, null, 2));

  const setupNet = captured.filter(e => e.phase === 'setup');
  const runNet = captured.filter(e => e.phase === 'after-run-click');
  const executionReqs = runNet.filter(looksLikeExecution);
  const providerReqs = runNet.filter(looksLikeProvider);
  const postReads = runNet.filter(e => /GET/i.test(e.method));
  const unexpectedWrites = runNet.filter(
    e =>
      /POST|PUT|PATCH|DELETE/i.test(e.method) &&
      !looksLikeExecution(e) &&
      !/\/execute|\/run(?!-summary)/i.test(e.url)
  );
  const resultsReads = runNet.filter(e => /GET/i.test(e.method) && /\/results/i.test(e.url));
  const runSummaryReads = runNet.filter(e => /GET/i.test(e.method) && /run-summary/i.test(e.url));
  const urlChanged = before.url !== finalState.url;
  const execIds = executionReqs.flatMap(e => e.extractedIds || []);
  const providerObserved = providerReqs.length > 0;
  const executionObserved = executionReqs.length > 0;

  let costStatement;
  if (stopReason) {
    costStatement = 'The single Discovery execution was not initiated.';
  } else if (executionObserved && providerObserved) {
    costStatement = 'The single Discovery execution caused an observed AI/provider request.';
  } else if (executionObserved && !providerObserved) {
    costStatement = 'The single Discovery execution completed with no observed AI/provider request.';
  } else if (!executionObserved && clickMode === 'normal') {
    costStatement =
      'The single Discovery execution was initiated, but its execution/provider outcome could not be determined from the observed evidence.';
  } else {
    costStatement =
      'The single Discovery execution was initiated, but its execution/provider outcome could not be determined from the observed evidence.';
  }

  const profileId =
    setupNet
      .flatMap(e => e.extractedIds || [])
      .find(x => /profile\.id$/.test(x.path))?.value || null;

  console.log('');
  console.log('--- STEP 36 COMPARISON ---');
  console.log('CLICK MODE:', clickMode);
  if (clickError) console.log('CLICK ERROR:', clickError);
  if (stopReason) console.log('STOP REASON:', stopReason);
  console.log('URL BEFORE:', before.url);
  console.log('URL AFTER:', finalState.url);
  console.log('NAVIGATION:', urlChanged ? 'YES' : 'NO');
  console.log('SECOND EXECUTION ABORT:', abortForSecondExecution ? 'YES' : 'NO');
  console.log('1 SETUP REQUESTS:', setupNet.length ? summarizeNetwork(setupNet) : 'None');
  console.log('2 EXECUTION REQUESTS:', executionReqs.length ? summarizeNetwork(executionReqs) : 'None');
  console.log('3 AI/PROVIDER REQUESTS:', providerReqs.length ? summarizeNetwork(providerReqs) : 'None');
  console.log('4 POST-EXECUTION READS:', postReads.length ? summarizeNetwork(postReads) : 'None');
  console.log('5 UNEXPECTED WRITES:', unexpectedWrites.length ? summarizeNetwork(unexpectedWrites) : 'None');
  console.log('RESULTS READS:', resultsReads.length ? summarizeNetwork(resultsReads) : 'None');
  console.log('RUN-SUMMARY READS:', runSummaryReads.length ? summarizeNetwork(runSummaryReads) : 'None');
  if (executionReqs.length) {
    for (const entry of executionReqs) {
      console.log('EXECUTION REQUEST DETAIL:', `${entry.method} ${entry.url} → ${entry.status} (${entry.durationMs}ms)`);
      console.log('EXECUTION PAYLOAD:', entry.requestPayload);
      console.log('EXECUTION RESPONSE:', JSON.stringify(entry.responseBody)?.slice(0, 8000));
    }
  }
  console.log(costStatement);
  console.log('NETWORK ARTIFACT:', `${OUT}/step-36-run-network.json`);
  console.log('SCREENSHOT FINAL:', `${OUT}/step-36-final-state.png`);

  console.log('');
  console.log('========================================');
  console.log('STEP 36 SUMMARY');
  console.log('========================================');
  console.log('STEP: 36');
  console.log('profile ID:', profileId || 'not observed');
  console.log(
    'profile configuration:',
    `name=${PROFILE_NAME_VALUE}; type=jobs/Поиск работы; country=DE; preferredRole=${ROLE_VALUE}; excluded=none; schedule=manual; emailNotifications=checked; skipEmpty=checked; notificationEmail=empty`
  );
  console.log('URL before:', before.url);
  console.log('URL after:', finalState.url);
  console.log('navigation:', urlChanged ? 'yes' : 'no');
  console.log('lang:', finalState.lang);
  console.log(
    'pre-run state:',
    `lastRunNone=${before.lastRunNone}; resultsNone=${before.resultsNone}; runNow=${JSON.stringify(before.runBtn)}; inProgress=${before.inProgress}`
  );
  console.log('action performed:', clickMode === 'normal' ? 'click Запустить сейчас once' : `not executed (${clickMode}${stopReason ? `; ${stopReason}` : ''})`);
  console.log(
    'immediate post-click state:',
    afterClick
      ? `inProgress=${afterClick.inProgress}; lastRunNone=${afterClick.lastRunNone}; resultsNone=${afterClick.resultsNone}; loading=${afterClick.loading}`
      : 'n/a'
  );
  console.log(
    'final/terminal state:',
    `reason=${terminalReason}; inProgress=${finalState.inProgress}; lastRunNone=${finalState.lastRunNone}; resultsNone=${finalState.resultsNone}; lastRunBlock=${finalState.lastRunBlock}; errorLike=${finalState.errorLike}; successLike=${finalState.successLike}; observedMs=${observedMs}`
  );
  console.log(
    'execution request:',
    executionReqs.length ? executionReqs.map(e => `${e.method} ${e.url}`).join('; ') : 'None observed'
  );
  console.log(
    'execution response:',
    executionReqs[0] ? `status=${executionReqs[0].status}; body=${JSON.stringify(executionReqs[0].responseBody)?.slice(0, 3000)}` : 'n/a'
  );
  console.log('execution ID/run ID:', execIds.length ? execIds : finalState.runIdVisible.length ? finalState.runIdVisible : 'None observed');
  console.log(
    'execution duration:',
    executionReqs[0]?.durationMs != null ? `${executionReqs[0].durationMs}ms (HTTP)` : `observation ${observedMs}ms`
  );
  console.log(
    'AI/provider traffic:',
    providerReqs.length
      ? providerReqs.map(e => `${e.method} ${e.hostname} ${e.url} → ${e.status} (${e.durationMs}ms)`).join('; ')
      : 'None observed'
  );
  console.log('post-execution reads:', postReads.length ? summarizeNetwork(postReads) : 'None');
  console.log(
    'run persistence:',
    runSummaryReads.length ? summarizeNetwork(runSummaryReads) : 'no run-summary GET observed after click'
  );
  console.log('results count:', finalState.resultItems.length);
  console.log('visible result structure:', finalState.resultItems.length ? finalState.resultItems : finalState.resultsText);
  console.log(
    'success/error/empty state:',
    `successLike=${finalState.successLike}; errorLike=${finalState.errorLike}; resultsNone=${finalState.resultsNone}; lastRunNone=${finalState.lastRunNone}`
  );
  console.log('retry controls:', finalState.retryBtns.length ? finalState.retryBtns : 'None');
  console.log('execution CTA after run:', finalState.runBtn || 'not found');
  console.log('unexpected writes:', unexpectedWrites.length ? summarizeNetwork(unexpectedWrites) : 'None');
  console.log(costStatement);
  console.log('artifact paths:');
  console.log(`  ${OUT}/step-36-before-run.png`);
  console.log(`  ${OUT}/step-36-after-click.png`);
  console.log(`  ${OUT}/step-36-final-state.png`);
  console.log(`  ${OUT}/step-36-run-network.json`);
  console.log('STOP COMPLETELY: no further Discovery interaction');
} finally {
  await browser.close();
}
