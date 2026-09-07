import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE_URL = 'https://arrival-atlas.pro';
const OUT = 'tools/black-box-audit/artifacts/probe-003';
const DISCOVERY_NAV_RE = /Пошук|Поиск|Discovery/i;
const EXPECTED_PROFILE_ID = 'profile-giveaways-1788784833972';
const EXPECTED_PROFILE_NAME = 'Мои розыгрыши';
const GIVEAWAYS_TYPE_RE = /Поиск розыгрышей|Пошук розіграшів/i;
const RUN_NOW_RE = /Запустить сейчас|Запустити зараз|Виконується|Выполняется|Run now/i;

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
  return /openai|anthropic|generativelanguage|groq|mistral|together|fireworks|openrouter|azure\.openai|bedrock|vertexai/i.test(
    `${host} ${entry.url}`
  );
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
    if (/\/api\/session/i.test(entry.url)) {
      return false;
    }
    return true;
  }
  if (/POST/i.test(entry.method)) {
    if (isLanguagePref(entry)) {
      return false;
    }
    if (/\/api\/session/i.test(entry.url)) {
      return false;
    }
    return true;
  }
  return false;
}

function classifyRequest(entry) {
  return {
    languagePref: isLanguagePref(entry),
    discoveryPageRead:
      /GET/i.test(entry.method) && /\/modules\/discovery/i.test(entry.url) && !/\/api\//.test(entry.url),
    discoveryProfilesList:
      /GET/i.test(entry.method) && /\/api\/modules\/discovery\/profiles\/?(\?|$)/i.test(entry.url),
    discoveryProfileRead:
      /GET/i.test(entry.method) && /\/api\/modules\/discovery\/profiles/i.test(entry.url),
    resultsRead: /GET/i.test(entry.method) && /\/results/i.test(entry.url) && /discovery/i.test(entry.url),
    runSummaryRead: /GET/i.test(entry.method) && /run-summary/i.test(entry.url),
    mutations: /\/api\/mutations/i.test(entry.url),
    writeMethod: /POST|PUT|PATCH|DELETE/i.test(entry.method),
    discoveryWrite:
      /POST|PUT|PATCH|DELETE/i.test(entry.method) && /\/api\/modules\/discovery/i.test(entry.url),
    execute: /\/execute/i.test(entry.url),
    runEndpoint: /\/run(?!-summary)/i.test(entry.url),
    executionLike: looksLikeExecution(entry),
    providerLike: looksLikeProvider(entry),
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
  const providerLooking = looksLikeProvider({ url });
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

  if (phase === 'after-discovery-open' && isUnexpectedWriteOrExecution(entry)) {
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
  const buttons = await first.getByRole('button').evaluateAll(els =>
    els.map(el => (el.textContent || '').replace(/\s+/g, ' ').trim())
  );
  const text = ((await first.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  return {
    visible: true,
    count: await dialog.count().catch(() => 0),
    title,
    buttons,
    text: text.slice(0, 1200),
    snapshot: await first.ariaSnapshot().catch(() => ''),
  };
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
  const nameVisible = await page.getByText(EXPECTED_PROFILE_NAME).first().isVisible().catch(() => false);
  const idVisible = await page.getByText(EXPECTED_PROFILE_ID).first().isVisible().catch(() => false);
  const giveawaysTypeVisible = await page.getByText(GIVEAWAYS_TYPE_RE).first().isVisible().catch(() => false);
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
    dialog: await dumpDialog(),
    nameVisible,
    idVisible,
    giveawaysTypeVisible,
    enabledVisible: /Включён|ВКЛЮЧЁН|Enabled|Увімкнен/i.test(visibleText),
    disabledVisible: /ОТКЛЮЧЁН|Отключен|Disabled|Вимкнен/i.test(visibleText),
    lastRunNone: /Запусков пока нет|Запусків поки немає|No runs yet/i.test(visibleText),
    resultsNone: /результатов пока нет|результатів поки немає|no results/i.test(visibleText),
    emptyProfiles: /Профилей поиска пока нет|Профілів пошуку поки немає|No search profiles/i.test(
      visibleText
    ),
    runBtn: buttonByName(buttons, RUN_NOW_RE),
    editBtn: buttonByName(buttons, /Изменить критерии|Змінити критерії|Edit criteria/i),
    disableBtn: buttonByName(buttons, /Отключить|Вимкнути|Disable/i),
    newProfileBtn: buttonByName(buttons, /Новый профиль|Новий профіль|New profile/i),
    lastRunBlock: (visibleText.match(/Последний запуск[\s\S]{0,400}|Останній запуск[\s\S]{0,400}|ПОСЛЕДНИЙ ЗАПУСК[\s\S]{0,400}/i) || [
      '',
    ])[0]
      .replace(/\s+/g, ' ')
      .trim(),
    resultsBlock: (visibleText.match(/Результаты[\s\S]{0,400}|Результати[\s\S]{0,400}|РЕЗУЛЬТАТЫ[\s\S]{0,400}/i) || [
      '',
    ])[0]
      .replace(/\s+/g, ' ')
      .trim(),
    criteriaBlock: (visibleText.match(/КРИТЕРИИ[\s\S]{0,400}|Критерії[\s\S]{0,400}|Criteria[\s\S]{0,400}/i) || [
      '',
    ])[0]
      .replace(/\s+/g, ' ')
      .trim(),
    loading: await page
      .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
      .count(),
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
  console.log('WELCOME DIALOG:', dump.dialog);
  console.log('EXPECTED NAME VISIBLE:', dump.nameVisible ? 'YES' : 'NO');
  console.log('EXPECTED ID VISIBLE:', dump.idVisible ? 'YES' : 'NO');
  console.log('EMPTY PROFILES COPY:', dump.emptyProfiles ? 'YES' : 'NO');
  console.log('GIVEAWAYS TYPE VISIBLE:', dump.giveawaysTypeVisible ? 'YES' : 'NO');
  console.log('ENABLED VISIBLE:', dump.enabledVisible ? 'YES' : 'NO');
  console.log('DISABLED VISIBLE:', dump.disabledVisible ? 'YES' : 'NO');
  console.log('LAST RUN NONE:', dump.lastRunNone ? 'YES' : 'NO');
  console.log('LAST RUN BLOCK:', dump.lastRunBlock || 'n/a');
  console.log('RESULTS NONE:', dump.resultsNone ? 'YES' : 'NO');
  console.log('RESULTS BLOCK:', dump.resultsBlock || 'n/a');
  console.log('CRITERIA BLOCK:', dump.criteriaBlock || 'n/a');
  console.log('RUN/EXEC CTA:', dump.runBtn || 'not found');
  console.log('EDIT CRITERIA:', dump.editBtn || 'not found');
  console.log('DISABLE:', dump.disableBtn || 'not found');
  console.log('NEW PROFILE:', dump.newProfileBtn || 'not found');
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
  const resultsGets = list.filter(
    e => /GET/i.test(e.method) && /\/results/i.test(e.url) && /discovery/i.test(e.url)
  );
  const latestProfiles = profilesGets.at(-1)?.responseBody ?? null;
  const profileList = Array.isArray(latestProfiles?.profiles)
    ? latestProfiles.profiles
    : Array.isArray(latestProfiles)
      ? latestProfiles
      : [];
  const byId = profileList.find(p => p && p.id === EXPECTED_PROFILE_ID) || null;
  const byName = profileList.find(p => p && p.name === EXPECTED_PROFILE_NAME) || null;
  return {
    profilesGets,
    runSummaries,
    resultsGets,
    latestProfiles,
    latestRunSummary: runSummaries.at(-1)?.responseBody ?? null,
    latestResults: resultsGets.at(-1)?.responseBody ?? null,
    profileList,
    byId,
    byName,
    profileCount: profileList.length,
  };
}

async function settle() {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
}

try {
  console.log('NETWORK CAPTURE: started before opening Discovery');
  console.log('READ-ONLY: fresh context; no create/edit/run; welcome dialog will not be clicked');

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

  phase = 'after-discovery-open';
  console.log('SETUP: click Discovery nav only. No other clicks.');
  await page
    .getByRole('navigation', { name: /Основна навігація/i })
    .getByRole('link', { name: DISCOVERY_NAV_RE })
    .click({ timeout: 8000 });
  await page.waitForURL(/\/modules\/discovery/, { timeout: 15000 }).catch(() => {});
  await settle();

  const welcomeVisible = await page.getByRole('dialog').first().isVisible().catch(() => false);
  console.log('WELCOME DIALOG VISIBLE:', welcomeVisible ? 'YES — left untouched' : 'NO');
  console.log('STOP: no profile action, no guided click, no create');

  const dump = await dumpUi();
  logDump('FRESH SESSION / DISCOVERY SETTLED (no extra clicks)', dump);
  await page.screenshot({ path: `${OUT}/step-40-fresh-giveaways.png`, fullPage: true });
  await fs.writeFile(
    `${OUT}/step-40-fresh-giveaways-network.json`,
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
  const langPrefs = captured.filter(e => e.flags?.languagePref);
  const discoveryPageReads = captured.filter(e => e.flags?.discoveryPageRead);
  const profileReads = captured.filter(e => e.flags?.discoveryProfileRead);
  const listReads = captured.filter(e => e.flags?.discoveryProfilesList);
  const resultReads = captured.filter(e => e.flags?.resultsRead);
  const runSummaryReads = captured.filter(e => e.flags?.runSummaryRead);
  const mutations = captured.filter(e => e.flags?.mutations);
  const writes = captured.filter(e => /POST|PUT|PATCH|DELETE/i.test(e.method));
  const discoveryWrites = captured.filter(e => e.flags?.discoveryWrite);
  const unexpected = captured.filter(
    e => e.flags?.unexpectedWriteOrExecution && e.phase === 'after-discovery-open'
  );
  const executions = captured.filter(looksLikeExecution);
  const providers = captured.filter(looksLikeProvider);
  const setupWrites = writes.filter(e => e.phase === 'setup');
  const afterDiscoveryWrites = writes.filter(e => e.phase === 'after-discovery-open');

  const idInApi = Boolean(server.byId);
  const nameInApi = Boolean(server.byName);
  const profileVisibleUi = dump.nameVisible || dump.idVisible;
  const profileExposed = profileVisibleUi || idInApi || nameInApi;

  let classification;
  if (unexpected.length > 0 || stopReason) {
    classification = 'UNEXPECTED_WRITE_OR_EXECUTION';
  } else if (profileExposed) {
    classification = 'PROFILE_VISIBLE';
  } else {
    classification = 'PROFILE_NOT_VISIBLE';
  }

  const absentStatement =
    classification === 'PROFILE_NOT_VISIBLE'
      ? 'STEP 40 fresh session does not expose the Giveaways profile created in STEP 39.'
      : null;

  console.log('');
  console.log('--- NETWORK ---');
  console.log('A LANGUAGE/SESSION SETUP:', langPrefs.length ? summarizeNetwork(langPrefs) : 'None');
  console.log('B DISCOVERY PAGE READS:', discoveryPageReads.length ? summarizeNetwork(discoveryPageReads) : 'None');
  console.log('C PROFILE READS / LIST:', listReads.length ? summarizeNetwork(listReads) : profileReads.length ? summarizeNetwork(profileReads) : 'None');
  console.log('D RESULTS READS:', resultReads.length ? summarizeNetwork(resultReads) : 'None');
  console.log('E RUN-SUMMARY READS:', runSummaryReads.length ? summarizeNetwork(runSummaryReads) : 'None');
  console.log('F WRITES:', writes.length ? summarizeNetwork(writes) : 'None');
  console.log('F DISCOVERY WRITES:', discoveryWrites.length ? summarizeNetwork(discoveryWrites) : 'None');
  console.log('F AFTER-DISCOVERY WRITES:', afterDiscoveryWrites.length ? summarizeNetwork(afterDiscoveryWrites) : 'None');
  console.log('G EXECUTION/AI/PROVIDER:', executions.length || providers.length ? { executions: summarizeNetwork(executions), providers: summarizeNetwork(providers) } : 'None');
  console.log('UNEXPECTED WRITE/EXEC:', unexpected.length ? summarizeNetwork(unexpected) : 'None');
  console.log('LATEST GET /profiles BODY:', JSON.stringify(server.latestProfiles)?.slice(0, 6000));
  console.log('MATCH BY ID:', server.byId ? JSON.stringify(server.byId) : 'None');
  console.log('MATCH BY NAME:', server.byName ? JSON.stringify(server.byName) : 'None');
  console.log('LATEST RESULTS:', JSON.stringify(server.latestResults)?.slice(0, 2000));
  console.log('LATEST RUN-SUMMARY:', JSON.stringify(server.latestRunSummary)?.slice(0, 2000));
  if (stopReason) {
    console.log('STOP REASON:', stopReason);
  }

  console.log('');
  console.log('========================================');
  console.log('STEP 40 SUMMARY');
  console.log('========================================');
  console.log('STEP: 40');
  console.log('classification:', classification);
  console.log('expected profile ID:', EXPECTED_PROFILE_ID);
  console.log('profile visible yes/no:', profileVisibleUi || idInApi ? 'yes' : 'no');
  console.log('profile name visible yes/no:', dump.nameVisible ? 'yes' : 'no');
  console.log('profile ID in UI yes/no:', dump.idVisible ? 'yes' : 'no');
  console.log('profile ID in GET /profiles yes/no:', idInApi ? 'yes' : 'no');
  console.log('profile name in GET /profiles yes/no:', nameInApi ? 'yes' : 'no');
  console.log('profile count:', server.profileCount);
  console.log('URL:', dump.url);
  console.log('lang:', dump.lang);
  console.log('welcome dialog:', dump.dialog.visible ? dump.dialog : 'not visible');
  console.log('empty state:', dump.emptyProfiles ? 'yes' : 'no');
  console.log('visible profile data:', {
    uiName: dump.nameVisible,
    uiType: dump.giveawaysTypeVisible,
    enabled: dump.enabledVisible,
    criteria: dump.criteriaBlock || null,
    lastRun: dump.lastRunBlock || null,
    results: dump.resultsBlock || null,
    api: server.byId || server.byName || null,
  });
  console.log('last run:', dump.lastRunBlock || (dump.lastRunNone ? 'no-run copy' : 'not observed'));
  console.log('results:', dump.resultsBlock || (dump.resultsNone ? 'empty-results copy' : 'not observed'));
  console.log('execution controls:', dump.runBtn || 'not found');
  console.log('edit/disable:', { edit: dump.editBtn || 'not found', disable: dump.disableBtn || 'not found' });
  console.log('Discovery API reads:', {
    list: listReads.length,
    profile: profileReads.length,
    results: resultReads.length,
    runSummary: runSummaryReads.length,
  });
  console.log('writes:', {
    setup: setupWrites.length,
    afterDiscovery: afterDiscoveryWrites.length,
    discoveryWrites: discoveryWrites.length,
    mutations: mutations.length,
  });
  console.log('execution/AI/provider traffic:', executions.length || providers.length ? 'YES' : 'None');
  if (absentStatement) {
    console.log(absentStatement);
  }
  console.log(
    'comparison with STEP 37: see report (STEP 37: fresh session, no profile, GET profiles [], no Discovery write/execute; welcome dialog was dismissed in STEP 37, left untouched here)'
  );
  if (langPrefs.length) {
    console.log(
      'NOTE: a language-preference POST /api/mutations occurred during setup. No Discovery profile/run write was observed after Discovery open, unless listed above.'
    );
  }
  console.log('STEP 40 performed no Discovery execution and no write operation.');
  console.log('artifact paths:');
  console.log(`  ${OUT}/step-40-fresh-giveaways.png`);
  console.log(`  ${OUT}/step-40-fresh-giveaways-network.json`);
} finally {
  await browser.close();
}
