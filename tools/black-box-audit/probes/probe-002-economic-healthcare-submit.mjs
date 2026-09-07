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
    elements.map(element => {
      const tag = element.tagName.toLowerCase();
      const options =
        tag === 'select'
          ? [...element.options].map(option => ({
              value: option.value,
              label: option.textContent.trim(),
              selected: option.selected,
            }))
          : undefined;
      return {
        tag,
        type: element.getAttribute('type'),
        id: element.id || null,
        name: element.getAttribute('name'),
        ariaLabel: element.getAttribute('aria-label'),
        placeholder: element.getAttribute('placeholder'),
        value: element.value,
        checked:
          element.type === 'checkbox' || element.type === 'radio'
            ? element.checked
            : undefined,
        disabled: element.disabled,
        readOnly: element.readOnly,
        required: element.required,
        ariaRequired: element.getAttribute('aria-required'),
        ariaInvalid: element.getAttribute('aria-invalid'),
        validity: {
          valid: element.validity.valid,
          valueMissing: element.validity.valueMissing,
          typeMismatch: element.validity.typeMismatch,
          tooShort: element.validity.tooShort,
          tooLong: element.validity.tooLong,
          rangeUnderflow: element.validity.rangeUnderflow,
          rangeOverflow: element.validity.rangeOverflow,
          stepMismatch: element.validity.stepMismatch,
          badInput: element.validity.badInput,
          customError: element.validity.customError,
        },
        validationMessage: element.validationMessage || '',
        options,
      };
    })
  );
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
  const statusBanners = await page.locator('[role="status"]').allTextContents().catch(() => []);
  const alerts = await page.locator('[role="alert"]').allTextContents().catch(() => []);
  const arrivingFrom = await page.getByText(/Arriving from/i).allTextContents().catch(() => []);
  const lists = await page.locator('ul, ol, [role="list"]').evaluateAll(els =>
    els.map(el => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 400)).filter(Boolean).slice(0, 12)
  );
  const cards = await page.locator('[class*="card"], [class*="Card"], [class*="result"], [class*="Result"]').evaluateAll(
    els => els.map(el => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 400)).filter(Boolean).slice(0, 12)
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
    lists,
    cards,
    fields: await fieldDump(),
    formCount: await page.locator('form').count(),
    dialogCount: await page.locator('[role="dialog"]').count(),
    loading: await page
      .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
      .count(),
    errorCount: await page
      .locator('[class*="error"], [role="alert"][class*="error"], [class*="Error"]')
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
  console.log('FORMS:', dump.formCount);
  console.log('FIELDS:', dump.fields);
  console.log('ARRIVING FROM:', dump.arrivingFrom.length ? dump.arrivingFrom : 'Not found');
  console.log('STATUS BANNERS:', dump.statusBanners.length ? dump.statusBanners : 'None');
  console.log('ALERTS:', dump.alerts.length ? dump.alerts : 'None');
  console.log('DIALOGS:', dump.dialogCount);
  console.log('LOADING:', dump.loading > 0 ? `YES (${dump.loading})` : 'None');
  console.log('ERROR STATE:', dump.errorCount > 0 ? `YES (${dump.errorCount})` : 'None');
  console.log('LISTS:', dump.lists.length ? dump.lists : 'None');
  console.log('CARD/RESULT-LIKE:', dump.cards.length ? dump.cards : 'None');
  console.log('MAIN VISIBLE TEXT (first 8000 chars):');
  console.log((dump.visibleText || '').slice(0, 8000));
  console.log('ACCESSIBILITY SNAPSHOT:');
  console.log(dump.snapshot);
}

