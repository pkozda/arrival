import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE_URL = 'https://arrival-atlas.pro';
const OUT = 'tools/black-box-audit/artifacts/probe-005';
const PROFILE_NAV_RE = /Профіль|Профиль|Profile/i;
const WORK_INCOME_RE = /Work\s*&\s*income|Робота та дохід|Work and income/i;
const EMPLOYMENT_RE =
  /work|jobs?|employment|employed|employer|career|profession|income|salary|opportunity|opportunities|discovery|поиск|пошук|вакан|зайнят|працевлашт|робот|кар[ʼ'’]?єр|дохід|зарплат|можливост/i;
const WORK_TERM_RE =
  /work|job|jobs|employment|employed|career|income|salary|profession|opportunity|discovery|вакан|зайнят|працевлашт|робот|кар[ʼ'’]?єр|дохід|зарплат/i;

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
    documentNav: /GET/i.test(entry.method) && /document/i.test(entry.resourceType || ''),
    profileRead: /GET/i.test(entry.method) && /\/api\/(user-context|profile-insights|ui-snapshot|profile)/i.test(entry.url),
    discoveryRead: /GET/i.test(entry.method) && /\/api\/modules\/discovery/i.test(entry.url),
    lifeEventRead: /GET/i.test(entry.method) && /\/api\/modules\/life-event/i.test(entry.url),
    mutations: /\/api\/mutations/i.test(entry.url),
    writeMethod: /POST|PUT|PATCH|DELETE/i.test(entry.method),
    execute: /\/execute/i.test(entry.url),
    executionLike: looksLikeExecution(entry),
    providerLike: looksLikeProvider(entry),
    workIncomePath: /work-income|work.?income/i.test(entry.url),
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
    /\/api\/|\/modules\/|_rsc|rsc=|mutation|execute|\/run|ui-snapshot|user-context|profile|work|job|employment|discovery|openai|anthropic|\/ai\//i.test(
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
  if (phase === 'after-work-income-click' && isUnexpectedWriteOrExecution(entry)) {
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
  }));
}

function classifyActionDestinations(links, buttons) {
  const items = [
    ...(links || []).map(l => ({ kind: 'link', text: l.text, href: l.href })),
    ...(buttons || []).map(b => ({ kind: 'button', text: b.text, href: null })),
  ];
  const destinations = {
    discovery: [],
    jobs: [],
    workGrowth: [],
    lifeEvents: [],
    anotherEmploymentModule: [],
    onlyEditing: [],
    nowhereOrOther: [],
  };
  for (const item of items) {
    const blob = `${item.text || ''} ${item.href || ''}`;
    if (/\/modules\/discovery|поиск|пошук|discovery/i.test(blob)) {
      destinations.discovery.push(item);
    } else if (/job|jobs|вакан|giveaway|розыгрыш|розіграш/i.test(blob) && /\/modules\//i.test(item.href || '')) {
      destinations.jobs.push(item);
    } else if (/work\s*&\s*growth|\/#|зростан/i.test(blob) && !/work-income/i.test(blob)) {
      destinations.workGrowth.push(item);
    } else if (/\/modules\/life-event|життєві події/i.test(blob)) {
      destinations.lifeEvents.push(item);
    } else if (/\/modules\//i.test(item.href || '') && /work|job|employ|career/i.test(blob)) {
      destinations.anotherEmploymentModule.push(item);
    } else if (/\/profile\/work-income\/edit|редагув|виправити|edit section|edit/i.test(blob)) {
      destinations.onlyEditing.push(item);
    } else if (/benefits.?simulator|показати весь|show (full|entire)|провідник|guide/i.test(blob)) {
      destinations.nowhereOrOther.push(item);
    }
  }
  return destinations;
}

async function dumpGraphNodes() {
  return page
    .getByRole('listbox', { name: /Consequence graph nodes/i })
    .getByRole('button')
    .evaluateAll(els =>
      els.map(el => ({
        text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
        disabled: el.disabled,
        ariaDisabled: el.getAttribute('aria-disabled'),
        ariaSelected: el.getAttribute('aria-selected'),
        visible: el.offsetParent !== null || el.getClientRects().length > 0,
      }))
    )
    .catch(() => []);
}

