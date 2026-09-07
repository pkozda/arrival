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
      }));
    const complementary = [...document.querySelectorAll('[role="complementary"], aside')]
      .map(el => textOf(el).slice(0, 4000));
    return {
      selected,
      graphNodes,
      complementary,
      formCount: document.querySelectorAll('form').length,
      dialogs: [...document.querySelectorAll('[role="dialog"]')].map(el => textOf(el).slice(0, 240)),
    };
  });
}

async function findByLabel(pattern) {
  return page.evaluate(source => {
    const re = new RegExp(source, 'i');
    const textOf = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
    const parentContext = el => {
      const panel = el.closest(
        '[role="complementary"], [role="status"], [role="listbox"], [role="dialog"], aside, nav, form, section'
      );
      return panel
        ? {
            role: panel.getAttribute('role'),
            tag: panel.tagName,
            name: panel.getAttribute('aria-label') || panel.getAttribute('aria-labelledby') || null,
            text: textOf(panel).slice(0, 280),
          }
        : null;
    };
    return [...document.querySelectorAll('button, a, [role="button"], [role="link"], [role="option"], p, h1, h2, h3, h4, li, dt, dd')]
      .filter(el => re.test(textOf(el) + ' ' + (el.getAttribute('aria-label') || '')))
      .slice(0, 20)
      .map(el => ({
        tag: el.tagName,
        role: el.getAttribute('role'),
        type: el.getAttribute('type'),
        href: el.getAttribute('href'),
        text: textOf(el).slice(0, 240),
        accessibleName: el.getAttribute('aria-label') || textOf(el).slice(0, 240),
        disabled: Boolean(el.disabled) || el.getAttribute('aria-disabled') === 'true',
        ariaSelected: el.getAttribute('aria-selected'),
        ariaCurrent: el.getAttribute('aria-current'),
        visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
        parent: parentContext(el),
      }));
  }, pattern);
}