function fieldSummary(fields) {
  return (fields || []).map(field => ({
    id: field.id,
    name: field.name,
    value: field.value,
    checked: field.checked,
    selected: field.options ? field.options.filter(option => option.selected) : undefined,
    required: field.required,
    disabled: field.disabled,
    readOnly: field.readOnly,
    valid: field.validity?.valid,
    validationMessage: field.validationMessage,
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
  } catch (error) {
    const retryable = /not stable|Timeout|intercepts pointer|not visible/i.test(String(error.message || error));
    if (!retryable) {
      throw error;
    }
    await healthNode.first().click({ force: true });
  }

  const exploreLink = page
    .locator('[role="complementary"], aside')
    .getByRole('link', { name: /Вивчити варіанти медстрахування/i });
  await exploreLink.waitFor({ state: 'visible', timeout: 15000 });
  console.log('SETUP: click Вивчити варіанти медстрахування');
  await exploreLink.click();
  await page.waitForURL(/\/modules\/healthcare-navigation/, { timeout: 15000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.getByRole('button', { name: /Отримати рекомендації/i }).waitFor({
    state: 'visible',
    timeout: 15000,
  });
  await page.waitForTimeout(1500);
  console.log('SETUP: healthcare-navigation settled, form NOT edited');

  console.log('');
  console.log('========================================');
  console.log('PROBE-002 / STEP 22 — SUBMIT HEALTHCARE DEFAULTS');
  console.log('========================================');
  console.log('INTENT/ACTION: click Отримати рекомендації');
  console.log('FORM LEFT AT DEFAULTS: Situation=New-arrival, Has Insurance unchecked, Type=None, Urgency=Routine, City empty');

  const before = await dumpUi();
  logDump('BEFORE SUBMIT', before);
  await page.screenshot({
    path: `${OUT}/step-22-before-healthcare-submit.png`,
    fullPage: true,
  });
  console.log('SCREENSHOT BEFORE:', `${OUT}/step-22-before-healthcare-submit.png`);
  console.log('FIELD SUMMARY BEFORE:', fieldSummary(before.fields));

  const submitBtn = page.getByRole('button', { name: /Отримати рекомендації/i });
  const submitVisible = await submitBtn.isVisible().catch(() => false);
  const submitEnabled = submitVisible ? await submitBtn.isEnabled().catch(() => false) : false;
  console.log('SUBMIT VISIBLE:', submitVisible ? 'YES' : 'NO');
  console.log('SUBMIT ENABLED:', submitEnabled ? 'YES' : 'NO');

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
  let loadingDuring = 0;
  if (submitVisible && submitEnabled) {
    console.log('ACTION: Click Отримати рекомендації (normal)');
    await submitBtn.click({ timeout: 8000 });
    clickMode = 'normal';
    console.log('CLICK MODE: normal');
    loadingDuring = await page
      .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
      .count()
      .catch(() => 0);
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3000);
  } else {
    console.log('ACTION: SKIPPED — submit button not available');
  }

  page.off('response', onResponse);
  console.log('CLICK MODE USED:', clickMode);
  console.log('LOADING DURING SUBMIT:', loadingDuring > 0 ? `YES (${loadingDuring})` : 'None observed immediately after click');

  const after = await dumpUi();
  logDump('AFTER SUBMIT', after);
  await page.screenshot({
    path: `${OUT}/step-22-after-healthcare-submit.png`,
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
        responseBody = (await response.text()).slice(0, 12000);
      }
    } catch {
      responseBody = null;
    }
    interestingNetwork.push({
      method,
      url,
      status: response.status(),
      resourceType: request.resourceType(),
      requestHeaders: request.headers(),
      requestPayload: request.postData() || null,
      responseHeaders: response.headers(),
      responseBody,
    });
  }

  if (interestingNetwork.length) {
    await fs.writeFile(
      `${OUT}/step-22-healthcare-submit-network.json`,
      JSON.stringify(interestingNetwork, null, 2)
    );
  }

  const executeLike = interestingNetwork.filter(entry =>
    /\/api\/modules\/healthcare-navigation/i.test(entry.url)
  );
  const api200EmptyUi =
    interestingNetwork.some(entry => entry.status === 200 && /\/api\//.test(entry.url)) &&
    after.visibleText === before.visibleText;

  const newFailures = requestFailures.slice(errorCountsBefore.request);
  const rscPrefetchAborts = newFailures.filter(isRscPrefetchAbort);
  const otherFailures = newFailures.filter(failure => !isRscPrefetchAbort(failure));
  const validationMessages = await page.evaluate(() =>
    [...document.querySelectorAll('[role="alert"], [class*="error"], [class*="invalid"], [id*="error"]')]
      .map(el => (el.textContent || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 20)
  );

  const recLike = await page.getByText(/recommend|рекоменд|Krankenkasse|GKV|PKV|action/i).allTextContents().catch(() => []);
  const successVisible = await page
    .getByText(/success|успіш|рекомендац/i)
    .first()
    .isVisible()
    .catch(() => false);

  console.log('');
  console.log('--- STEP 22 COMPARISON ---');
  console.log('URL BEFORE:', before.url);
  console.log('URL AFTER:', after.url);
  console.log('URL CHANGED:', before.url !== after.url ? `YES (${before.url} → ${after.url})` : 'NO');
  console.log('TITLE AFTER:', after.title);
  console.log('LANG BEFORE/AFTER:', before.lang, '→', after.lang);
  console.log('FIELD SUMMARY AFTER:', fieldSummary(after.fields));
  console.log('FIELDS CHANGED:', JSON.stringify(fieldSummary(before.fields)) !== JSON.stringify(fieldSummary(after.fields)) ? 'YES' : 'NO');
  console.log('ARRIVING FROM BEFORE:', before.arrivingFrom);
  console.log('ARRIVING FROM AFTER:', after.arrivingFrom);
  console.log('VALIDATION MESSAGES:', validationMessages.length ? validationMessages : 'None');
  console.log('SUCCESS-LIKE TEXT VISIBLE:', successVisible ? 'YES' : 'NO');
  console.log('RECOMMENDATION-LIKE TEXTS:', recLike.length ? recLike.slice(0, 30) : 'None');
  console.log('HEADINGS CHANGED:', JSON.stringify(before.headings) !== JSON.stringify(after.headings) ? 'YES' : 'NO');
  console.log('BUTTONS CHANGED:', JSON.stringify(before.buttons) !== JSON.stringify(after.buttons) ? 'YES' : 'NO');
  console.log('LINKS CHANGED:', JSON.stringify(before.links) !== JSON.stringify(after.links) ? 'YES' : 'NO');
  console.log('VISIBLE TEXT CHANGED:', before.visibleText !== after.visibleText ? 'YES' : 'NO');
  console.log('SNAPSHOT CHANGED:', before.snapshot !== after.snapshot ? 'YES' : 'NO');
  console.log('API 200 WITH UNCHANGED VISIBLE TEXT:', api200EmptyUi ? 'YES' : 'NO');
  console.log('NETWORK / API (interesting):', interestingNetwork.length ? interestingNetwork : 'None');
  console.log('HEALTHCARE-NAVIGATION API:', executeLike.length ? executeLike : 'None');
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
    'LIFE-EVENT API:',
    interestingNetwork.filter(e => /\/api\/modules\/life-event/.test(e.url)).length
      ? interestingNetwork.filter(e => /\/api\/modules\/life-event/.test(e.url))
      : 'None'
  );
  console.log(
    'NETWORK ARTIFACT:',
    interestingNetwork.length ? `${OUT}/step-22-healthcare-submit-network.json` : 'not written (no interesting requests)'
  );
  console.log('CONSOLE ERRORS (new):', consoleErrors.slice(errorCountsBefore.console).length ? consoleErrors.slice(errorCountsBefore.console) : 'None');
  console.log('PAGE ERRORS (new):', pageErrors.slice(errorCountsBefore.page).length ? pageErrors.slice(errorCountsBefore.page) : 'None');
  console.log('REQUEST FAILURES (new):', newFailures.length ? newFailures : 'None');
  console.log('RSC/PREFETCH ABORTS (technical observation):', rscPrefetchAborts.length ? rscPrefetchAborts : 'None');
  console.log('OTHER REQUEST FAILURES (new):', otherFailures.length ? otherFailures : 'None');
  console.log('ACTION: City / Situation / Type / Urgency / Has Insurance / Profile / Life Events / second submit / new CTA NOT TOUCHED');
  console.log('SCREENSHOT AFTER:', `${OUT}/step-22-after-healthcare-submit.png`);
} finally {
  await browser.close();
}
