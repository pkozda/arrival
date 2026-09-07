import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE_URL = 'https://arrival-atlas.pro';
const OUT = 'tools/black-box-audit/artifacts/probe-003';
const DISCOVERY_NAV_RE = /Пошук|Поиск|Discovery/i;
const GUIDED_RE = /Почати супроводжуваний шлях/i;
const PROFILE_NAME_VALUE = 'Мой поиск работы';
const ROLE_VALUE = 'Frontend Developer';
const JOBS_TYPE_RE = /Поиск работы|Пошук роботи|Jobs/i;
const RUN_NOW_RE = /Запустить сейчас|Запустити зараз|Виконується|Выполняется|Run now/i;
const OBSERVE_MS = 10000;

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
let phase = 'before-discovery';

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
  return /openai|anthropic|generativelanguage|groq|mistral|together|fireworks|openrouter|azure\.openai|bedrock|vertexai|googleapis\.com\/v1beta/i.test(
    `${host} ${entry.url}`
  );
}

function classifyRequest(entry) {
  const payload = String(entry.requestPayload || '');
  return {
    languagePref:
      /\/api\/mutations/i.test(entry.url) && /preferredLanguage|pref\.update/i.test(payload),
    discoveryProfilesList:
      /GET/i.test(entry.method) && /\/api\/modules\/discovery\/profiles\/?(\?|$)/i.test(entry.url),
    discoveryProfileRead:
      /GET/i.test(entry.method) && /\/api\/modules\/discovery\/profiles/i.test(entry.url),
    resultsRead: /GET/i.test(entry.method) && /\/results/i.test(entry.url),
    runSummaryRead: /GET/i.test(entry.method) && /run-summary/i.test(entry.url),
    executionOrRunRead:
      /GET/i.test(entry.method) && /\/execute|\/run(?!-summary)|execution/i.test(entry.url),
    mutations: /\/api\/mutations/i.test(entry.url),
    writeMethod: /POST|PUT|PATCH|DELETE/i.test(entry.method),
    discoveryWrite:
      /POST|PUT|PATCH|DELETE/i.test(entry.method) && /\/api\/modules\/discovery/i.test(entry.url),
    execute: /\/execute/i.test(entry.url),
    executionLike: looksLikeExecution(entry),
    providerLike: looksLikeProvider(entry),
  };
}

