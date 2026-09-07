import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE_URL = 'https://arrival-atlas.pro';
const OUT = 'tools/black-box-audit/artifacts/probe-002';
const TRACKED_NODES = [
  'Завершити Anmeldung',
  'Забезпечити адресу для реєстрації',
  'Налаштувати банк і податковий шлях',
  'Зрозуміти обовʼязкове медичне страхування',
];

await fs.mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();

const consoleErrors = [];
const pageErrors = [];
const requestFailures = [];

page.on('console', msg => {
  if (msg.type() === 'error') {
    consoleErrors.push(msg.text());
  }
});

page.on('pageerror', error => {
  pageErrors.push(error.message);
});

page.on('requestfailed', request => {
  requestFailures.push({
    url: request.url(),
    method: request.method(),
    failure: request.failure()?.errorText ?? 'unknown',
  });
});

function isRscPrefetchAbort(failure) {
  const blob = `${failure.url} ${failure.method} ${failure.failure}`;
  return /_rsc|rsc=|prefetch|ERR_ABORTED|NS_BINDING_ABORTED|net::ERR_ABORTED/i.test(blob);
}

function trackedStates(graphNodes) {
  return TRACKED_NODES.map(label => {
    const matches = (graphNodes || []).filter(node =>
      new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(node.text || '')
    );
    return {
      label,
      found: matches.length > 0,
      matches,
    };
  });
}

function buttonKeys(buttons) {
  return (buttons || []).map(button => `${button.text}|disabled=${button.disabled}|ariaDisabled=${button.ariaDisabled}`);
}

function tokenDiff(before, after) {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  return {
    appeared: after.filter(item => !beforeSet.has(item)),
    disappeared: before.filter(item => !afterSet.has(item)),
  };
}

async function extraInventory() {
  return page.evaluate(() => {
    const textOf = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
    const selected = [...document.querySelectorAll('[aria-selected="true"], [aria-current="true"]')]
      .map(el => ({
        tag: el.tagName,
        role: el.getAttribute('role'),
        text: textOf(el),
        ariaSelected: el.getAttribute('aria-selected'),
        ariaCurrent: el.getAttribute('aria-current'),
        disabled: Boolean(el.disabled) || el.getAttribute('aria-disabled') === 'true',
      }))
      .filter(item => item.text);
    const graphNodes = [...document.querySelectorAll('[role="listbox"] button, [role="listbox"] [role="option"]')]
      .map(el => ({
        text: textOf(el),
        disabled: Boolean(el.disabled) || el.getAttribute('aria-disabled') === 'true',
        ariaSelected: el.getAttribute('aria-selected'),
        ariaCurrent: el.getAttribute('aria-current'),
        ariaPressed: el.getAttribute('aria-pressed'),
        ariaDisabled: el.getAttribute('aria-disabled'),
        nativeDisabled: Boolean(el.disabled),
      }));
    const complementary = [...document.querySelectorAll('[role="complementary"], aside')]
      .map(el => textOf(el).slice(0, 4000));
    return {
      selected,
      graphNodes,
      complementary,
      formCount: document.querySelectorAll('form').length,
      dialogs: [...document.querySelectorAll('[role="dialog"]')].map(el => textOf(el).slice(0, 240)),
      overlayCount: document.querySelectorAll(
        '[class*="overlay"], [class*="Overlay"], [class*="welcome"], [class*="Welcome"]'
      ).length,
    };
  });
}

function valueHits(visibleText, snapshot) {
  const blob = `${visibleText}\n${snapshot}`;
  const tokens = [
    { token: 'Bremen', re: /Bremen/ },
    { token: 'HB', re: /(^|[^A-Za-z])HB([^A-Za-z]|$)/ },
    { token: '€600', re: /€\s*600|600\s*€/ },
    { token: '€100', re: /€\s*100|100\s*€/ },
    { token: 'housing complete', re: /housing.*complete|Where you live.*Complete/i },
    { token: 'registration_confirmed', re: /registration_confirmed/i },
    { token: 'Blocked', re: /Blocked|BLOCKED|заблок/i },
    { token: 'prerequisite / dependency', re: /prerequisite|dependency|залежн|передумов/i },
  ];
  return tokens.map(item => ({
    token: item.token,
    present: item.re.test(blob),
  }));
}

