import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE_URL = 'https://arrival-atlas.pro';
const OUT = 'tools/black-box-audit/artifacts/probe-003';
const DISCOVERY_NAV_RE = /Пошук|Поиск|Discovery/i;
const GUIDED_RE = /Почати супроводжуваний шлях/i;
const SELF_RE = /Досліджувати самостійно/i;
const NEW_PROFILE_RE = /Новый профиль|Новий профіль|New profile/i;

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
let phase = 'before-click';

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

function classifyRequest(entry) {
  const payload = String(entry.requestPayload || '');
  return {
    discoveryApi: /\/api\/modules\/discovery/i.test(entry.url),
    discoveryPage: /\/modules\/discovery/i.test(entry.url) && !/\/api\//.test(entry.url),
    execute: /\/execute/i.test(entry.url),
    mutations: /\/api\/mutations/i.test(entry.url),
    uiSnapshot: /\/api\/ui-snapshot/i.test(entry.url),
    userContext: /\/api\/user-context/i.test(entry.url),
    payloadLooksLikeQueryOrPrompt: /prompt|query|search|generate|recommend|discovery|messages|profile/i.test(
      payload
    ),
    executionLike: looksLikeExecution(entry),
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

async function dumpDialog() {
  const dialog = page.getByRole('dialog');
  const visible = await dialog.first().isVisible().catch(() => false);
  if (!visible) {
    return { visible: false, count: await dialog.count().catch(() => 0) };
  }
  const first = dialog.first();
  const title = await first.evaluate(el => {
    const heading = el.querySelector('h1, h2, h3');
    return (el.getAttribute('aria-label') || heading?.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
  }).catch(() => null);
  const text = await first.innerText().catch(() => '');
  const buttons = await first.locator('button, a').evaluateAll(els =>
    els.map(el => ({
      tag: el.tagName,
      text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
      href: el.getAttribute('href'),
      type: el.getAttribute('type'),
      disabled: Boolean(el.disabled) || el.getAttribute('aria-disabled') === 'true',
    }))
  ).catch(() => []);
  return {
    visible: true,
    count: await dialog.count().catch(() => 0),
    title,
    text: text.replace(/\s+/g, ' ').trim().slice(0, 1200),
    buttons,
  };
}

async function dumpDiscoverySurface() {
  return page.evaluate(() => {
    const textOf = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
    const inputs = [...document.querySelectorAll('input, textarea, select')].map(el => ({
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type'),
      id: el.id || null,
      name: el.getAttribute('name'),
      placeholder: el.getAttribute('placeholder'),
      ariaLabel: el.getAttribute('aria-label'),
      value: el.value,
      checked: el.type === 'checkbox' || el.type === 'radio' ? el.checked : undefined,
      disabled: el.disabled,
      readOnly: el.readOnly,
    }));
    const searchInputs = inputs.filter(
      el =>
        /search|query|q|discover|find/i.test(`${el.type} ${el.name} ${el.id} ${el.placeholder} ${el.ariaLabel}`) ||
        el.type === 'search'
    );
    const radios = inputs.filter(el => el.type === 'radio');
    const checkboxes = inputs.filter(el => el.type === 'checkbox');
    const selects = inputs.filter(el => el.tag === 'select');
    const filters = [...document.querySelectorAll('select, [role="combobox"], [role="listbox"], [aria-haspopup="listbox"]')]
      .map(el => ({
        tag: el.tagName,
        role: el.getAttribute('role'),
        name: el.getAttribute('name'),
        id: el.id || null,
        ariaLabel: el.getAttribute('aria-label'),
        text: textOf(el).slice(0, 200),
      }));
    const progress = [...document.querySelectorAll('[role="progressbar"], progress, [class*="progress"], [class*="step"]')]
      .map(el => ({
        tag: el.tagName,
        role: el.getAttribute('role'),
        ariaValueNow: el.getAttribute('aria-valuenow'),
        ariaValueMax: el.getAttribute('aria-valuemax'),
        text: textOf(el).slice(0, 200),
      }))
      .filter(item => item.text || item.ariaValueNow)
      .slice(0, 12);
    const cards = [...document.querySelectorAll('[class*="card"], [class*="Card"], [class*="result"], [class*="Result"]')]
      .map(el => textOf(el).slice(0, 240))
      .filter(Boolean)
      .slice(0, 12);
    return {
      inputs,
      searchInputs,
      radios,
      checkboxes,
      selects,
      filters,
      progress,
      cards,
    };
  });
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
  const links = await page.getByRole('link').evaluateAll(els =>
    els.map(el => ({
      text: el.textContent.trim(),
      href: el.getAttribute('href'),
    }))
  );
  const snapshot = await page.locator('body').ariaSnapshot();
  const visibleText = await page.locator('body').innerText();
  const statusBanners = await page.locator('[role="status"]').allTextContents().catch(() => []);
  const alerts = await page.locator('[role="alert"]').allTextContents().catch(() => []);
  const arrivingFrom = await page.getByText(/Arriving from/i).allTextContents().catch(() => []);
  const surface = await dumpDiscoverySurface();
  const dialog = await dumpDialog();
  const guidedVisible = await page.getByRole('button', { name: GUIDED_RE }).isVisible().catch(() => false);
  const selfVisible = await page.getByRole('button', { name: SELF_RE }).isVisible().catch(() => false);
  const newProfileVisible = await page.getByRole('button', { name: NEW_PROFILE_RE }).isVisible().catch(() => false);
  const aiHintInText = /AI|LLM|OpenAI|provider|token|cost|credit|generate|recommend/i.test(
    `${visibleText}\n${snapshot}`
  );
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
    surface,
    dialog,
    guidedVisible,
    selfVisible,
    newProfileVisible,
    aiHintInText,
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
  console.log('LINKS:', dump.links);
  console.log('DIALOG:', dump.dialog);
  console.log('GUIDED OPTION VISIBLE:', dump.guidedVisible ? 'YES' : 'NO');
  console.log('SELF-DIRECTED OPTION VISIBLE:', dump.selfVisible ? 'YES' : 'NO');
  console.log('NEW PROFILE VISIBLE:', dump.newProfileVisible ? 'YES' : 'NO');
  console.log('ARRIVING FROM:', dump.arrivingFrom.length ? dump.arrivingFrom : 'Not found');
  console.log('STATUS BANNERS:', dump.statusBanners.length ? dump.statusBanners : 'None');
  console.log('FORMS:', dump.formCount);
  console.log('SEARCH INPUTS:', dump.surface.searchInputs.length ? dump.surface.searchInputs : 'None');
  console.log('ALL INPUTS:', dump.surface.inputs.length ? dump.surface.inputs : 'None');
  console.log('RADIOS:', dump.surface.radios.length ? dump.surface.radios : 'None');
  console.log('CHECKBOXES:', dump.surface.checkboxes.length ? dump.surface.checkboxes : 'None');
  console.log('SELECTS:', dump.surface.selects.length ? dump.surface.selects : 'None');
  console.log('FILTER / CATEGORY / SORT-LIKE:', dump.surface.filters.length ? dump.surface.filters : 'None');
  console.log('PROGRESS / STEP-LIKE:', dump.surface.progress.length ? dump.surface.progress : 'None');
  console.log('CARDS / RESULT-LIKE:', dump.surface.cards.length ? dump.surface.cards : 'None');
  console.log('AI / COST / PROVIDER HINT IN TEXT:', dump.aiHintInText ? 'YES' : 'NO');
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

  const discoveryNav = page
    .getByRole('navigation', { name: /Основна навігація/i })
    .getByRole('link', { name: DISCOVERY_NAV_RE });
  console.log('SETUP: click Discovery nav');
  await discoveryNav.click({ timeout: 8000 });
  await page.waitForURL(/\/modules\/discovery/, { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(1500);
  console.log('SETUP: Discovery settled', page.url());
  console.log('SETUP: welcome dialog required and left untouched until the single action');
  console.log('SETUP: New Profile / Search / Generate / filters NOT used');

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

  console.log('');
  console.log('========================================');
  console.log('PROBE-002 / STEP 28 — DISCOVERY GUIDED ONBOARDING');
  console.log('========================================');
  console.log('INTENT/ACTION: click Почати супроводжуваний шлях only');

  const before = await dumpUi();
  logDump('BEFORE GUIDED CLICK', before);
  await page.screenshot({
    path: `${OUT}/step-28-before-guided.png`,
    fullPage: true,
  });
  console.log('SCREENSHOT BEFORE:', `${OUT}/step-28-before-guided.png`);

  if (!before.dialog.visible) {
    throw new Error('SETUP failed — Discovery welcome dialog not visible');
  }

  const guidedBtn = page.getByRole('dialog').getByRole('button', { name: GUIDED_RE });
  const selfBtn = page.getByRole('dialog').getByRole('button', { name: SELF_RE });
  const guidedLabel = (await guidedBtn.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
  const selfLabel = (await selfBtn.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
  const guidedVisible = await guidedBtn.isVisible().catch(() => false);
  const guidedEnabled = guidedVisible ? await guidedBtn.isEnabled().catch(() => false) : false;

  console.log('GUIDED OPTION LABEL:', guidedLabel || 'not found');
  console.log('SELF-DIRECTED OPTION LABEL:', selfLabel || 'not found');
  console.log('GUIDED VISIBLE/ENABLED:', guidedVisible, guidedEnabled);

  let clickMode = 'skipped';
  let clickError = null;
  if (!guidedVisible || !guidedEnabled) {
    console.log('ACTION: SKIPPED — guided option not available');
  } else {
    console.log('ACTION: Click Почати супроводжуваний шлях (normal). No further Discovery interaction.');
    phase = 'after-click';
    try {
      await guidedBtn.click({ timeout: 8000 });
      clickMode = 'normal';
      console.log('CLICK MODE: normal');
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(3000);
    } catch (error) {
      clickMode = 'failed';
      clickError = String(error.message || error).slice(0, 800);
      console.log('CLICK MODE: failed; force NOT used');
      console.log('CLICK ERROR:', clickError);
    }
  }

  console.log('CLICK MODE USED:', clickMode);
  console.log('STOP: New Profile / Search / Generate / type / filters / submit NOT USED');

  const after = await dumpUi();
  logDump('AFTER GUIDED CLICK', after);
  await page.screenshot({
    path: `${OUT}/step-28-after-guided.png`,
    fullPage: true,
  });

  await fs.writeFile(`${OUT}/step-28-discovery-guided-network.json`, JSON.stringify(captured, null, 2));

  const afterClick = captured.filter(entry => entry.phase === 'after-click');
  const executionAfter = afterClick.filter(looksLikeExecution);
  const discoveryAfter = afterClick.filter(looksLikeDiscoveryApi);
  const mutationsAfter = afterClick.filter(e => /\/api\/mutations/i.test(e.url));
  const executeUrls = [...new Set(executionAfter.map(e => `${e.method} ${e.url}`))];
  const newFailures = requestFailures.filter(f => f.phase === 'after-click');
  const rscPrefetchAborts = newFailures.filter(isRscPrefetchAbort);
  const otherFailures = newFailures.filter(failure => !isRscPrefetchAbort(failure));
  const urlChanged = before.url !== after.url;
  const autoExecution = executionAfter.length > 0;
  const errorsYes =
    consoleErrors.filter(e => e.phase === 'after-click').length > 0 ||
    pageErrors.filter(e => e.phase === 'after-click').length > 0 ||
    otherFailures.length > 0;
  const profileUi = /профил|profile/i.test(`${after.visibleText}\n${after.snapshot}`) && after.newProfileVisible;
  const searchUi = after.surface.searchInputs.length > 0;
  const hasInputs = after.surface.inputs.length > 0;

  console.log('');
  console.log('--- STEP 28 COMPARISON ---');
  console.log('URL BEFORE:', before.url);
  console.log('URL AFTER:', after.url);
  console.log('NAVIGATION OCCURRED:', urlChanged ? 'YES' : 'NO');
  console.log('TITLE AFTER:', after.title);
  console.log('LANG BEFORE/AFTER:', before.lang, '→', after.lang);
  console.log('CLICK MODE USED:', clickMode);
  if (clickError) {
    console.log('CLICK ERROR:', clickError);
  }
  console.log('DIALOG BEFORE:', before.dialog.visible ? 'VISIBLE' : 'NOT VISIBLE');
  console.log('DIALOG AFTER:', after.dialog.visible ? 'VISIBLE' : 'NOT VISIBLE');
  console.log('AFTER-CLICK INTERESTING NETWORK:', afterClick.length ? summarizeNetwork(afterClick) : 'None');
  console.log(
    'AFTER-CLICK EXECUTION-LIKE:',
    executionAfter.length ? summarizeNetwork(executionAfter) : 'None'
  );
  console.log(
    'AFTER-CLICK DISCOVERY API:',
    discoveryAfter.length ? summarizeNetwork(discoveryAfter) : 'None'
  );
  console.log(
    'AFTER-CLICK MUTATIONS:',
    mutationsAfter.length ? summarizeNetwork(mutationsAfter) : 'None'
  );
  console.log(
    autoExecution
      ? 'Discovery guided onboarding triggered an automatic execution request. No further Discovery interaction was performed.'
      : 'Discovery guided onboarding caused no observed AI/execution request.'
  );
  console.log('NETWORK ARTIFACT:', `${OUT}/step-28-discovery-guided-network.json`);
  console.log(
    'CONSOLE ERRORS (after click):',
    consoleErrors.filter(e => e.phase === 'after-click').length
      ? consoleErrors.filter(e => e.phase === 'after-click')
      : 'None'
  );
  console.log(
    'PAGE ERRORS (after click):',
    pageErrors.filter(e => e.phase === 'after-click').length
      ? pageErrors.filter(e => e.phase === 'after-click')
      : 'None'
  );
  console.log('REQUEST FAILURES (after click):', newFailures.length ? newFailures : 'None');
  console.log(
    'RSC/PREFETCH ABORTS (technical observation):',
    rscPrefetchAborts.length ? rscPrefetchAborts : 'None'
  );
  console.log('OTHER REQUEST FAILURES (after click):', otherFailures.length ? otherFailures : 'None');
  console.log('SCREENSHOT AFTER:', `${OUT}/step-28-after-guided.png`);

  console.log('');
  console.log('========================================');
  console.log('STEP 28 SUMMARY');
  console.log('========================================');
  console.log('STEP: 28');
  console.log('guided option label:', guidedLabel || 'not found');
  console.log('self-directed option label:', selfLabel || 'not found');
  console.log('URL before:', before.url);
  console.log('URL after:', after.url);
  console.log('navigation yes/no:', urlChanged ? 'yes' : 'no');
  console.log('document language:', after.lang);
  console.log(
    'resulting surface summary:',
    `H1=${after.headings.find(h => h.tag === 'H1')?.text || 'none'}; dialog=${after.dialog.visible}; forms=${after.formCount}; inputs=${after.surface.inputs.length}`
  );
  console.log('dialog/modal yes/no:', after.dialog.visible ? 'yes' : 'no');
  console.log('profile creation UI yes/no:', profileUi || after.newProfileVisible ? 'yes' : 'no');
  console.log('search UI yes/no:', searchUi ? 'yes' : 'no');
  console.log('inputs yes/no:', hasInputs ? 'yes' : 'no');
  console.log('execution request observed yes/no:', autoExecution ? 'yes' : 'no');
  console.log('potentially relevant execution endpoint(s):', executeUrls.length ? executeUrls : 'None');
  console.log('/api/mutations observed yes/no:', mutationsAfter.length ? 'yes' : 'no');
  console.log('automatic execution on guided entry yes/no:', autoExecution ? 'yes' : 'no');
  console.log('errors yes/no:', errorsYes ? 'yes' : 'no');
  console.log(
    autoExecution
      ? 'Discovery guided onboarding triggered an automatic execution request. No further Discovery interaction was performed.'
      : 'Discovery guided onboarding caused no observed AI/execution request.'
  );
  console.log('artifact paths:');
  console.log(`  ${OUT}/step-28-before-guided.png`);
  console.log(`  ${OUT}/step-28-after-guided.png`);
  console.log(`  ${OUT}/step-28-discovery-guided-network.json`);
} finally {
  await browser.close();
}
