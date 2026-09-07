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
        options,
      };
    })
  );
}

async function captureState(name) {
  const buttons = await page.getByRole('button').evaluateAll(els =>
    els.map(el => ({
      text: el.textContent.trim(),
      disabled: el.disabled,
      ariaLabel: el.getAttribute('aria-label'),
    }))
  );

  const state = {
    timestamp: new Date().toISOString(),
    url: page.url(),
    title: await page.title(),
    lang: await page.locator('html').getAttribute('lang'),
    buttons,
    links: await page.getByRole('link').evaluateAll(els =>
      els.map(el => ({
        text: el.textContent.trim(),
        href: el.getAttribute('href'),
      }))
    ),
    fields: await fieldDump(),
    headings: await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll(
      els => els.map(e => ({ tag: e.tagName, text: e.textContent.trim() }))
    ),
    snapshot: await page.locator('body').ariaSnapshot(),
    visibleText: await page.locator('body').innerText(),
  };

  await page.screenshot({
    path: `${OUT}/${name}.png`,
    fullPage: true,
  });

  await fs.writeFile(
    `${OUT}/${name}.json`,
    JSON.stringify(state, null, 2)
  );

  return state;
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

  console.log('');
  console.log('========================================');
  console.log('PROBE-002 / STEP 0 — OPEN ECONOMIC REALITY');
  console.log('========================================');

  const econLink = page.getByRole('link', { name: /Економічна реальність/i });
  const econButton = page.getByRole('button', { name: /Економічна реальність/i });
  const linkVisible = await econLink.isVisible().catch(() => false);
  const buttonVisible = await econButton.isVisible().catch(() => false);

  console.log('NAV LINK Економічна реальність:', linkVisible ? 'VISIBLE' : 'NOT FOUND');
  console.log('NAV BUTTON Економічна реальність:', buttonVisible ? 'VISIBLE' : 'NOT FOUND');

  const target = linkVisible ? econLink : buttonVisible ? econButton : null;
  const beforeUrl = page.url();
  console.log('URL BEFORE:', beforeUrl);

  if (!target) {
    console.log('ACTION: SKIPPED — Економічна реальність not visible');
    console.log('VISIBLE BUTTONS:', await page.getByRole('button').allTextContents());
    console.log('VISIBLE LINKS:', await page.getByRole('link').allTextContents());
    await captureState('step-0-after-economic-reality');
  } else {
    console.log('');
    console.log('ACTION: Click Економічна реальність');

    await target.click();
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2500);

    const afterUrl = page.url();
    console.log(
      'URL CHANGED:',
      afterUrl !== beforeUrl ? `YES (${beforeUrl} → ${afterUrl})` : 'NO'
    );

    const s0 = await captureState('step-0-after-economic-reality');

    const statusBanners = await page.locator('[role="status"]').allTextContents().catch(() => []);
    const alerts = await page.locator('[role="alert"]').allTextContents().catch(() => []);
    const loading = await page
      .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
      .count();
    const errorCount = await page
      .locator('[class*="error"], [role="alert"][class*="error"], [class*="Error"]')
      .count();
    const tables = await page.locator('table').count();
    const lists = await page.getByRole('listbox').allTextContents().catch(() => []);
    const dialogs = await page.locator('[role="dialog"]').allTextContents().catch(() => []);

    const enabledButtons = (s0.buttons || []).filter(b => !b.disabled);
    const disabledButtons = (s0.buttons || []).filter(b => b.disabled);

    console.log('');
    console.log('--- AFTER ECONOMIC REALITY ---');
    console.log('');
    console.log('URL AFTER:', s0.url);
    console.log('TITLE:', s0.title);
    console.log('LANG:', s0.lang);

    console.log('');
    console.log('UI SURFACE / PATH:');
    console.log('  Path:', new URL(s0.url).pathname);

    console.log('');
    console.log('HEADINGS:');
    console.log(s0.headings);

    console.log('');
    console.log('BUTTONS:');
    console.log(s0.buttons);
    console.log('ENABLED BUTTONS:', enabledButtons);
    console.log('DISABLED BUTTONS:', disabledButtons);

    console.log('');
    console.log('LINKS:');
    console.log(s0.links);

    console.log('');
    console.log('INPUTS / SELECTS / TEXTAREAS:');
    console.log(s0.fields);

    console.log('');
    console.log('MAIN VISIBLE TEXT (first 8000 chars):');
    console.log((s0.visibleText || '').slice(0, 8000));

    console.log('');
    console.log('ACCESSIBILITY SNAPSHOT:');
    console.log(s0.snapshot);

    console.log('');
    console.log('STATUS BANNERS:', statusBanners.length ? statusBanners : 'None');
    console.log('ALERTS:', alerts.length ? alerts : 'None');
    console.log('DIALOGS:', dialogs.length ? dialogs : 'None');
    console.log('LISTBOXES:', lists.length ? lists : 'None');
    console.log('TABLES:', tables);
    console.log('LOADING STATE:', loading > 0 ? `YES (${loading})` : 'None');
    console.log('ERROR STATE:', errorCount > 0 ? `YES (${errorCount})` : 'None');

    console.log('');
    console.log('CONSOLE ERRORS:');
    console.log(consoleErrors.length ? consoleErrors : 'None');
    console.log('PAGE ERRORS:');
    console.log(pageErrors.length ? pageErrors : 'None');
    console.log('REQUEST FAILURES:');
    console.log(requestFailures.length ? requestFailures : 'None');
  }

  console.log('');
  console.log('========================================');
  console.log('PROBE-002 / STEP 1 — NEXT 7 DAYS');
  console.log('========================================');

  const next7 = page.getByRole('button', {
    name: /Що далі протягом 7 днів/i,
  });
  const next7Visible = await next7.isVisible().catch(() => false);
  console.log('NEXT 7 DAYS BUTTON:', next7Visible ? 'VISIBLE' : 'NOT FOUND');

  const beforeUrl1 = page.url();
  console.log('URL BEFORE:', beforeUrl1);

  if (next7Visible) {
    console.log('');
    console.log('ACTION: Click Що далі протягом 7 днів');

    await next7.click();
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2500);
  } else {
    console.log('ACTION: SKIPPED — button not visible');
  }

  const afterUrl1 = page.url();
  console.log(
    'URL CHANGED:',
    afterUrl1 !== beforeUrl1 ? `YES (${beforeUrl1} → ${afterUrl1})` : 'NO'
  );

  const s1 = await captureState('step-1-after-next-7-days');

  const econInText = /економічна реальність|economic reality/i.test(s1.visibleText || '');
  const econButtons = (s1.buttons || []).filter(b =>
    /економічна реальність|economic reality/i.test(`${b.text} ${b.ariaLabel || ''}`)
  );
  const econLinks = (s1.links || []).filter(l =>
    /економічна реальність|economic reality/i.test(`${l.text} ${l.href || ''}`)
  );
  const econInSnapshot = /економічна реальність|economic reality/i.test(s1.snapshot || '');
  const mapVisible = /Life domain map|YOU ARE HERE|REGISTRATION|FINANCE/i.test(
    `${s1.visibleText || ''} ${s1.snapshot || ''}`
  );
  const journeyVisible = /Journey slides|Slide 0/i.test(s1.snapshot || '');

  const status1 = await page.locator('[role="status"]').allTextContents().catch(() => []);
  const alerts1 = await page.locator('[role="alert"]').allTextContents().catch(() => []);
  const loading1 = await page
    .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
    .count();
  const error1 = await page
    .locator('[class*="error"], [role="alert"][class*="error"], [class*="Error"]')
    .count();

  console.log('');
  console.log('--- AFTER NEXT 7 DAYS ---');
  console.log('');
  console.log('URL AFTER:', s1.url);
  console.log('TITLE:', s1.title);
  console.log('LANG:', s1.lang);
  console.log('PATH:', new URL(s1.url).pathname);

  console.log('');
  console.log('HEADINGS:');
  console.log(s1.headings);

  console.log('');
  console.log('BUTTONS:');
  console.log(s1.buttons);

  console.log('');
  console.log('LINKS:');
  console.log(s1.links);

  console.log('');
  console.log('FIELDS:');
  console.log(s1.fields);

  console.log('');
  console.log('MAIN VISIBLE TEXT (first 8000 chars):');
  console.log((s1.visibleText || '').slice(0, 8000));

  console.log('');
  console.log('ACCESSIBILITY SNAPSHOT:');
  console.log(s1.snapshot);

  console.log('');
  console.log('LIFE DOMAIN MAP:', mapVisible ? 'PRESENT' : 'NOT DETECTED');
  console.log('JOURNEY / SLIDES:', journeyVisible ? 'PRESENT' : 'NOT DETECTED');
  console.log('ECONOMIC REALITY IN TEXT:', econInText ? 'YES' : 'NO');
  console.log('ECONOMIC REALITY IN BUTTONS:', econButtons.length ? econButtons : 'NO');
  console.log('ECONOMIC REALITY IN LINKS:', econLinks.length ? econLinks : 'NO');
  console.log('ECONOMIC REALITY IN SNAPSHOT:', econInSnapshot ? 'YES' : 'NO');

  console.log('');
  console.log('STATUS BANNERS:', status1.length ? status1 : 'None');
  console.log('ALERTS:', alerts1.length ? alerts1 : 'None');
  console.log('LOADING STATE:', loading1 > 0 ? `YES (${loading1})` : 'None');
  console.log('ERROR STATE:', error1 > 0 ? `YES (${error1})` : 'None');

  console.log('');
  console.log('CONSOLE ERRORS:');
  console.log(consoleErrors.length ? consoleErrors : 'None');
  console.log('PAGE ERRORS:');
  console.log(pageErrors.length ? pageErrors : 'None');
  console.log('REQUEST FAILURES:');
  console.log(requestFailures.length ? requestFailures : 'None');

  console.log('');
  console.log('========================================');
  console.log('PROBE-002 / STEP 2 — OPEN ECONOMIC REALITY');
  console.log('========================================');

  const econNav = page.getByRole('link', { name: /Економічна реальність/i });
  const econNavVisible = await econNav.isVisible().catch(() => false);
  const econHref = econNavVisible
    ? await econNav.getAttribute('href').catch(() => null)
    : null;

  console.log('ECONOMIC REALITY LINK:', econNavVisible ? 'VISIBLE' : 'NOT FOUND');
  console.log('HREF:', econHref);

  const beforeUrl2 = page.url();
  console.log('URL BEFORE:', beforeUrl2);

  if (econNavVisible) {
    console.log('');
    console.log('ACTION: Click Економічна реальність');
    await econNav.click();
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3000);
  } else {
    console.log('ACTION: SKIPPED — link not visible');
  }

  const afterUrl2 = page.url();
  console.log(
    'URL CHANGED:',
    afterUrl2 !== beforeUrl2 ? `YES (${beforeUrl2} → ${afterUrl2})` : 'NO'
  );

  const s2 = await captureState('step-2-after-economic-reality');

  const arrivingFrom = await page.getByText(/Arriving from/i).allTextContents().catch(() => []);
  const status2 = await page.locator('[role="status"]').allTextContents().catch(() => []);
  const alerts2 = await page.locator('[role="alert"]').allTextContents().catch(() => []);
  const dialogs2 = await page.locator('[role="dialog"]').allTextContents().catch(() => []);
  const tables2 = await page.locator('table').count();
  const loading2 = await page
    .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
    .count();
  const error2 = await page
    .locator('[class*="error"], [role="alert"][class*="error"], [class*="Error"]')
    .count();
  const requiredFields = await page.locator('[required], [aria-required="true"]').evaluateAll(
    els =>
      els.map(e => ({
        tag: e.tagName,
        name: e.getAttribute('name'),
        ariaLabel: e.getAttribute('aria-label'),
      }))
  ).catch(() => []);

  console.log('');
  console.log('--- AFTER ECONOMIC REALITY ---');
  console.log('');
  console.log('URL AFTER:', s2.url);
  console.log('TITLE:', s2.title);
  console.log('LANG:', s2.lang);
  console.log('PATH:', new URL(s2.url).pathname);
  console.log('NAV HREF:', econHref);

  console.log('');
  console.log('HEADINGS:');
  console.log(s2.headings);

  console.log('');
  console.log('BUTTONS:');
  console.log(s2.buttons);

  console.log('');
  console.log('LINKS:');
  console.log(s2.links);

  console.log('');
  console.log('FIELDS:');
  console.log(s2.fields);

  console.log('');
  console.log('REQUIRED FIELDS:', requiredFields.length ? requiredFields : 'None marked required');

  console.log('');
  console.log('MAIN VISIBLE TEXT (first 8000 chars):');
  console.log((s2.visibleText || '').slice(0, 8000));

  console.log('');
  console.log('ACCESSIBILITY SNAPSHOT:');
  console.log(s2.snapshot);

  console.log('');
  console.log('ARRIVING FROM:', arrivingFrom.length ? arrivingFrom : 'Not found');
  console.log('STATUS BANNERS:', status2.length ? status2 : 'None');
  console.log('ALERTS:', alerts2.length ? alerts2 : 'None');
  console.log('DIALOGS:', dialogs2.length ? dialogs2 : 'None');
  console.log('TABLES:', tables2);
  console.log('LOADING STATE:', loading2 > 0 ? `YES (${loading2})` : 'None');
  console.log('ERROR STATE:', error2 > 0 ? `YES (${error2})` : 'None');

  console.log('');
  console.log('CONSOLE ERRORS:');
  console.log(consoleErrors.length ? consoleErrors : 'None');
  console.log('PAGE ERRORS:');
  console.log(pageErrors.length ? pageErrors : 'None');
  console.log('REQUEST FAILURES:');
  console.log(requestFailures.length ? requestFailures : 'None');

  await fs.writeFile(
    `${OUT}/result.json`,
    JSON.stringify(
      {
        probe: 'PROBE-002',
        step: 2,
        consoleErrors,
        pageErrors,
        requestFailures,
      },
      null,
      2
    )
  );

  console.log('');
  console.log('========================================');
  console.log('ARTIFACTS');
  console.log('========================================');
  console.log(OUT);
} finally {
  await browser.close();
}