function recommendedFromBanners(statusBanners) {
  const blob = (statusBanners || []).join(' ').replace(/\s+/g, ' ').trim();
  return blob || 'None';
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
      ariaSelected: el.getAttribute('aria-selected'),
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
  const inventory = await extraInventory();
  const statusBanners = await page.locator('[role="status"]').allTextContents().catch(() => []);
  const alerts = await page.locator('[role="alert"]').allTextContents().catch(() => []);
  const arrivingFrom = await page.getByText(/Arriving from/i).allTextContents().catch(() => []);
  return {
    url: page.url(),
    title: await page.title(),
    lang: await page.locator('html').getAttribute('lang'),
    headings,
    buttons,
    links,
    snapshot,
    visibleText,
    inventory,
    statusBanners,
    alerts,
    arrivingFrom,
    formCount: await page.locator('form').count(),
    dialogCount: await page.locator('[role="dialog"]').count(),
    loading: await page
      .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
      .count(),
    startVisible: await page.getByRole('button', { name: /Start intent|^Start$/i }).isVisible().catch(() => false),
    showRouteVisible: await page.getByRole('button', { name: /Показати маршрут/i }).isVisible().catch(() => false),
    welcomeVisible: await page.getByRole('dialog', { name: /Ласкаво просимо до Arrival Atlas/i }).isVisible().catch(() => false),
    anyDialogVisible: await page.getByRole('dialog').isVisible().catch(() => false),
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
  console.log('GRAPH NODES:', dump.inventory.graphNodes);
  console.log('TRACKED NODE STATES:', trackedStates(dump.inventory.graphNodes));
  console.log('SELECTED NODE:', dump.inventory.selected.length ? dump.inventory.selected : 'None detected');
  console.log('GUIDED / STATUS BANNERS:', dump.statusBanners.length ? dump.statusBanners : 'None');
  console.log('RECOMMENDED / BANNER BLOB:', recommendedFromBanners(dump.statusBanners));
  console.log('COMPLEMENTARY / INSPECTOR:', dump.inventory.complementary.length ? dump.inventory.complementary : 'None');
  console.log('ARRIVING FROM:', dump.arrivingFrom.length ? dump.arrivingFrom : 'Not found');
  console.log('FORMS:', dump.formCount);
  console.log('DIALOGS:', dump.dialogCount, dump.inventory.dialogs.length ? dump.inventory.dialogs : '');
  console.log('WELCOME DIALOG:', dump.welcomeVisible ? 'VISIBLE' : 'NOT VISIBLE');
  console.log('ANY DIALOG:', dump.anyDialogVisible ? 'VISIBLE' : 'NOT VISIBLE');
  console.log('OVERLAY-LIKE COUNT:', dump.inventory.overlayCount);
  console.log('LOADING:', dump.loading > 0 ? `YES (${dump.loading})` : 'None');
  console.log('ALERTS:', dump.alerts.length ? dump.alerts : 'None');
  console.log('START / START INTENT:', dump.startVisible ? 'VISIBLE' : 'NOT VISIBLE');
  console.log('SHOW ROUTE:', dump.showRouteVisible ? 'VISIBLE' : 'NOT VISIBLE');
  console.log('MAIN VISIBLE TEXT (first 8000 chars):');
  console.log((dump.visibleText || '').slice(0, 8000));
  console.log('ACCESSIBILITY SNAPSHOT:');
  console.log(dump.snapshot);
}

try {
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
  await page.waitForTimeout(2500);

  console.log('SETUP: click Життєві події');
  await page.getByRole('link', { name: /Життєві події/i }).click();
  await page.waitForURL(/\/modules\/life-event/, { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

  const welcomeDialog = page.getByRole('dialog', {
    name: /Ласкаво просимо до Arrival Atlas/i,
  });
  await welcomeDialog.waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(1500);
  console.log('SETUP: Welcome dialog VISIBLE, graph nodes NOT clicked');

  console.log('');
  console.log('========================================');
  console.log('PROBE-002 / STEP 18 — GUIDED JOURNEY ON LIFE EVENTS');
  console.log('========================================');
  console.log('INTENT/ACTION: click Почати супроводжуваний шлях');

  const before = await dumpUi();
  logDump('BEFORE GUIDED', before);
  await page.screenshot({
    path: `${OUT}/step-18-before-registration-guided.png`,
    fullPage: true,
  });
  console.log('SCREENSHOT BEFORE:', `${OUT}/step-18-before-registration-guided.png`);

  const guidedBtn = page.getByRole('button', { name: /Почати супроводжуваний шлях/i });
  const guidedVisible = await guidedBtn.isVisible().catch(() => false);
  const guidedEnabled = guidedVisible ? await guidedBtn.isEnabled().catch(() => false) : false;
  console.log('GUIDED BUTTON VISIBLE:', guidedVisible ? 'YES' : 'NO');
  console.log('GUIDED BUTTON ENABLED:', guidedEnabled ? 'YES' : 'NO');

  const errorCountsBefore = {
    console: consoleErrors.length,
    page: pageErrors.length,
    request: requestFailures.length,
  };

  const rawResponses = [];
  const onResponse = response => {
    rawResponses.push(response);
  };
  page.on('response', onResponse);

  let clickMode = 'skipped';
  if (guidedVisible && guidedEnabled) {
    console.log('ACTION: Click Почати супроводжуваний шлях');
    await guidedBtn.click();
    clickMode = 'normal';
    await welcomeDialog.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2500);
  } else {
    console.log('ACTION: SKIPPED — guided button not available');
  }

  page.off('response', onResponse);
  console.log('CLICK MODE USED:', clickMode);

  const after = await dumpUi();
  logDump('AFTER GUIDED', after);
  await page.screenshot({
    path: `${OUT}/step-18-after-registration-guided.png`,
    fullPage: true,
  });

  const interestingNetwork = [];
  for (const response of rawResponses) {
    const request = response.request();
    const method = request.method();
    const url = response.url();
    const interesting =
      /\/api\/|mutation|execute|intent|life-event|ui-snapshot|user-context|profile/i.test(`${method} ${url}`) ||
      ((/POST|PUT|PATCH|DELETE/i.test(method)) &&
        /xhr|fetch|document/i.test(request.resourceType()));
    if (!interesting) {
      continue;
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
    interestingNetwork.push({
      method,
      url,
      status: response.status(),
      resourceType: request.resourceType(),
      requestPayload: request.postData() || null,
      responseBody,
    });
  }

  if (interestingNetwork.length) {
    await fs.writeFile(
      `${OUT}/step-18-registration-guided-network.json`,
      JSON.stringify(interestingNetwork, null, 2)
    );
  }

  const newFailures = requestFailures.slice(errorCountsBefore.request);
  const rscPrefetchAborts = newFailures.filter(isRscPrefetchAbort);
  const otherFailures = newFailures.filter(failure => !isRscPrefetchAbort(failure));
  const buttonDiff = tokenDiff(buttonKeys(before.buttons), buttonKeys(after.buttons));
  const beforeTracked = trackedStates(before.inventory.graphNodes);
  const afterTracked = trackedStates(after.inventory.graphNodes);
  const persistenceHits = valueHits(after.visibleText, after.snapshot);

  console.log('');
  console.log('--- STEP 18 COMPARISON ---');
  console.log('URL BEFORE:', before.url);
  console.log('URL AFTER:', after.url);
  console.log('URL CHANGED:', before.url !== after.url ? `YES (${before.url} → ${after.url})` : 'NO');
  console.log('TITLE AFTER:', after.title);
  console.log('LANG AFTER:', after.lang);
  console.log('WELCOME BEFORE:', before.welcomeVisible ? 'VISIBLE' : 'NOT VISIBLE');
  console.log('WELCOME AFTER:', after.welcomeVisible ? 'VISIBLE' : 'NOT VISIBLE');
  console.log('WELCOME CLOSED:', before.welcomeVisible && !after.welcomeVisible ? 'YES' : 'NO');
  console.log('ANY DIALOG AFTER:', after.anyDialogVisible ? 'YES' : 'NO');
  console.log('DIALOG COUNT BEFORE/AFTER:', before.dialogCount, '→', after.dialogCount);
  console.log('BUTTONS APPEARED:', buttonDiff.appeared.length ? buttonDiff.appeared : 'None');
  console.log('BUTTONS DISAPPEARED:', buttonDiff.disappeared.length ? buttonDiff.disappeared : 'None');
  console.log('SELECTED BEFORE:', before.inventory.selected);
  console.log('SELECTED AFTER:', after.inventory.selected);
  console.log('SELECTED CHANGED:', JSON.stringify(before.inventory.selected) !== JSON.stringify(after.inventory.selected) ? 'YES' : 'NO');
  console.log('RECOMMENDED BEFORE:', recommendedFromBanners(before.statusBanners));
  console.log('RECOMMENDED AFTER:', recommendedFromBanners(after.statusBanners));
  console.log('GUIDED BANNER AFTER:', after.statusBanners.length ? 'YES' : 'NO');
  console.log('SHOW ROUTE BEFORE/AFTER:', before.showRouteVisible, '→', after.showRouteVisible);
  console.log('START INTENT BEFORE/AFTER:', before.startVisible, '→', after.startVisible);
  console.log('TRACKED NODES BEFORE:', beforeTracked);
  console.log('TRACKED NODES AFTER:', afterTracked);
  console.log('PERSISTENCE / CONTEXT HITS:', persistenceHits);
  console.log('NETWORK / API (interesting):', interestingNetwork.length ? interestingNetwork : 'None');
  console.log(
    'LIFE-EVENT PLAN:',
    interestingNetwork.filter(e => /\/api\/modules\/life-event\/plan/.test(e.url)).length
      ? interestingNetwork.filter(e => /\/api\/modules\/life-event\/plan/.test(e.url))
      : 'None'
  );
  console.log(
    'UI-SNAPSHOT:',
    interestingNetwork.filter(e => /\/api\/ui-snapshot/.test(e.url)).length
      ? interestingNetwork.filter(e => /\/api\/ui-snapshot/.test(e.url))
      : 'None'
  );
  console.log(
    'USER-CONTEXT:',
    interestingNetwork.filter(e => /\/api\/user-context/.test(e.url)).length
      ? interestingNetwork.filter(e => /\/api\/user-context/.test(e.url))
      : 'None'
  );
  console.log(
    'MUTATIONS:',
    interestingNetwork.filter(e => /\/api\/mutations/.test(e.url)).length
      ? interestingNetwork.filter(e => /\/api\/mutations/.test(e.url))
      : 'None'
  );
  console.log(
    'LIFE-EVENT EVENTS:',
    interestingNetwork.filter(e => /\/api\/modules\/life-event\/events/.test(e.url)).length
      ? interestingNetwork.filter(e => /\/api\/modules\/life-event\/events/.test(e.url))
      : 'None'
  );
  console.log(
    'NETWORK ARTIFACT:',
    interestingNetwork.length ? `${OUT}/step-18-registration-guided-network.json` : 'not written (no interesting requests)'
  );
  console.log('CONSOLE ERRORS (new):', consoleErrors.slice(errorCountsBefore.console).length ? consoleErrors.slice(errorCountsBefore.console) : 'None');
  console.log('PAGE ERRORS (new):', pageErrors.slice(errorCountsBefore.page).length ? pageErrors.slice(errorCountsBefore.page) : 'None');
  console.log('REQUEST FAILURES (new):', newFailures.length ? newFailures : 'None');
  console.log('RSC/PREFETCH ABORTS (technical observation):', rscPrefetchAborts.length ? rscPrefetchAborts : 'None');
  console.log('OTHER REQUEST FAILURES (new):', otherFailures.length ? otherFailures : 'None');
  console.log('ACTION: graph nodes / Показати маршрут / Economic Reality / Profile / dialog X NOT CLICKED');
  console.log('SCREENSHOT AFTER:', `${OUT}/step-18-after-registration-guided.png`);
} finally {
  await browser.close();
}
