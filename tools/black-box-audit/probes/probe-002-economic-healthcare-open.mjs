import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE_URL = 'https://arrival-atlas.pro';
const OUT = 'tools/black-box-audit/artifacts/probe-002';

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

function recommendedFromBanners(statusBanners) {
  const blob = (statusBanners || []).join(' ').replace(/\s+/g, ' ').trim();
  return blob || 'None';
}

function valueHits(visibleText, snapshot) {
  const blob = `${visibleText}\n${snapshot}`;
  const tokens = [
    { token: 'Bremen', re: /Bremen/ },
    { token: 'HB', re: /(^|[^A-Za-z])HB([^A-Za-z]|$)/ },
    { token: '€600', re: /€\s*600|600\s*€/ },
    { token: '€100', re: /€\s*100|100\s*€/ },
    { token: 'housing complete', re: /housing.*complete|Where you live.*Complete/i },
    { token: 'Anmeldung / registration', re: /Anmeldung|реєстрац/i },
    { token: 'Life Event / життєв', re: /life-event|Життєв|Arrival/i },
    { token: 'Economic Reality / Економічна', re: /Economic Reality|Економічна реальність/i },
    { token: 'healthcare / страхуван', re: /health|healthcare|страхуван|медичн/i },
    { token: 'Arriving from', re: /Arriving from/i },
  ];
  return tokens.map(item => ({
    token: item.token,
    present: item.re.test(blob),
  }));
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
      }))
      .filter(item => item.text);
    const graphNodes = [...document.querySelectorAll('[role="listbox"] button, [role="listbox"] [role="option"]')]
      .map(el => ({
        text: textOf(el),
        disabled: Boolean(el.disabled) || el.getAttribute('aria-disabled') === 'true',
        ariaSelected: el.getAttribute('aria-selected'),
        ariaDisabled: el.getAttribute('aria-disabled'),
      }));
    const complementary = [...document.querySelectorAll('[role="complementary"], aside')]
      .map(el => textOf(el).slice(0, 4000));
    const inspectorLinks = [...document.querySelectorAll('[role="complementary"] a, aside a')]
      .map(el => ({
        text: textOf(el),
        href: el.getAttribute('href'),
      }));
    return { selected, graphNodes, complementary, inspectorLinks };
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
  const inventory = await extraInventory();
  const statusBanners = await page.locator('[role="status"]').allTextContents().catch(() => []);
  const alerts = await page.locator('[role="alert"]').allTextContents().catch(() => []);
  const arrivingFrom = await page.getByText(/Arriving from/i).allTextContents().catch(() => []);
  const fields = await page.locator('input, select, textarea').evaluateAll(elements =>
    elements.map(element => ({
      tag: element.tagName.toLowerCase(),
      type: element.getAttribute('type'),
      id: element.id || null,
      name: element.getAttribute('name'),
      ariaLabel: element.getAttribute('aria-label'),
      placeholder: element.getAttribute('placeholder'),
      value: element.value,
      disabled: element.disabled,
    }))
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
    inventory,
    statusBanners,
    alerts,
    arrivingFrom,
    fields,
    formCount: await page.locator('form').count(),
    dialogCount: await page.locator('[role="dialog"]').count(),
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
  console.log('SELECTED NODE:', dump.inventory.selected.length ? dump.inventory.selected : 'None detected');
  console.log('GUIDED / STATUS BANNERS:', dump.statusBanners.length ? dump.statusBanners : 'None');
  console.log('RECOMMENDED / BANNER BLOB:', recommendedFromBanners(dump.statusBanners));
  console.log('COMPLEMENTARY / INSPECTOR:', dump.inventory.complementary.length ? dump.inventory.complementary : 'None');
  console.log('INSPECTOR LINKS:', dump.inventory.inspectorLinks.length ? dump.inventory.inspectorLinks : 'None');
  console.log('ARRIVING FROM:', dump.arrivingFrom.length ? dump.arrivingFrom : 'Not found');
  console.log('FORMS:', dump.formCount);
  console.log('FIELDS:', dump.fields.length ? dump.fields : 'None');
  console.log('DIALOGS:', dump.dialogCount);
  console.log('ALERTS:', dump.alerts.length ? dump.alerts : 'None');
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
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

  const welcomeDialog = page.getByRole('dialog', {
    name: /Ласкаво просимо до Arrival Atlas/i,
  });
  await welcomeDialog.waitFor({ state: 'visible', timeout: 15000 });
  console.log('SETUP: Welcome dialog VISIBLE');

  console.log('SETUP: click Почати супроводжуваний шлях');
  await page.getByRole('button', { name: /Почати супроводжуваний шлях/i }).click();
  await welcomeDialog.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const healthNode = page
    .getByRole('listbox', { name: /Consequence graph nodes/i })
    .getByRole('button', { name: /медичне страхування/i });
  console.log('SETUP: click healthcare graph node');
  try {
    await healthNode.first().click({ timeout: 5000 });
    console.log('SETUP CLICK MODE: normal');
  } catch (error) {
    const retryable = /not stable|Timeout|intercepts pointer|not visible/i.test(String(error.message || error));
    if (!retryable) {
      throw error;
    }
    console.log('SETUP CLICK MODE: force:true');
    await healthNode.first().click({ force: true });
  }
  const exploreLink = page
    .locator('[role="complementary"], aside')
    .getByRole('link', { name: /Вивчити варіанти медстрахування/i });
  await exploreLink.waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(1500);
  console.log('SETUP: healthcare inspector settled');

  console.log('');
  console.log('========================================');
  console.log('PROBE-002 / STEP 21 — OPEN HEALTHCARE OPTIONS');
  console.log('========================================');
  console.log('INTENT/ACTION: click Вивчити варіанти медстрахування');

  const before = await dumpUi();
  logDump('BEFORE CLICK', before);
  await page.screenshot({
    path: `${OUT}/step-21-before-healthcare-open.png`,
    fullPage: true,
  });
  console.log('SCREENSHOT BEFORE:', `${OUT}/step-21-before-healthcare-open.png`);

  const href = await exploreLink.getAttribute('href').catch(() => null);
  const linkVisible = await exploreLink.isVisible().catch(() => false);
  const linkCount = await exploreLink.count().catch(() => 0);
  console.log('TARGET LINK VISIBLE:', linkVisible ? 'YES' : 'NO');
  console.log('TARGET LINK COUNT:', linkCount);
  console.log('TARGET HREF:', href);

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
  if (linkVisible) {
    console.log('ACTION: Click Вивчити варіанти медстрахування (normal)');
    await exploreLink.click({ timeout: 8000 });
    clickMode = 'normal';
    console.log('CLICK MODE: normal');
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3000);
  } else {
    console.log('ACTION: SKIPPED — inspector link not visible');
  }

  page.off('response', onResponse);
  console.log('CLICK MODE USED:', clickMode);

  const after = await dumpUi();
  logDump('AFTER CLICK', after);
  await page.screenshot({
    path: `${OUT}/step-21-after-healthcare-open.png`,
    fullPage: true,
  });

  const interestingNetwork = [];
  for (const response of rawResponses) {
    const request = response.request();
    const method = request.method();
    const url = response.url();
    const interesting =
      /\/api\/|mutation|execute|intent|life-event|ui-snapshot|user-context|profile|health|healthcare|insur/i.test(`${method} ${url}`) ||
      /healthcare-navigation/i.test(url) ||
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
      `${OUT}/step-21-healthcare-open-network.json`,
      JSON.stringify(interestingNetwork, null, 2)
    );
  }

  const newFailures = requestFailures.slice(errorCountsBefore.request);
  const rscPrefetchAborts = newFailures.filter(isRscPrefetchAbort);
  const otherFailures = newFailures.filter(failure => !isRscPrefetchAbort(failure));
  const persistenceHits = valueHits(after.visibleText, after.snapshot);
  let afterPath = after.url;
  try {
    afterPath = new URL(after.url).pathname + new URL(after.url).search;
  } catch {
    /* keep */
  }

  console.log('');
  console.log('--- STEP 21 COMPARISON ---');
  console.log('URL BEFORE:', before.url);
  console.log('URL AFTER:', after.url);
  console.log('URL CHANGED:', before.url !== after.url ? `YES (${before.url} → ${after.url})` : 'NO');
  console.log('DESTINATION PATH:', afterPath);
  console.log('MATCHES /modules/healthcare-navigation:', /\/modules\/healthcare-navigation/.test(after.url) ? 'YES' : 'NO');
  console.log('LANG BEFORE/AFTER:', before.lang, '→', after.lang);
  console.log('LANG PRESERVED:', before.lang === after.lang ? 'YES' : 'NO');
  console.log('TITLE AFTER:', after.title);
  console.log('PERSISTENCE / CONTEXT HITS:', persistenceHits);
  console.log('NETWORK / API (interesting):', interestingNetwork.length ? interestingNetwork : 'None');
  console.log(
    'HEALTHCARE-NAVIGATION REQUESTS:',
    interestingNetwork.filter(e => /healthcare-navigation/i.test(e.url)).length
      ? interestingNetwork.filter(e => /healthcare-navigation/i.test(e.url))
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
    'LIFE-EVENT PLAN:',
    interestingNetwork.filter(e => /\/api\/modules\/life-event\/plan/.test(e.url)).length
      ? interestingNetwork.filter(e => /\/api\/modules\/life-event\/plan/.test(e.url))
      : 'None'
  );
  console.log(
    'NETWORK ARTIFACT:',
    interestingNetwork.length ? `${OUT}/step-21-healthcare-open-network.json` : 'not written (no interesting requests)'
  );
  console.log('CONSOLE ERRORS (new):', consoleErrors.slice(errorCountsBefore.console).length ? consoleErrors.slice(errorCountsBefore.console) : 'None');
  console.log('PAGE ERRORS (new):', pageErrors.slice(errorCountsBefore.page).length ? pageErrors.slice(errorCountsBefore.page) : 'None');
  console.log('REQUEST FAILURES (new):', newFailures.length ? newFailures : 'None');
  console.log('RSC/PREFETCH ABORTS (technical observation):', rscPrefetchAborts.length ? rscPrefetchAborts : 'None');
  console.log('OTHER REQUEST FAILURES (new):', otherFailures.length ? otherFailures : 'None');
  console.log('ACTION: form / submit / Back / insurance edit / Profile / Life Events NOT CLICKED');
  console.log('SCREENSHOT AFTER:', `${OUT}/step-21-after-healthcare-open.png`);
} finally {
  await browser.close();
}
