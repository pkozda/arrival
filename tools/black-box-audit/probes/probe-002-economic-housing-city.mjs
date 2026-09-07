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
      readOnly: element.readOnly,
      required: element.required,
      ariaRequired: element.getAttribute('aria-required'),
      ariaInvalid: element.getAttribute('aria-invalid'),
      minLength: element.getAttribute('minlength'),
      maxLength: element.getAttribute('maxlength'),
      min: element.getAttribute('min'),
      max: element.getAttribute('max'),
      pattern: element.getAttribute('pattern'),
      className: String(element.className).slice(0, 200),
    }))
  );
}

async function saveState() {
  const save = page.getByRole('button', { name: /Зберегти/i });
  return {
    visible: await save.isVisible().catch(() => false),
    enabled: await save.isEnabled().catch(() => false),
    disabled: await save.isDisabled().catch(() => true),
    text: (await save.textContent().catch(() => ''))?.trim() || null,
  };
}

async function cityMeta() {
  return page.locator('#profile-field-city').evaluate(el => ({
    value: el.value,
    ariaInvalid: el.getAttribute('aria-invalid'),
    required: el.required,
    minLength: el.getAttribute('minlength'),
    maxLength: el.getAttribute('maxlength'),
    pattern: el.getAttribute('pattern'),
    validity: {
      valid: el.validity.valid,
      valueMissing: el.validity.valueMissing,
      tooShort: el.validity.tooShort,
      tooLong: el.validity.tooLong,
      patternMismatch: el.validity.patternMismatch,
    },
    validationMessage: el.validationMessage || '',
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

  console.log('');
  console.log('========================================');
  console.log('PROBE-002 / STEP 9 — ENTER CITY BREMEN');
  console.log('========================================');
  console.log('INTENT/ACTION: fill #profile-field-city = Bremen');

  const city = page.locator('#profile-field-city');
  const beforeUrl = page.url();
  const beforeTitle = await page.title();
  const beforeLang = await page.locator('html').getAttribute('lang');
  const beforeCity = await cityMeta();
  const beforeFields = await fieldDump();
  const beforeSave = await saveState();
  const beforeText = await page.locator('body').innerText();
  const beforeSnap = await page.locator('body').ariaSnapshot();
  const errorCountsBefore = {
    console: consoleErrors.length,
    page: pageErrors.length,
    request: requestFailures.length,
  };

  console.log('CITY BEFORE:', beforeCity);
  console.log('SAVE BEFORE:', beforeSave);
  console.log('FIELDS BEFORE:', beforeFields);

  const rawResponses = [];
  const onResponse = response => {
    rawResponses.push(response);
  };
  page.on('response', onResponse);

  console.log('ACTION: fill city Bremen');
  await city.fill('Bremen');
  await page.waitForTimeout(1500);

  page.off('response', onResponse);

  const afterUrl = page.url();
  const afterTitle = await page.title();
  const afterLang = await page.locator('html').getAttribute('lang');
  const afterCity = await cityMeta();
  const afterFields = await fieldDump();
  const afterSave = await saveState();
  const afterText = await page.locator('body').innerText();
  const afterSnap = await page.locator('body').ariaSnapshot();
  const afterAlerts = await page.locator('[role="alert"]').allTextContents().catch(() => []);
  const validationMessages = await page.evaluate(() =>
    [...document.querySelectorAll('[role="alert"], [class*="error"], [class*="invalid"], [id*="error"], [class*="hint"], [class*="help"]')]
      .map(el => (el.textContent || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 20)
  );
  const dirtyMarkers = await page.evaluate(() => {
    const body = document.body;
    return {
      unsavedText: /unsaved|незбереж|dirty/i.test(body.innerText),
      dirtyClassCount: document.querySelectorAll('[class*="dirty"], [class*="unsaved"], [data-dirty], [aria-invalid="true"]').length,
      cityClass: document.getElementById('profile-field-city')?.className || '',
    };
  });
  const focusAfter = await page.evaluate(() => {
    const el = document.activeElement;
    return el
      ? { tag: el.tagName, id: el.id || null, text: (el.textContent || '').trim().slice(0, 80) }
      : null;
  });

  await page.screenshot({
    path: `${OUT}/step-9-after-housing-city.png`,
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
    interestingNetwork.push({
      method,
      url,
      status: response.status(),
      resourceType: request.resourceType(),
      requestPayload: request.postData() || null,
    });
  }

  const newFailures = requestFailures.slice(errorCountsBefore.request);
  const rscPrefetchAborts = newFailures.filter(isRscPrefetchAbort);

  console.log('');
  console.log('--- AFTER CITY BREMEN ---');
  console.log('URL:', afterUrl);
  console.log('URL CHANGED:', afterUrl !== beforeUrl ? `YES (${beforeUrl} → ${afterUrl})` : 'NO');
  console.log('TITLE:', afterTitle);
  console.log('TITLE CHANGED:', afterTitle !== beforeTitle ? 'YES' : 'NO');
  console.log('LANG:', afterLang);
  console.log('CITY BEFORE VALUE:', beforeCity.value);
  console.log('CITY AFTER VALUE:', afterCity.value);
  console.log('CITY ACCEPTED TEXT:', afterCity.value === 'Bremen' ? 'YES' : `NO (${JSON.stringify(afterCity.value)})`);
  console.log('CITY META AFTER:', afterCity);
  console.log('SAVE BEFORE:', beforeSave);
  console.log('SAVE AFTER:', afterSave);
  console.log('SAVE CHANGED:', JSON.stringify(beforeSave) !== JSON.stringify(afterSave) ? 'YES' : 'NO');
  console.log('FIELDS AFTER:', afterFields);
  console.log('VALIDATION / HELP:', validationMessages.length ? validationMessages : 'None');
  console.log('ALERTS:', afterAlerts.length ? afterAlerts : 'None');
  console.log('DIRTY / UNSAVED MARKERS:', dirtyMarkers);
  console.log('FOCUS AFTER:', focusAfter);
  console.log('A11Y SNAPSHOT CHANGED:', afterSnap !== beforeSnap ? 'YES' : 'NO');
  console.log('VISIBLE TEXT CHANGED:', afterText !== beforeText ? 'YES' : 'NO');
  console.log('VISIBLE TEXT AFTER (first 4000 chars):');
  console.log((afterText || '').slice(0, 4000));
  console.log('ACCESSIBILITY SNAPSHOT:');
  console.log(afterSnap);
  console.log('NETWORK AFTER FILL:', interestingNetwork.length ? interestingNetwork : 'None');
  console.log('CONSOLE ERRORS (new):', consoleErrors.slice(errorCountsBefore.console).length ? consoleErrors.slice(errorCountsBefore.console) : 'None');
  console.log('PAGE ERRORS (new):', pageErrors.slice(errorCountsBefore.page).length ? pageErrors.slice(errorCountsBefore.page) : 'None');
  console.log('REQUEST FAILURES (new):', newFailures.length ? newFailures : 'None');
  console.log('RSC/PREFETCH ABORTS (technical observation):', rscPrefetchAborts.length ? rscPrefetchAborts : 'None');
  console.log('ACTION: Save NOT CLICKED');
  console.log('ACTION: Cancel NOT CLICKED');
  console.log('ACTION: other fields NOT FILLED');
  console.log('SCREENSHOT:', `${OUT}/step-9-after-housing-city.png`);
} finally {
  await browser.close();
}