async function recordResponse(response) {
  const request = response.request();
  const url = safeUrl(response.url());
  const method = request.method();
  const host = hostnameOf(url);
  const resourceType = request.resourceType();
  const isApp = /arrival-atlas\.pro$/i.test(host || '');
  const providerLooking = looksLikeProvider({ url, hostname: host });
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
    durationMs: entry.durationMs,
    method: entry.method,
    status: entry.status,
    hostname: entry.hostname,
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
  const namedProfileVisible = await page.getByText(PROFILE_NAME_VALUE).first().isVisible().catch(() => false);
  const jobsTypeVisible = await page.getByText(JOBS_TYPE_RE).first().isVisible().catch(() => false);
  const roleVisible = await page.getByText(ROLE_VALUE).first().isVisible().catch(() => false);
  const enabledVisible = /Включён|ВКЛЮЧЁН|Enabled|Увімкнен/i.test(visibleText);
  const lastRunNone = /Запусков пока нет|Запусків поки немає|No runs yet/i.test(visibleText);
  const resultsNone = /результатов пока нет|результатів поки немає|no results/i.test(visibleText);
  const emptyProfiles = /Профилей поиска пока нет|Профілів пошуку поки немає|No search profiles/i.test(
    visibleText
  );
  const runBtn = buttonByName(buttons, RUN_NOW_RE);
  const retryBtns = buttons.filter(b =>
    /повтор|retry|try again|ещё раз|ще раз/i.test(`${b.text} ${b.ariaLabel || ''}`)
  );
  const editBtn = buttonByName(buttons, /Изменить критерии|Змінити критерії|Edit criteria/i);
  const profileButtons = buttons.filter(b =>
    /Поиск работы|Пошук роботи|Jobs|Giveaways|Розыгрыш/i.test(b.text) ||
    b.text.includes(PROFILE_NAME_VALUE)
  );
  const lastRunBlock = (visibleText.match(/Последний запуск[\s\S]{0,400}|Останній запуск[\s\S]{0,400}/i) || [
    '',
  ])[0]
    .replace(/\s+/g, ' ')
    .trim();
  const resultsBlock = (visibleText.match(/Результаты[\s\S]{0,400}|Результати[\s\S]{0,400}/i) || [''])[0]
    .replace(/\s+/g, ' ')
    .trim();
  const loading = await page
    .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
    .count();
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
    namedProfileVisible,
    jobsTypeVisible,
    roleVisible,
    enabledVisible,
    lastRunNone,
    resultsNone,
    emptyProfiles,
    runBtn,
    retryBtns,
    editBtn,
    profileButtons,
    lastRunBlock,
    resultsBlock,
    loading,
    aiHits: findAiWording(`${visibleText}\n${snapshot}`),
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
  console.log('NAMED PROFILE VISIBLE:', dump.namedProfileVisible ? 'YES' : 'NO');
  console.log('EMPTY PROFILES COPY:', dump.emptyProfiles ? 'YES' : 'NO');
  console.log('JOBS TYPE VISIBLE:', dump.jobsTypeVisible ? 'YES' : 'NO');
  console.log('ROLE VISIBLE:', dump.roleVisible ? 'YES' : 'NO');
  console.log('ENABLED VISIBLE:', dump.enabledVisible ? 'YES' : 'NO');
  console.log('PROFILE-LIKE BUTTONS:', dump.profileButtons);
  console.log('LAST RUN NONE:', dump.lastRunNone ? 'YES' : 'NO');
  console.log('LAST RUN BLOCK:', dump.lastRunBlock || 'n/a');
  console.log('RESULTS NONE:', dump.resultsNone ? 'YES' : 'NO');
  console.log('RESULTS BLOCK:', dump.resultsBlock || 'n/a');
  console.log('RUN/EXEC CTA:', dump.runBtn || 'not found');
  console.log('EDIT CRITERIA:', dump.editBtn || 'not found');
  console.log('RETRY:', dump.retryBtns.length ? dump.retryBtns : 'None');
  console.log('LOADING:', dump.loading > 0 ? `YES (${dump.loading})` : 'None');
  console.log('ARRIVING FROM:', dump.arrivingFrom.length ? dump.arrivingFrom : 'Not found');
  console.log('AI / COST / PROVIDER WORD HITS:', dump.aiHits.length ? dump.aiHits : 'None');
  console.log('ALERTS:', dump.alerts.length ? dump.alerts : 'None');
  console.log('STATUS BANNERS:', dump.statusBanners.length ? dump.statusBanners : 'None');
  console.log('MAIN VISIBLE TEXT (first 8000 chars):');
  console.log((dump.visibleText || '').slice(0, 8000));
  console.log('ACCESSIBILITY SNAPSHOT:');
  console.log(dump.snapshot);
}

function extractServerDiscoveryState(list) {
  const profilesGets = list.filter(
    e => /GET/i.test(e.method) && /\/api\/modules\/discovery\/profiles\/?(\?|$)/i.test(e.url)
  );
  const runSummaries = list.filter(e => /GET/i.test(e.method) && /run-summary/i.test(e.url));
  const resultsGets = list.filter(e => /GET/i.test(e.method) && /\/results/i.test(e.url));
  const latestProfiles = profilesGets.at(-1)?.responseBody ?? null;
  const latestRunSummary = runSummaries.at(-1)?.responseBody ?? null;
  const latestResults = resultsGets.at(-1)?.responseBody ?? null;
  const profileList = Array.isArray(latestProfiles?.profiles)
    ? latestProfiles.profiles
    : Array.isArray(latestProfiles)
      ? latestProfiles
      : [];
  const named = profileList.find(p => p && p.name === PROFILE_NAME_VALUE) || null;
  return {
    profilesGets,
    runSummaries,
    resultsGets,
    latestProfiles,
    latestRunSummary,
    latestResults,
    profileList,
    named,
    profileCount: profileList.length,
    lastRun: latestRunSummary?.lastRun ?? latestRunSummary?.last_run ?? null,
    resultsArray: latestResults?.results ?? latestResults?.items ?? null,
  };
}

