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

function isMutationOrExecute(entry) {
  const blob = `${entry.method} ${entry.url}`;
  return /\/api\/|mutation|execute|intent/i.test(blob) &&
    /POST|PUT|PATCH|DELETE/i.test(entry.method);
}

async function fieldDump() {
  return page.locator('input, select, textarea').evaluateAll(elements =>
    elements.map(element => ({
      tag: element.tagName.toLowerCase(),
      type: element.getAttribute('type'),
      name: element.getAttribute('name'),
      id: element.id || null,
      placeholder: element.getAttribute('placeholder'),
      ariaLabel: element.getAttribute('aria-label'),
      value: element.value,
      disabled: element.disabled,
      required: element.required,
    }))
  );
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

  console.log('');
  console.log('========================================');
  console.log('PROBE-002 / STEP 13 — SAVE HOUSING PROFILE');
  console.log('========================================');
  console.log('INTENT/ACTION: click Зберегти');

  const saveBtn = page.getByRole('button', { name: /Зберегти/i });
  const saveVisible = await saveBtn.isVisible().catch(() => false);
  const saveEnabled = saveVisible ? await saveBtn.isEnabled().catch(() => false) : false;
  const fieldsBefore = await fieldDump();
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
  console.log('SAVE VISIBLE:', saveVisible ? 'YES' : 'NO');
  console.log('SAVE ENABLED:', saveEnabled ? 'YES' : 'NO');
  console.log('FIELDS BEFORE SAVE:', fieldsBefore);

  const rawResponses = [];
  const onResponse = response => {
    rawResponses.push(response);
  };
  page.on('response', onResponse);

  let loadingDuring = 0;
  if (saveVisible && saveEnabled) {
    console.log('ACTION: Click Зберегти');
    await saveBtn.click();
    loadingDuring = await page
      .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
      .count()
      .catch(() => 0);
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3000);
  } else {
    console.log('ACTION: SKIPPED — Save not available');
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
    }))
  );
  const links = await page.getByRole('link').evaluateAll(els =>
    els.map(el => ({
      text: el.textContent.trim(),
      href: el.getAttribute('href'),
    }))
  );
  const fieldsAfter = await fieldDump();
  const snapshot = await page.locator('body').ariaSnapshot();
  const visibleText = await page.locator('body').innerText();
  const dialogCount = await page.locator('[role="dialog"]').count();
  const formCount = await page.locator('form').count();
  const statusBanners = await page.locator('[role="status"]').allTextContents().catch(() => []);
  const alerts = await page.locator('[role="alert"]').allTextContents().catch(() => []);
  const toasts = await page.locator('[class*="toast"], [class*="Toast"], [class*="notification"], [class*="Notification"]').allTextContents().catch(() => []);
  const arrivingFrom = await page.getByText(/Arriving from/i).allTextContents().catch(() => []);
  const loading = await page
    .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
    .count();
  const errorCount = await page
    .locator('[class*="error"], [role="alert"][class*="error"], [class*="Error"]')
    .count();
  const successVisible = await page
    .getByText(/success|успіш|сохран|збереж|оновлен|оновлено|збережено/i)
    .first()
    .isVisible()
    .catch(() => false);
  const successTexts = await page.getByText(/success|успіш|сохран|збереж|оновлен|оновлено|збережено/i).allTextContents().catch(() => []);
  const validationMessages = await page.evaluate(() =>
    [...document.querySelectorAll('[role="alert"], [class*="error"], [class*="invalid"], [id*="error"]')]
      .map(el => (el.textContent || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 20)
  );
  const selected = await page
    .locator('[aria-selected="true"], [aria-current="true"]')
    .allTextContents()
    .catch(() => []);
  const recommended = await page.locator('[role="status"]').allTextContents().catch(() => []);

  await page.screenshot({
    path: `${OUT}/step-13-after-housing-save.png`,
    fullPage: true,
  });

  const interestingNetwork = [];
  for (const response of rawResponses) {
    const request = response.request();
    const method = request.method();
    const url = response.url();
    const interesting =
      /\/api\/|mutation|execute|intent|profile/i.test(`${method} ${url}`) ||
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

  const mutationOrExecute = interestingNetwork.filter(isMutationOrExecute);
  if (interestingNetwork.length) {
    await fs.writeFile(
      `${OUT}/step-13-housing-save-network.json`,
      JSON.stringify(interestingNetwork, null, 2)
    );
  }

  const newFailures = requestFailures.slice(errorCountsBefore.request);
  const rscPrefetchAborts = newFailures.filter(isRscPrefetchAbort);
  const otherFailures = newFailures.filter(failure => !isRscPrefetchAbort(failure));

  console.log('');
  console.log('--- AFTER SAVE ---');
  console.log('URL BEFORE:', beforeUrl);
  console.log('URL AFTER:', afterUrl);
  console.log('URL CHANGED:', afterUrl !== beforeUrl ? `YES (${beforeUrl} → ${afterUrl})` : 'NO');
  console.log('DESTINATION:', new URL(afterUrl).pathname + new URL(afterUrl).search);
  console.log('TITLE AFTER:', afterTitle);
  console.log('LANG AFTER:', afterLang);
  console.log('ECONOMIC REALITY PAGE:', /economic-reality/i.test(afterUrl) ? 'YES' : 'NO');
  console.log('PROFILE PAGE:', /\/profile/i.test(afterUrl) ? 'YES' : 'NO');
  console.log('LOADING DURING SAVE:', loadingDuring > 0 ? `YES (${loadingDuring})` : 'None observed immediately after click');
  console.log('LOADING AFTER:', loading > 0 ? `YES (${loading})` : 'None');
  console.log('ERROR STATE:', errorCount > 0 ? `YES (${errorCount})` : 'None');
  console.log('SUCCESS TEXT VISIBLE:', successVisible ? 'YES' : 'NO');
  console.log('SUCCESS TEXTS:', successTexts.length ? successTexts : 'None');
  console.log('STATUS BANNERS:', statusBanners.length ? statusBanners : 'None');
  console.log('ALERTS:', alerts.length ? alerts : 'None');
  console.log('TOASTS / NOTIFICATIONS:', toasts.length ? toasts : 'None');
  console.log('VALIDATION MESSAGES:', validationMessages.length ? validationMessages : 'None');
  console.log('FORMS:', formCount);
  console.log('DIALOGS:', dialogCount);
  console.log('ARRIVING FROM:', arrivingFrom.length ? arrivingFrom : 'Not found');
  console.log('SELECTED / CURRENT:', selected.length ? selected : 'None detected');
  console.log('GUIDED / STATUS:', recommended.length ? recommended : 'None');
  console.log('HEADINGS:', headings);
  console.log('BUTTONS:', buttons);
  console.log('LINKS:', links);
  console.log('FIELDS AFTER SAVE:', fieldsAfter);
  console.log('MAIN VISIBLE TEXT (first 8000 chars):');
  console.log((visibleText || '').slice(0, 8000));
  console.log('ACCESSIBILITY SNAPSHOT:');
  console.log(snapshot);
  console.log('NETWORK / API (interesting):');
  console.log(interestingNetwork.length ? interestingNetwork : 'None');
  console.log('MUTATION / EXECUTE:');
  console.log(mutationOrExecute.length ? mutationOrExecute : 'None');
  console.log(
    'NETWORK ARTIFACT:',
    interestingNetwork.length ? `${OUT}/step-13-housing-save-network.json` : 'not written'
  );
  console.log('CONSOLE ERRORS (new):', consoleErrors.slice(errorCountsBefore.console).length ? consoleErrors.slice(errorCountsBefore.console) : 'None');
  console.log('PAGE ERRORS (new):', pageErrors.slice(errorCountsBefore.page).length ? pageErrors.slice(errorCountsBefore.page) : 'None');
  console.log('REQUEST FAILURES (new):', newFailures.length ? newFailures : 'None');
  console.log('RSC/PREFETCH ABORTS (technical observation):', rscPrefetchAborts.length ? rscPrefetchAborts : 'None');
  console.log('OTHER REQUEST FAILURES (new):', otherFailures.length ? otherFailures : 'None');
  console.log('ACTION: Back/Cancel/nav/Save-again NOT CLICKED');
  console.log('SCREENSHOT:', `${OUT}/step-13-after-housing-save.png`);
} finally {
  await browser.close();
}
