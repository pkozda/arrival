import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE_URL = 'https://arrival-atlas.pro';
const OUT = 'tools/black-box-audit/artifacts/probe-002';
const EXPECTED = {
  city: 'Bremen',
  bundesland: 'HB',
  monthlyColdRent: '600',
  monthlyUtilities: '100',
};
const FIELD_IDS = [
  'profile-field-city',
  'profile-field-bundesland',
  'profile-field-monthlyColdRent',
  'profile-field-monthlyUtilities',
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

async function dumpTargetFields() {
  return page.evaluate(ids => {
    const labelFor = el => {
      if (!el.id) {
        return null;
      }
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      return label ? (label.textContent || '').replace(/\s+/g, ' ').trim() : null;
    };
    const wrappingLabel = el => {
      const label = el.closest('label');
      return label ? (label.textContent || '').replace(/\s+/g, ' ').trim() : null;
    };
    const labelledBy = el => {
      const id = el.getAttribute('aria-labelledby');
      if (!id) {
        return null;
      }
      return id
        .split(/\s+/)
        .map(part => document.getElementById(part))
        .filter(Boolean)
        .map(node => (node.textContent || '').replace(/\s+/g, ' ').trim())
        .join(' ');
    };

    return ids.map(id => {
      const el = document.getElementById(id);
      if (!el) {
        return { id, found: false };
      }
      return {
        id,
        found: true,
        tag: el.tagName.toLowerCase(),
        inputType: el.getAttribute('type'),
        name: el.getAttribute('name'),
        accessibleName: el.getAttribute('aria-label') || labelledBy(el) || labelFor(el) || wrappingLabel(el),
        value: el.value,
        placeholder: el.getAttribute('placeholder'),
        required: el.required,
        ariaRequired: el.getAttribute('aria-required'),
        disabled: el.disabled,
        readOnly: el.readOnly,
        ariaInvalid: el.getAttribute('aria-invalid'),
        describedBy: el.getAttribute('aria-describedby'),
        associatedLabelFor: labelFor(el),
        wrappingLabel: wrappingLabel(el),
        labelledBy: labelledBy(el),
        describedByText: (() => {
          const described = el.getAttribute('aria-describedby');
          if (!described) {
            return null;
          }
          return described
            .split(/\s+/)
            .map(part => document.getElementById(part))
            .filter(Boolean)
            .map(node => (node.textContent || '').replace(/\s+/g, ' ').trim())
            .join(' ');
        })(),
        nearbyHelp: (() => {
          const block = el.closest('p, div, fieldset, label, section') || el.parentElement;
          const texts = [...(block?.querySelectorAll('p, small, [class*="hint"], [class*="help"], [class*="description"]') || [])]
            .map(node => (node.textContent || '').replace(/\s+/g, ' ').trim())
            .filter(Boolean);
          return texts.length ? texts : null;
        })(),
        validity: {
          valid: el.validity.valid,
          valueMissing: el.validity.valueMissing,
          typeMismatch: el.validity.typeMismatch,
          rangeUnderflow: el.validity.rangeUnderflow,
          rangeOverflow: el.validity.rangeOverflow,
          stepMismatch: el.validity.stepMismatch,
          badInput: el.validity.badInput,
        },
        validationMessage: el.validationMessage || '',
      };
    });
  }, FIELD_IDS);
}

async function controlState(nameRe) {
  const control = page.getByRole('button', { name: nameRe });
  const visible = await control.isVisible().catch(() => false);
  return {
    visible,
    enabled: visible ? await control.isEnabled().catch(() => false) : false,
    disabled: visible ? await control.isDisabled().catch(() => true) : true,
    text: visible ? ((await control.textContent().catch(() => '')) || '').trim() : null,
    count: await control.count().catch(() => 0),
  };
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

  const firstUpdateProfile = page.getByRole('button', { name: /^Update profile$/i });
  console.log('SETUP: click Update profile (first time)');
  try {
    await firstUpdateProfile.click({ timeout: 5000 });
  } catch (error) {
    const unstable = /not stable|Timeout/i.test(String(error.message || error));
    if (!unstable) {
      throw error;
    }
    await firstUpdateProfile.click({ force: true });
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

  console.log('SETUP: click nav Економічна реальність');
  await page
    .getByRole('navigation', { name: /Основна навігація/i })
    .getByRole('link', { name: /Економічна реальність/i })
    .click();
  await page.waitForURL(/\/modules\/economic-reality/, { timeout: 15000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.getByRole('button', { name: /^Update profile$/i }).waitFor({
    state: 'visible',
    timeout: 15000,
  });
  await page.waitForTimeout(2000);
  console.log('SETUP: back on Economic Reality', page.url());

  console.log('');
  console.log('========================================');
  console.log('PROBE-002 / STEP 15 — UPDATE PROFILE AFTER SAVE');
  console.log('========================================');
  console.log('INTENT/ACTION: click Update profile (inspector)');

  const inspectorUpdate = page
    .locator('[role="complementary"], aside')
    .getByRole('button', { name: /^Update profile$/i });
  const fallbackUpdate = page.getByRole('button', { name: /^Update profile$/i });
  const inspectorVisible = await inspectorUpdate.first().isVisible().catch(() => false);
  const updateBtn = inspectorVisible ? inspectorUpdate.first() : fallbackUpdate.first();
  const updateVisible = await updateBtn.isVisible().catch(() => false);
  const updateEnabled = updateVisible ? await updateBtn.isEnabled().catch(() => false) : false;
  const updateCount = await page.getByRole('button', { name: /^Update profile$/i }).count();

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
  console.log('UPDATE PROFILE IN INSPECTOR:', inspectorVisible ? 'YES' : 'NO — using page-level match');
  console.log('UPDATE PROFILE VISIBLE:', updateVisible ? 'YES' : 'NO');
  console.log('UPDATE PROFILE ENABLED:', updateEnabled ? 'YES' : 'NO');
  console.log('UPDATE PROFILE COUNT:', updateCount);

  const rawResponses = [];
  const onResponse = response => {
    rawResponses.push(response);
  };
  page.on('response', onResponse);

  let clickMode = 'skipped';
  if (updateVisible && updateEnabled) {
    console.log('ACTION: Click Update profile');
    try {
      await updateBtn.click({ timeout: 5000 });
      clickMode = 'normal';
      console.log('CLICK MODE: normal');
    } catch (error) {
      const unstable = /not stable|Timeout/i.test(String(error.message || error));
      if (!unstable) {
        page.off('response', onResponse);
        throw error;
      }
      clickMode = 'force';
      console.log('CLICK MODE: force:true — element not stable for normal click');
      console.log('CLICK MODE DETAIL:', String(error.message || error).slice(0, 400));
      await updateBtn.click({ force: true });
    }
    await page.waitForURL(/\/profile\/where-you-live\/edit/, { timeout: 15000 }).catch(() => {});
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.locator('#profile-field-city').waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
  } else {
    console.log('ACTION: SKIPPED — Update profile not available');
  }

  page.off('response', onResponse);
  console.log('CLICK MODE USED:', clickMode);

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
  const snapshot = await page.locator('body').ariaSnapshot();
  const visibleText = await page.locator('body').innerText();
  const fields = await dumpTargetFields();
  const saveState = await controlState(/Зберегти/i);
  const cancelState = await controlState(/Скасувати/i);
  const backLink = await page.getByRole('link', { name: /Назад|Back/i }).evaluateAll(els =>
    els.map(el => ({
      text: (el.textContent || '').trim(),
      href: el.getAttribute('href'),
    }))
  ).catch(() => []);
  const arrivingFrom = await page.getByText(/Arriving from/i).allTextContents().catch(() => []);
  const helpTexts = await page
    .locator('main p, main small, form p, form small, [class*="hint"], [class*="help"], [class*="description"]')
    .evaluateAll(els => els.map(el => (el.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean))
    .catch(() => []);
  const validationMessages = await page.evaluate(() =>
    [...document.querySelectorAll('[role="alert"], [class*="error"], [class*="invalid"], [id*="error"]')]
      .map(el => (el.textContent || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 20)
  );
  const statusBanners = await page.locator('[role="status"]').allTextContents().catch(() => []);
  const alerts = await page.locator('[role="alert"]').allTextContents().catch(() => []);
  const dialogCount = await page.locator('[role="dialog"]').count();
  const formCount = await page.locator('form').count();
  const loading = await page
    .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
    .count();
  const whyErCopy = await page
    .getByText(/Economic Reality|Економічн|registration_confirmed|ще потріб|need to|must still|incomplete|неповн/i)
    .allTextContents()
    .catch(() => []);

  const valueByKey = {};
  for (const field of fields) {
    const key = (field.id || '').replace('profile-field-', '');
    valueByKey[key] = field.found ? field.value : null;
  }
  const matchesExpected = Object.entries(EXPECTED).map(([key, expected]) => ({
    field: key,
    expected,
    actual: valueByKey[key] ?? null,
    match: String(valueByKey[key] ?? '') === expected,
    empty: !valueByKey[key],
  }));

  await page.screenshot({
    path: `${OUT}/step-15-after-profile-after-save.png`,
    fullPage: true,
  });

  const interestingNetwork = [];
  for (const response of rawResponses) {
    const request = response.request();
    const method = request.method();
    const url = response.url();
    const interesting =
      /\/api\/|mutation|execute|intent|profile|user-context|ui-snapshot|economic-reality/i.test(`${method} ${url}`) ||
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
      `${OUT}/step-15-profile-after-save-network.json`,
      JSON.stringify(interestingNetwork, null, 2)
    );
  }

  const newFailures = requestFailures.slice(errorCountsBefore.request);
  const rscPrefetchAborts = newFailures.filter(isRscPrefetchAbort);
  const otherFailures = newFailures.filter(failure => !isRscPrefetchAbort(failure));

  console.log('');
  console.log('--- AFTER UPDATE PROFILE ---');
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
  console.log('ON HOUSING EDITOR:', /\/profile\/where-you-live\/edit/.test(afterUrl) ? 'YES' : 'NO');
  console.log('HEADINGS:', headings);
  console.log('BUTTONS:', buttons);
  console.log('LINKS:', links);
  console.log('FORMS:', formCount);
  console.log('DIALOGS:', dialogCount);
  console.log('ARRIVING FROM:', arrivingFrom.length ? arrivingFrom : 'Not found');
  console.log('BACK LINKS:', backLink.length ? backLink : 'None');
  console.log('SAVE STATE:', saveState);
  console.log('CANCEL STATE:', cancelState);
  console.log('HELP / EXPLANATORY TEXTS:', helpTexts.length ? helpTexts : 'None');
  console.log('STATUS BANNERS:', statusBanners.length ? statusBanners : 'None');
  console.log('ALERTS:', alerts.length ? alerts : 'None');
  console.log('VALIDATION MESSAGES:', validationMessages.length ? validationMessages : 'None');
  console.log('LOADING:', loading > 0 ? `YES (${loading})` : 'None');
  console.log('WHY-ER / CONTINUATION COPY MATCHES:', whyErCopy.length ? whyErCopy.slice(0, 20) : 'None');
  console.log('TARGET FIELDS:', fields);
  console.log('VALUES VS EXPECTED (Bremen / HB / 600 / 100):', matchesExpected);
  console.log('ALL FOUR MATCH SAVED VALUES:', matchesExpected.every(item => item.match) ? 'YES' : 'NO');
  console.log('ANY FIELD EMPTY:', matchesExpected.some(item => item.empty) ? 'YES' : 'NO');
  console.log('MAIN VISIBLE TEXT (first 8000 chars):');
  console.log((visibleText || '').slice(0, 8000));
  console.log('ACCESSIBILITY SNAPSHOT:');
  console.log(snapshot);
  console.log('NETWORK / API (interesting):');
  console.log(interestingNetwork.length ? interestingNetwork : 'None');
  console.log(
    'NETWORK ARTIFACT:',
    interestingNetwork.length ? `${OUT}/step-15-profile-after-save-network.json` : 'not written'
  );
  console.log('CONSOLE ERRORS (new):', consoleErrors.slice(errorCountsBefore.console).length ? consoleErrors.slice(errorCountsBefore.console) : 'None');
  console.log('PAGE ERRORS (new):', pageErrors.slice(errorCountsBefore.page).length ? pageErrors.slice(errorCountsBefore.page) : 'None');
  console.log('REQUEST FAILURES (new):', newFailures.length ? newFailures : 'None');
  console.log('RSC/PREFETCH ABORTS (technical observation):', rscPrefetchAborts.length ? rscPrefetchAborts : 'None');
  console.log('OTHER REQUEST FAILURES (new):', otherFailures.length ? otherFailures : 'None');
  console.log('ACTION: fields NOT EDITED');
  console.log('ACTION: Save / Cancel / Back / Update profile again / other nav NOT CLICKED');
  console.log('SCREENSHOT:', `${OUT}/step-15-after-profile-after-save.png`);
} finally {
  await browser.close();
}