async function settle() {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

try {
  console.log('NETWORK CAPTURE: started before any app interaction');
  console.log('READ-ONLY: will not create profile, edit, save, run, or click profile actions');

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
  console.log('SETUP: click Discovery nav (no profile create, no run)');
  await page
    .getByRole('navigation', { name: /Основна навігація/i })
    .getByRole('link', { name: DISCOVERY_NAV_RE })
    .click({ timeout: 8000 });
  await page.waitForURL(/\/modules\/discovery/, { timeout: 15000 }).catch(() => {});
  await settle();

  const welcome = page.getByRole('dialog');
  if (await welcome.first().isVisible().catch(() => false)) {
    console.log('SETUP: click Почати супроводжуваний шлях (welcome only)');
    await welcome.getByRole('button', { name: GUIDED_RE }).click({ timeout: 8000 });
    await welcome.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    await settle();
  }

  const landing = await dumpUi();
  logDump('PRE-INTERACTION / LANDING (no profile control clicked)', landing);
  await page.screenshot({
    path: `${OUT}/step-37-fresh-session.png`,
    fullPage: true,
  });
  console.log('SCREENSHOT:', `${OUT}/step-37-fresh-session.png`);

  const profileFound = landing.namedProfileVisible;
  console.log('PROFILE FOUND:', profileFound ? 'YES' : 'NO');
  if (!profileFound) {
    console.log('STOP: required persistent profile not available. Will not recreate. No clicks.');
  } else {
    console.log('PROFILE FOUND: no profile action will be clicked');
  }

  phase = 'after-passive-observe';
  const observeStart = Date.now();
  let afterObserve = landing;
  const seqAtObserveStart = seq;
  while (Date.now() - observeStart < OBSERVE_MS) {
    await page.waitForTimeout(1000);
    afterObserve = await dumpUi();
  }
  const observeMs = Date.now() - observeStart;
  const pollingDuringObserve = captured.filter(e => e.phase === 'after-passive-observe');
  console.log('PASSIVE OBSERVE MS:', observeMs);
  console.log('REQUESTS DURING PASSIVE OBSERVE:', pollingDuringObserve.length);
  logDump('AFTER PASSIVE OBSERVE (still no clicks)', afterObserve);

  await fs.writeFile(
    `${OUT}/step-37-fresh-session-network.json`,
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

  const server = extractServerDiscoveryState(captured);
  const writes = captured.filter(e => /POST|PUT|PATCH|DELETE/i.test(e.method));
  const discoveryWrites = captured.filter(e => e.flags?.discoveryWrite);
  const executions = captured.filter(looksLikeExecution);
  const providers = captured.filter(looksLikeProvider);
  const mutations = captured.filter(e => /\/api\/mutations/i.test(e.url));
  const langPrefs = captured.filter(e => e.flags?.languagePref);
  const profileReads = captured.filter(e => e.flags?.discoveryProfileRead);
  const resultReads = captured.filter(e => e.flags?.resultsRead);
  const runSummaryReads = captured.filter(e => e.flags?.runSummaryRead);
  const executionReads = captured.filter(e => e.flags?.executionOrRunRead);
  const resultsEmpty =
    Array.isArray(server.resultsArray) && server.resultsArray.length === 0;
  const lastRunNull = server.lastRun == null;
  const uiEmptyRun = afterObserve.lastRunNone || landing.lastRunNone;
  const uiEmptyResults = afterObserve.resultsNone || landing.resultsNone;

  let classification;
  let classificationEvidence;
  if (!profileFound && server.named == null && (server.profileCount === 0 || landing.emptyProfiles)) {
    classification = 'PROFILE_NOT_AVAILABLE';
    classificationEvidence = `UI named profile visible=${profileFound}; emptyProfilesCopy=${landing.emptyProfiles}; GET profiles count=${server.profileCount}; named in response=${Boolean(server.named)}`;
  } else if (
    (profileFound || server.named) &&
    (server.lastRun != null || (Array.isArray(server.resultsArray) && server.resultsArray.length > 0)) &&
    (!uiEmptyRun || !uiEmptyResults)
  ) {
    classification = 'PERSISTED_AND_VISIBLE';
    classificationEvidence = `server lastRun=${JSON.stringify(server.lastRun)}; resultsLen=${server.resultsArray?.length}; UI lastRunNone=${afterObserve.lastRunNone}; resultsNone=${afterObserve.resultsNone}`;
  } else if (
    (profileFound || server.named) &&
    (server.lastRun != null || (Array.isArray(server.resultsArray) && server.resultsArray.length > 0)) &&
    uiEmptyRun &&
    uiEmptyResults
  ) {
    classification = 'PERSISTED_SERVER_STATE_NOT_VISIBLE';
    classificationEvidence = `server lastRun=${JSON.stringify(server.lastRun)}; results=${JSON.stringify(server.resultsArray)?.slice(0, 500)}; UI still empty-run/empty-results`;
  } else if (
    (profileFound || server.named) &&
    lastRunNull &&
    (server.resultsArray == null || resultsEmpty) &&
    uiEmptyRun &&
    uiEmptyResults
  ) {
    classification = 'NO_PERSISTED_EXECUTION_STATE_OBSERVED';
    classificationEvidence = `GET run-summary lastRun=${JSON.stringify(server.lastRun)}; GET results=${JSON.stringify(server.resultsArray)}; UI lastRunNone=${afterObserve.lastRunNone}; resultsNone=${afterObserve.resultsNone}`;
  } else if (!profileFound && server.named == null) {
    classification = 'PROFILE_NOT_AVAILABLE';
    classificationEvidence = `UI named profile visible=false; GET profiles=${JSON.stringify(server.latestProfiles)?.slice(0, 800)}`;
  } else {
    classification = 'AMBIGUOUS';
    classificationEvidence = `UI found=${profileFound}; emptyProfiles=${landing.emptyProfiles}; serverCount=${server.profileCount}; lastRun=${JSON.stringify(server.lastRun)}; results=${JSON.stringify(server.resultsArray)?.slice(0, 400)}`;
  }

  const specialEmptyCase =
    classification === 'NO_PERSISTED_EXECUTION_STATE_OBSERVED' ||
    (lastRunNull &&
      resultsEmpty &&
      (afterObserve.lastRunNone || landing.lastRunNone) &&
      (afterObserve.resultsNone || landing.resultsNone) &&
      profileFound);

  console.log('');
  console.log('--- NETWORK CLASSIFICATION ---');
  console.log('A LANGUAGE/PREFERENCE:', langPrefs.length ? summarizeNetwork(langPrefs) : 'None');
  console.log('B DISCOVERY PROFILE READS:', profileReads.length ? summarizeNetwork(profileReads) : 'None');
  console.log('C RESULT READS:', resultReads.length ? summarizeNetwork(resultReads) : 'None');
  console.log('D RUN-SUMMARY READS:', runSummaryReads.length ? summarizeNetwork(runSummaryReads) : 'None');
  console.log('E EXECUTION/RUN READS:', executionReads.length ? summarizeNetwork(executionReads) : 'None');
  console.log('F MUTATIONS/WRITES:', writes.length ? summarizeNetwork(writes) : 'None');
  console.log('F DISCOVERY WRITES:', discoveryWrites.length ? summarizeNetwork(discoveryWrites) : 'None');
  console.log('G AI/PROVIDER:', providers.length ? summarizeNetwork(providers) : 'None');
  console.log('EXECUTE-LIKE:', executions.length ? summarizeNetwork(executions) : 'None');
  console.log('POLLING DURING 10s OBSERVE:', pollingDuringObserve.length ? summarizeNetwork(pollingDuringObserve) : 'None');
  console.log('LATEST PROFILES BODY:', JSON.stringify(server.latestProfiles)?.slice(0, 4000));
  console.log('LATEST RUN-SUMMARY BODY:', JSON.stringify(server.latestRunSummary)?.slice(0, 4000));
  console.log('LATEST RESULTS BODY:', JSON.stringify(server.latestResults)?.slice(0, 4000));
  console.log('NAMED PROFILE FROM GET:', server.named ? JSON.stringify(server.named).slice(0, 2000) : 'None');

  console.log('');
  console.log('========================================');
  console.log('STEP 37 SUMMARY');
  console.log('========================================');
  console.log('STEP: 37');
  console.log('fresh session = yes');
  console.log('profile found = ', profileFound ? 'yes' : 'no');
  console.log('number of profiles:', server.profileCount);
  console.log('profile ID:', server.named?.id || 'n/a');
  console.log(
    'profile configuration:',
    server.named
      ? JSON.stringify({
          name: server.named.name,
          strategyId: server.named.strategyId,
          criteria: server.named.criteria,
          schedule: server.named.schedule,
          notification: server.named.notification,
          enabled: server.named.enabled,
        })
      : 'n/a (profile not in GET list)'
  );
  console.log('URL:', afterObserve.url);
  console.log('navigation: Discovery opened; no further navigation');
  console.log('lang:', afterObserve.lang);
  console.log(
    'UI state:',
    `emptyProfiles=${afterObserve.emptyProfiles}; namedVisible=${afterObserve.namedProfileVisible}; jobsType=${afterObserve.jobsTypeVisible}; enabled=${afterObserve.enabledVisible}; role=${afterObserve.roleVisible}`
  );
  console.log('last-run UI state:', afterObserve.lastRunBlock || (afterObserve.lastRunNone ? 'no-run copy present' : 'no last-run copy'));
  console.log('results UI state:', afterObserve.resultsBlock || (afterObserve.resultsNone ? 'empty-results copy present' : 'no results copy'));
  console.log('execution CTA state:', afterObserve.runBtn || 'not found');
  console.log('run/execution ID if any:', 'None observed in UI');
  console.log('server-side run-summary state:', JSON.stringify(server.latestRunSummary));
  console.log('server-side results state:', JSON.stringify(server.latestResults));
  console.log('all relevant GET/read requests:', summarizeNetwork([...profileReads, ...resultReads, ...runSummaryReads, ...executionReads]));
  console.log('any write requests:', writes.length ? summarizeNetwork(writes) : 'None');
  console.log('any /execute/run requests:', executions.length ? summarizeNetwork(executions) : 'None');
  console.log('any AI/provider requests:', providers.length ? summarizeNetwork(providers) : 'None');
  console.log('automatic polling, if any:', pollingDuringObserve.length ? summarizeNetwork(pollingDuringObserve) : 'None');
  console.log('final classification:', classification);
  console.log('exact evidence supporting the classification:', classificationEvidence);
  if (specialEmptyCase) {
    console.log(
      'SPECIAL CASE: UI empty-run/empty-results copy together with lastRun:null and results:[] would mean STEP 36 left no observable persisted run/result state on the normal Discovery read path at this time. That does not by itself prove the backend never received or processed the STEP 36 click.'
    );
  }
  console.log('artifact paths:');
  console.log(`  ${OUT}/step-37-fresh-session.png`);
  console.log(`  ${OUT}/step-37-fresh-session-network.json`);
  console.log('No execution control was clicked during STEP 37.');
  if (langPrefs.length) {
    console.log(
      'NOTE: a language-preference POST /api/mutations occurred during setup. No Discovery profile/run write was observed.'
    );
  }
  console.log('STEP 37 performed no Discovery execution and no write operation.');
} finally {
  await browser.close();
}
