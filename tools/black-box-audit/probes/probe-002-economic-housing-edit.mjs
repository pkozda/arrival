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
        name: element.getAttribute('name'),
        id: element.id || null,
        placeholder: element.getAttribute('placeholder'),
        ariaLabel: element.getAttribute('aria-label'),
        value: element.value,
        checked:
          element.type === 'checkbox' || element.type === 'radio'
            ? element.checked
            : undefined,
        disabled: element.disabled,
        readOnly: element.readOnly,
        required: element.required,
        ariaRequired: element.getAttribute('aria-required'),
        autocomplete: element.getAttribute('autocomplete'),
        options,
      };
    })
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
    console.log('SETUP CLICK MODE: normal');
  } catch (error) {
    const unstable = /not stable|Timeout/i.test(String(error.message || error));
    if (!unstable) {
      throw error;
    }
    console.log('SETUP CLICK MODE: force:true — element not stable for normal click');
    await updateProfileBtn.click({ force: true });
  }
  await page.waitForURL(/\/profile\/where-you-live\/edit/, { timeout: 15000 });
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.getByRole('heading', { name: /Виправити дані/i }).waitFor({
    state: 'visible',
    timeout: 15000,
  });
  await page.locator('#profile-field-city').waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(1000);
  console.log('SETUP: housing editor settled');

  console.log('');
  console.log('========================================');
  console.log('PROBE-002 / HOUSING EDIT SETUP — BEFORE NEXT ACTION');
  console.log('========================================');
  console.log('NOTE: pre-action capture only. No STEP 8 input/save/cancel.');

  const url = page.url();
  const title = await page.title();
  const lang = await page.locator('html').getAttribute('lang');
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
  const fields = await fieldDump();
  const snapshot = await page.locator('body').ariaSnapshot();
  const visibleText = await page.locator('body').innerText();

  const formStructure = await page.evaluate(() => {
    const textOf = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
    return [...document.querySelectorAll('form')].map(form => ({
      tag: form.tagName,
      id: form.id || null,
      name: form.getAttribute('name'),
      method: form.getAttribute('method'),
      action: form.getAttribute('action'),
      ariaLabel: form.getAttribute('aria-label'),
      fieldCount: form.querySelectorAll('input, select, textarea').length,
      text: textOf(form).slice(0, 400),
    }));
  });

  const targetFields = await page.evaluate(() => {
    const ids = [
      'profile-field-city',
      'profile-field-bundesland',
      'profile-field-monthlyColdRent',
      'profile-field-monthlyUtilities',
    ];
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
        tag: el.tagName,
        inputType: el.getAttribute('type'),
        name: el.getAttribute('name'),
        accessibleName: el.getAttribute('aria-label') || labelledBy(el) || labelFor(el) || wrappingLabel(el),
        value: el.value,
        placeholder: el.getAttribute('placeholder'),
        required: el.required,
        ariaRequired: el.getAttribute('aria-required'),
        disabled: el.disabled,
        readOnly: el.readOnly,
        autocomplete: el.getAttribute('autocomplete'),
        ariaInvalid: el.getAttribute('aria-invalid'),
        describedBy: el.getAttribute('aria-describedby'),
        associatedLabelFor: labelFor(el),
        wrappingLabel: wrappingLabel(el),
        labelledBy: labelledBy(el),
        describedByText: (() => {
          const ids = el.getAttribute('aria-describedby');
          if (!ids) {
            return null;
          }
          return ids
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
        validationMessage: typeof el.validationMessage === 'string' ? el.validationMessage : null,
      };
    });
  });

  const validationMessages = await page.evaluate(() => {
    return [...document.querySelectorAll('[role="alert"], [class*="error"], [class*="invalid"], [id*="error"]')]
      .map(el => (el.textContent || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 20);
  });

  const arrivingFrom = await page.getByText(/Arriving from/i).allTextContents().catch(() => []);
  const loading = await page
    .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
    .count();
  const errorCount = await page
    .locator('[class*="error"], [role="alert"][class*="error"], [class*="Error"]')
    .count();
  const successVisible = await page
    .getByText(/success|успіш|сохран|збереж|оновлен/i)
    .first()
    .isVisible()
    .catch(() => false);
  const alerts = await page.locator('[role="alert"]').allTextContents().catch(() => []);
  const dialogCount = await page.locator('[role="dialog"]').count();
  const selectedActive = await page
    .locator('[aria-selected="true"], [aria-current="true"], :focus')
    .evaluateAll(els =>
      els.map(el => ({
        tag: el.tagName,
        text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160),
        ariaSelected: el.getAttribute('aria-selected'),
        ariaCurrent: el.getAttribute('aria-current'),
        id: el.id || null,
      }))
    )
    .catch(() => []);
  const helpTexts = await page.locator('main p, main small, [class*="hint"], [class*="help"], [class*="description"]').evaluateAll(
    els => els.map(el => (el.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
  ).catch(() => []);

  await page.screenshot({
    path: `${OUT}/step-8-before-housing-edit.png`,
    fullPage: true,
  });

  console.log('URL:', url);
  console.log('TITLE:', title);
  console.log('LANG:', lang);
  console.log('PATH:', new URL(url).pathname);
  console.log('HEADINGS:', headings);
  console.log('BUTTONS:', buttons);
  console.log('LINKS:', links);
  console.log('INPUTS / SELECTS / TEXTAREAS:', fields);
  console.log('FORM STRUCTURE:', formStructure.length ? formStructure : 'None');
  console.log('ARRIVING FROM:', arrivingFrom.length ? arrivingFrom : 'Not found');
  console.log('LOADING STATE:', loading > 0 ? `YES (${loading})` : 'None');
  console.log('ERROR STATE:', errorCount > 0 ? `YES (${errorCount})` : 'None');
  console.log('SUCCESS TEXT VISIBLE:', successVisible ? 'YES' : 'NO');
  console.log('ALERTS:', alerts.length ? alerts : 'None');
  console.log('VALIDATION MESSAGES:', validationMessages.length ? validationMessages : 'None');
  console.log('DIALOGS:', dialogCount);
  console.log('SELECTED / ACTIVE / FOCUS:', selectedActive.length ? selectedActive : 'None detected');
  console.log('HELP / EXPLANATORY TEXTS:', helpTexts.length ? helpTexts : 'None');

  console.log('');
  console.log('--- TARGET FIELDS ---');
  console.log(targetFields);
  console.log('ACTION: fields NOT FOCUSED / NOT CHANGED');
  console.log('ACTION: Save NOT CLICKED');
  console.log('ACTION: Cancel NOT CLICKED');

  console.log('');
  console.log('MAIN VISIBLE TEXT (first 8000 chars):');
  console.log((visibleText || '').slice(0, 8000));
  console.log('ACCESSIBILITY SNAPSHOT:');
  console.log(snapshot);

  const rscPrefetchAborts = requestFailures.filter(isRscPrefetchAbort);
  const otherFailures = requestFailures.filter(failure => !isRscPrefetchAbort(failure));

  console.log('');
  console.log('CONSOLE ERRORS:');
  console.log(consoleErrors.length ? consoleErrors : 'None');
  console.log('PAGE ERRORS:');
  console.log(pageErrors.length ? pageErrors : 'None');
  console.log('REQUEST FAILURES:');
  console.log(requestFailures.length ? requestFailures : 'None');
  console.log('RSC/PREFETCH ABORTS (technical observation):');
  console.log(rscPrefetchAborts.length ? rscPrefetchAborts : 'None');
  console.log('OTHER REQUEST FAILURES:');
  console.log(otherFailures.length ? otherFailures : 'None');
  console.log('SCREENSHOT:', `${OUT}/step-8-before-housing-edit.png`);
} finally {
  await browser.close();
}