function valueHits(visibleText, snapshot) {
  const blob = `${visibleText}\n${snapshot}`;
  const tokens = [
    { token: 'Bremen', re: /Bremen/ },
    { token: 'HB', re: /(^|[^A-Za-z])HB([^A-Za-z]|$)/ },
    { token: '€600', re: /€\s*600|600\s*€/ },
    { token: '€100', re: /€\s*100|100\s*€/ },
    { token: '600', re: /(^|[^0-9])600([^0-9]|$)/ },
    { token: '100', re: /(^|[^0-9])100([^0-9]|$)/ },
  ];
  return tokens.map(item => ({
    token: item.token,
    present: item.re.test(blob),
  }));
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

  console.log('SETUP: click Економічна реальність');
  await page.getByRole('link', { name: /Економічна реальність/i }).click();
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);

  const welcomeDialog = page.getByRole('dialog', {
    name: /Ласкаво просимо до Arrival Atlas/i,
  });
  await welcomeDialog.waitFor({ state: 'visible', timeout: 15000 });
  console.log('SETUP: Welcome dialog VISIBLE');

  console.log('SETUP: click Почати супроводжуваний шлях');
  await page.getByRole('button', { name: /Почати супроводжуваний шлях/i }).click();
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);

  const startIntent = page.getByRole('button', { name: /Start intent/i });
  await startIntent.waitFor({ state: 'visible', timeout: 15000 });
  console.log('SETUP: click Start intent');
  const executeResponse = page
    .waitForResponse(
      response =>
        response.url().includes('/api/modules/economic-reality/action/execute') &&
        response.request().method() === 'POST',
      { timeout: 15000 }
    )
    .catch(() => {});
  await startIntent.click();
  await executeResponse;
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.getByRole('button', { name: /Update profile/i }).waitFor({
    state: 'visible',
    timeout: 15000,
  });
  await page.waitForTimeout(1500);
  console.log('SETUP: Start intent settled');

  const updateProfileBtn = page.getByRole('button', { name: /^Update profile$/i });
  console.log('SETUP: click Update profile');
  try {
    await updateProfileBtn.click({ timeout: 5000 });
  } catch (error) {
    const unstable = /not stable|Timeout/i.test(String(error.message || error));
    if (!unstable) {
      throw error;
    }
    await updateProfileBtn.click({ force: true });
  }
  await page.waitForURL(/\/profile\/where-you-live\/edit/, { timeout: 15000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.locator('#profile-field-city').waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(1000);
  console.log('SETUP: housing editor settled');

  console.log('SETUP: fill city Bremen');
  await page.locator('#profile-field-city').fill('Bremen');
  console.log('SETUP: fill bundesland HB');
  await page.locator('#profile-field-bundesland').fill('HB');
  console.log('SETUP: fill monthlyColdRent 600');
  await page.locator('#profile-field-monthlyColdRent').fill('600');
  console.log('SETUP: fill monthlyUtilities 100');
  await page.locator('#profile-field-monthlyUtilities').fill('100');
  await page.waitForTimeout(500);

  console.log('SETUP: click Зберегти');
  await page.getByRole('button', { name: /Зберегти/i }).click();
  await page.waitForURL(/\/profile\/where-you-live\?updated=1/, { timeout: 15000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  console.log('SETUP: saved, on', page.url());

  console.log('');
  console.log('========================================');
  console.log('PROBE-002 / STEP 14 — RETURN TO ECONOMIC REALITY');
  console.log('========================================');
  console.log('INTENT/ACTION: click nav Економічна реальність');

  const navLink = page.getByRole('navigation', { name: /Основна навігація/i })
    .getByRole('link', { name: /Економічна реальність/i });
  const navVisible = await navLink.isVisible().catch(() => false);
  const beforeUrl = page.url();
  const beforeTitle = await page.title();
  const beforeLang = await page.locator('html').getAttribute('lang');
  const errorCountsBefore = {
    console: consoleErrors.length,
    page: pageErrors.length,
    request: requestFailures.length,
  };

  console.log('URL BEFORE:', beforeUrl);
  console.log('TITLE BEFORE:', beforeTitle);
  console.log('LANG BEFORE:', beforeLang);
  console.log('NAV LINK VISIBLE:', navVisible ? 'YES' : 'NO');

  const rawResponses = [];
  const onResponse = response => {
    rawResponses.push(response);
  };
  page.on('response', onResponse);

  if (navVisible) {
    console.log('ACTION: Click Економічна реальність (main nav)');
    await navLink.click();
    await page.waitForURL(/\/modules\/economic-reality/, { timeout: 15000 }).catch(() => {});
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3000);
  } else {
    console.log('ACTION: SKIPPED — nav link not visible');
  }

  page.off('response', onResponse);

  const afterUrl = page.url();
  const afterTitle = await page.title();
  const afterLang = await page.locator('html').getAttribute('lang');
  const headings = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll(
    els => els.map(e => ({ tag: e.tagName, text: e.textContent.trim() }))
  );
  const buttons = await page.getByRole('button').evaluateAll(els =>
    els.map(el => ({
      text: el.textContent.trim(),
      type: el.getAttribute('type'),
      disabled: el.disabled,
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
  const loading = await page
    .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
    .count();
  const errorCount = await page
    .locator('[class*="error"], [role="alert"][class*="error"], [class*="Error"]')
    .count();
  const dialogCount = await page.locator('[role="dialog"]').count();
  const formCount = await page.locator('form').count();

  const housingUpdateMatches = await findByLabel('Update housing|Refresh housing|housing and registration');
  const benefitMatches = await findByLabel('Initiate benefit application');
  const arrivalBaseMatches = await findByLabel('Create.?activate arrival base|arrival base|Створити базу прибуття|базу прибуття');
  const startIntentVisible = await page.getByRole('button', { name: /Start intent/i }).isVisible().catch(() => false);
  const updateProfileVisible = await page.getByRole('button', { name: /Update profile/i }).isVisible().catch(() => false);
  const showRouteVisible = await page.getByRole('button', { name: /Показати маршрут/i }).isVisible().catch(() => false);
  const housingDataHits = valueHits(visibleText, snapshot);

  await page.screenshot({
    path: `${OUT}/step-14-after-economic-return.png`,
    fullPage: true,
  });

  const interestingNetwork = [];
  for (const response of rawResponses) {
    const request = response.request();
    const method = request.method();
    const url = response.url();
    const interesting =
      /\/api\/|mutation|execute|intent|ui-snapshot|user-context|economic-reality/i.test(`${method} ${url}`) ||
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
      `${OUT}/step-14-economic-return-network.json`,
      JSON.stringify(interestingNetwork, null, 2)
    );
  }

  const planResponses = interestingNetwork.filter(entry =>
    /\/api\/modules\/economic-reality\/plan/.test(entry.url)
  );
  const userContextResponses = interestingNetwork.filter(entry =>
    /\/api\/user-context/.test(entry.url)
  );
  const snapshotResponses = interestingNetwork.filter(entry =>
    /\/api\/ui-snapshot/.test(entry.url)
  );

  const newFailures = requestFailures.slice(errorCountsBefore.request);
  const rscPrefetchAborts = newFailures.filter(isRscPrefetchAbort);
  const otherFailures = newFailures.filter(failure => !isRscPrefetchAbort(failure));

  const bannerBlob = statusBanners.join(' ');
  const recommendedInBanner = /Refresh housing and registration details/i.test(bannerBlob)
    ? 'Refresh housing and registration details'
    : /Update housing and registration details/i.test(bannerBlob)
      ? 'Update housing and registration details'
      : /Initiate benefit application/i.test(bannerBlob)
        ? 'Initiate benefit application'
        : /Створити базу прибуття|arrival base/i.test(bannerBlob)
          ? 'Create arrival base / Створити базу прибуття'
          : bannerBlob || 'None';

  console.log('');
  console.log('--- AFTER NAV TO ECONOMIC REALITY ---');
  console.log('URL BEFORE:', beforeUrl);
  console.log('URL AFTER:', afterUrl);
  console.log('URL CHANGED:', afterUrl !== beforeUrl ? `YES (${beforeUrl} → ${afterUrl})` : 'NO');
  console.log('DESTINATION:', (() => {
    try {
      return new URL(afterUrl).pathname + new URL(afterUrl).search;
    } catch {
      return afterUrl;
    }
  })());
  console.log('TITLE AFTER:', afterTitle);
  console.log('LANG AFTER:', afterLang);
  console.log('ECONOMIC REALITY PAGE:', /economic-reality/i.test(afterUrl) ? 'YES' : 'NO');
  console.log('HEADINGS:', headings);
  console.log('BUTTONS:', buttons);
  console.log('LINKS:', links);
  console.log('GRAPH NODES:', inventory.graphNodes);
  console.log('SELECTED NODE:', inventory.selected.length ? inventory.selected : 'None detected');
  console.log('GUIDED / STATUS BANNERS:', statusBanners.length ? statusBanners : 'None');
  console.log('RECOMMENDED / PRIMARY HIGHLIGHT (banner):', recommendedInBanner);
  console.log('COMPLEMENTARY / INSPECTOR:', inventory.complementary.length ? inventory.complementary : 'None');
  console.log('ARRIVING FROM:', arrivingFrom.length ? arrivingFrom : 'Not found');
  console.log('FORMS:', formCount);
  console.log('DIALOGS:', dialogCount, inventory.dialogs.length ? inventory.dialogs : '');
  console.log('LOADING:', loading > 0 ? `YES (${loading})` : 'None');
  console.log('ERROR STATE:', errorCount > 0 ? `YES (${errorCount})` : 'None');
  console.log('ALERTS:', alerts.length ? alerts : 'None');
  console.log('START INTENT:', startIntentVisible ? 'VISIBLE' : 'NOT VISIBLE');
  console.log('UPDATE PROFILE:', updateProfileVisible ? 'VISIBLE' : 'NOT VISIBLE');
  console.log('SHOW ROUTE:', showRouteVisible ? 'VISIBLE' : 'NOT VISIBLE');
  console.log('HOUSING-RELATED MATCHES:', housingUpdateMatches.length ? housingUpdateMatches : 'None');
  console.log('INITIATE BENEFIT APPLICATION:', benefitMatches.length ? benefitMatches : 'None');
  console.log('ARRIVAL BASE / CREATE ACTIVATE:', arrivalBaseMatches.length ? arrivalBaseMatches : 'None');
  console.log('HOUSING VALUES VISIBLE (Bremen / HB / €600 / €100):', housingDataHits);
  console.log('MAIN VISIBLE TEXT (first 8000 chars):');
  console.log((visibleText || '').slice(0, 8000));
  console.log('ACCESSIBILITY SNAPSHOT:');
  console.log(snapshot);
  console.log('NETWORK / API (interesting):');
  console.log(interestingNetwork.length ? interestingNetwork : 'None');
  console.log('ECONOMIC REALITY PLAN RESPONSES:', planResponses.length ? planResponses : 'None');
  console.log('USER-CONTEXT RESPONSES:', userContextResponses.length ? userContextResponses : 'None');
  console.log('UI-SNAPSHOT RESPONSES:', snapshotResponses.length ? snapshotResponses : 'None');
  console.log(
    'NETWORK ARTIFACT:',
    interestingNetwork.length ? `${OUT}/step-14-economic-return-network.json` : 'not written'
  );
  console.log('CONSOLE ERRORS (new):', consoleErrors.slice(errorCountsBefore.console).length ? consoleErrors.slice(errorCountsBefore.console) : 'None');
  console.log('PAGE ERRORS (new):', pageErrors.slice(errorCountsBefore.page).length ? pageErrors.slice(errorCountsBefore.page) : 'None');
  console.log('REQUEST FAILURES (new):', newFailures.length ? newFailures : 'None');
  console.log('RSC/PREFETCH ABORTS (technical observation):', rscPrefetchAborts.length ? rscPrefetchAborts : 'None');
  console.log('OTHER REQUEST FAILURES (new):', otherFailures.length ? otherFailures : 'None');
  console.log('ACTION: Start intent / Update profile / housing nodes / Показати маршрут / other links NOT CLICKED');
  console.log('SCREENSHOT:', `${OUT}/step-14-after-economic-return.png`);
} finally {
  await browser.close();
}