async function dumpInspector() {
  return page.evaluate(() => {
    const textOf = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
    const root = document.querySelector('[role="complementary"]') || document.querySelector('aside');
    if (!root) {
      return null;
    }
    const titleEl = root.querySelector('h3, h2, h1');
    const firstParagraph = root.querySelector('p');
    const sections = {};
    for (const heading of root.querySelectorAll('h4, h3')) {
      const key = textOf(heading);
      const parts = [];
      let next = heading.nextElementSibling;
      while (next && !/^H[1-4]$/.test(next.tagName)) {
        parts.push(textOf(next));
        next = next.nextElementSibling;
      }
      sections[key] = parts.join(' ').trim();
    }
    const actions = [...root.querySelectorAll('a, button')].map(el => ({
      tag: el.tagName,
      text: textOf(el),
      href: el.getAttribute('href'),
      disabled: Boolean(el.disabled) || el.getAttribute('aria-disabled') === 'true',
    }));
    const terms = [...root.querySelectorAll('dt, dd')].map(el => ({
      tag: el.tagName,
      text: textOf(el),
    }));
    return {
      title: titleEl ? textOf(titleEl) : null,
      statusParagraph: firstParagraph ? textOf(firstParagraph) : null,
      sections,
      actions,
      terms,
      raw: textOf(root).slice(0, 4000),
    };
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
  const inputs = await page.locator('input, select, textarea').evaluateAll(els =>
    els.map(el => ({
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type'),
      id: el.id || null,
      visible: el.offsetParent !== null || el.getClientRects().length > 0,
    }))
  );
  const snapshot = await page.locator('body').ariaSnapshot();
  const visibleText = await page.locator('body').innerText();
  const graphNodes = await dumpGraphNodes();
  const inspector = await dumpInspector();
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
  const workBtn = buttons.find(b => WORK_INCOME_RE.test(`${b.text} ${b.ariaLabel || ''}`));
  const workNode = graphNodes.find(n => WORK_INCOME_RE.test(n.text || ''));
  const destinations = classifyActionDestinations(links, buttons);
  const blob = `${visibleText}\n${snapshot}\n${JSON.stringify(inspector || {})}`;
  return {
    url: page.url(),
    title: await page.title(),
    lang: await page.locator('html').getAttribute('lang'),
    headings,
    buttons,
    links,
    inputs,
    formCount: await page.locator('form').count(),
    graphNodes,
    inspector,
    currentItems,
    workBtn,
    workNode,
    destinations,
    workTermHits: [...new Set((blob.match(new RegExp(WORK_TERM_RE.source, 'gi')) || []).map(s => s.toLowerCase()))],
    employmentHits: [...new Set((blob.match(new RegExp(EMPLOYMENT_RE.source, 'gi')) || []).map(s => s.toLowerCase()))],
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
  console.log('INPUTS:', dump.inputs);
  console.log('FORM COUNT:', dump.formCount);
  console.log('GRAPH NODES:', dump.graphNodes);
  console.log('CURRENT/SELECTED:', dump.currentItems);
  console.log('WORK & INCOME BUTTON:', dump.workBtn || 'not found');
  console.log('WORK & INCOME GRAPH NODE:', dump.workNode || 'not found');
  console.log('INSPECTOR:', dump.inspector || 'None');
  console.log('ACTION DESTINATIONS:', dump.destinations);
  console.log('WORK TERM HITS:', dump.workTermHits?.length ? dump.workTermHits : 'None');
  console.log('EMPLOYMENT-LIKE HITS:', dump.employmentHits?.length ? dump.employmentHits : 'None');
  console.log('LOADING:', dump.loading > 0 ? `YES (${dump.loading})` : 'None');
  console.log('ALERTS:', dump.alerts?.length ? dump.alerts : 'None');
  console.log('MAIN VISIBLE TEXT (first 8000 chars):');
  console.log((dump.visibleText || '').slice(0, 8000));
  console.log('ACCESSIBILITY SNAPSHOT:');
  console.log(dump.snapshot);
}

function isUiDisabled(control) {
  if (!control) {
    return true;
  }
  return Boolean(control.disabled) || control.ariaDisabled === 'true';
}

function classifySurface(dump, clickMode) {
  if (clickMode === 'skipped-disabled') {
    return 'Work & income node present but disabled — not opened';
  }
  if (clickMode === 'skipped' || clickMode === 'not-found') {
    return 'Work & income node not found / not clicked';
  }
  const url = dump.url || '';
  const text = dump.visibleText || '';
  const inspector = dump.inspector || {};
  const dest = dump.destinations || {};
  const hasDiscoveryBridge = (dest.discovery || []).length > 0 || (dest.jobs || []).length > 0;
  const hasEdit = (dest.onlyEditing || []).length > 0;
  const hasOtherEmployment = (dest.anotherEmploymentModule || []).length > 0 || (dest.workGrowth || []).length > 0;
  const visibleInputs = (dump.inputs || []).filter(i => i.visible && i.type !== 'hidden');

  if (/\/profile\/work-income\/edit/i.test(url) || (dump.formCount > 0 && visibleInputs.length > 0)) {
    return 'entry point to editing (form/edit route)';
  }
  if (hasDiscoveryBridge || hasOtherEmployment) {
    return 'employment action hub (bridge actions present)';
  }
  if (hasEdit && /context|unlocks|blocked|actions|not added|complete|confidence/i.test(`${text} ${inspector.raw || ''}`)) {
    return 'state/inspector node with edit affordance (not an employment action hub)';
  }
  if (/context|unlocks|blocked|actions|not added|complete|confidence/i.test(`${text} ${inspector.raw || ''}`)) {
    return 'state/inspector node / read-only summary';
  }
  if (/\/profile\/work-income\/?(\?|$)/i.test(url)) {
    return 'read-only Work & income section page';
  }
  return 'another Profile surface — see after evidence';
}

async function settle() {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

try {
  console.log('NETWORK CAPTURE: started before onboarding');
  console.log('READ-ONLY STEP 47: one click Work & income; no edit/save/discovery');

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

  phase = 'before-work-income-click';
  const before = await dumpUi();
  logDump('BEFORE WORK & INCOME CLICK (PROFILE BASELINE)', before);
  await page.screenshot({ path: `${OUT}/step-47-before-work-income.png`, fullPage: true });

  const sectionBtn = page.getByRole('button', { name: WORK_INCOME_RE });
  const sectionVisible = await sectionBtn.first().isVisible().catch(() => false);
  const sectionCount = await sectionBtn.count().catch(() => 0);
  let targetState = null;
  if (sectionVisible) {
    targetState = {
      visible: true,
      disabled: await sectionBtn.first().isDisabled().catch(() => null),
      ariaDisabled: await sectionBtn.first().getAttribute('aria-disabled').catch(() => null),
      ariaSelected: await sectionBtn.first().getAttribute('aria-selected').catch(() => null),
      text: ((await sectionBtn.first().innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim(),
    };
  }
  console.log('WORK & INCOME VISIBLE:', sectionVisible ? 'YES' : 'NO');
  console.log('WORK & INCOME COUNT:', sectionCount);
  console.log('WORK & INCOME STATE:', targetState || before.workBtn || before.workNode || 'not found');

  const uiDisabled = targetState
    ? Boolean(targetState.disabled) || targetState.ariaDisabled === 'true'
    : isUiDisabled(before.workBtn) || isUiDisabled(before.workNode);

  let clickMode = 'skipped';
  let clickError = null;
  if (!sectionVisible && !before.workBtn && !before.workNode) {
    clickMode = 'not-found';
    console.log('CLICK SKIPPED: Work & income control not found');
  } else if (uiDisabled) {
    clickMode = 'skipped-disabled';
    console.log('CLICK SKIPPED: Work & income is disabled; force NOT used');
    stopReason = stopReason || 'Work & income node disabled — inspection only';
  } else {
    console.log('ACTION: click Work & income once. No edit. No discovery. No further click.');
    phase = 'after-work-income-click';
    try {
      await sectionBtn.first().click({ timeout: 8000 });
      clickMode = 'normal';
      await settle();
    } catch (error) {
      clickMode = 'failed';
      clickError = String(error.message || error).slice(0, 800);
      console.log('CLICK FAILED; force NOT used:', clickError);
    }
  }

  const after = await dumpUi();
  logDump('AFTER WORK & INCOME ACTION', after);
  await page.screenshot({ path: `${OUT}/step-47-after-work-income.png`, fullPage: true });
  await fs.writeFile(
    `${OUT}/step-47-work-income-network.json`,
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

  const afterNet = captured.filter(e => e.phase === 'after-work-income-click');
  const reads = afterNet.filter(e => /GET/i.test(e.method));
  const writes = afterNet.filter(e => /POST|PUT|PATCH|DELETE/i.test(e.method));
  const mutations = afterNet.filter(e => e.flags?.mutations);
  const executions = afterNet.filter(looksLikeExecution);
  const providers = afterNet.filter(looksLikeProvider);
  const unexpected = afterNet.filter(e => e.flags?.unexpectedWriteOrExecution);
  const rsc = afterNet.filter(e => e.flags?.rsc);
  const urlChanged = before.url !== after.url;
  const classification = classifySurface(after, clickMode);
  const inspectorActions = after.inspector?.actions || [];

  console.log('');
  console.log('--- STEP 47 COMPARISON ---');
  console.log('CLICK MODE:', clickMode);
  if (clickError) console.log('CLICK ERROR:', clickError);
  console.log('URL BEFORE:', before.url);
  console.log('URL AFTER:', after.url);
  console.log('NAVIGATION:', urlChanged ? 'YES' : 'NO');
  console.log('CLASSIFICATION:', classification);
  console.log('WORK NODE BEFORE:', before.workBtn || before.workNode || 'not found');
  console.log('WORK NODE AFTER:', after.workBtn || after.workNode || 'not found');
  console.log('INSPECTOR AFTER:', after.inspector || 'None');
  console.log('INSPECTOR ACTIONS:', inspectorActions.length ? inspectorActions : 'None');
  console.log('ACTION DESTINATIONS AFTER:', after.destinations);
  console.log('AFTER-CLICK NETWORK:', afterNet.length ? summarizeNetwork(afterNet) : 'None');
  console.log(
    'CONSOLE ERRORS AFTER:',
    consoleErrors.filter(e => e.phase === 'after-work-income-click').length
      ? consoleErrors.filter(e => e.phase === 'after-work-income-click')
      : 'None'
  );
  console.log(
    'PAGE ERRORS AFTER:',
    pageErrors.filter(e => e.phase === 'after-work-income-click').length
      ? pageErrors.filter(e => e.phase === 'after-work-income-click')
      : 'None'
  );
  console.log(
    'REQUEST FAILURES AFTER:',
    requestFailures.filter(e => e.phase === 'after-work-income-click').length
      ? requestFailures.filter(e => e.phase === 'after-work-income-click')
      : 'None'
  );
  if (stopReason) console.log('STOP REASON:', stopReason);

  console.log('');
  console.log('========================================');
  console.log('STEP 47 SUMMARY');
  console.log('========================================');
  console.log('STEP: 47');
  console.log('classification:', classification);
  console.log('click mode:', clickMode);
  console.log('URL before:', before.url);
  console.log('URL after:', after.url);
  console.log('navigation:', urlChanged ? 'yes' : 'no');
  console.log('lang:', after.lang);
  console.log('profile domains before:', before.graphNodes);
  console.log('work & income before state:', targetState || before.workBtn || before.workNode);
  console.log('selected after:', after.currentItems);
  console.log('inspector title/status:', {
    title: after.inspector?.title,
    status: after.inspector?.statusParagraph,
  });
  console.log('inspector sections:', after.inspector?.sections || null);
  console.log('inspector terms:', after.inspector?.terms || null);
  console.log('forms/inputs after:', { forms: after.formCount, inputs: after.inputs });
  console.log('work terms after:', after.workTermHits);
  console.log('employment destinations:', after.destinations);
  console.log('reads after click:', reads.length);
  console.log('rsc after click:', rsc.length);
  console.log('mutations after click:', mutations.length ? summarizeNetwork(mutations) : 'None');
  console.log('writes after click:', writes.length ? summarizeNetwork(writes) : 'None');
  console.log('execution/AI after click:', executions.length || providers.length ? 'YES' : 'None');
  console.log('unexpected writes after click:', unexpected.length ? summarizeNetwork(unexpected) : 'None');
  console.log('STEP 47 performed no intentional profile modification and no Discovery execution.');
  console.log('artifact paths:');
  console.log(`  ${OUT}/step-47-before-work-income.png`);
  console.log(`  ${OUT}/step-47-after-work-income.png`);
  console.log(`  ${OUT}/step-47-work-income-network.json`);
} finally {
  await browser.close();
}
