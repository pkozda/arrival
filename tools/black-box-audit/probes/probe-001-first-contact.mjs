import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE_URL = 'https://arrival-atlas.pro';
const OUT = 'tools/black-box-audit/artifacts/probe-001';

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

async function captureState(name) {
  const state = {
    timestamp: new Date().toISOString(),
    url: page.url(),
    title: await page.title(),
    lang: await page.locator('html').getAttribute('lang'),
    buttons: await page.getByRole('button').allTextContents(),
    links: await page.getByRole('link').allTextContents(),
    inputs: await page.locator('input, select, textarea').evaluateAll(
      elements =>
        elements.map(element => ({
          tag: element.tagName.toLowerCase(),
          type: element.getAttribute('type'),
          name: element.getAttribute('name'),
          placeholder: element.getAttribute('placeholder'),
          ariaLabel: element.getAttribute('aria-label'),
        }))
    ),
    snapshot: await page.locator('body').ariaSnapshot(),
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

  await page.waitForLoadState('networkidle', {
    timeout: 15000,
  }).catch(() => {});

  console.log('');
  console.log('========================================');
  console.log('PROBE-001 / STEP 0 — FIRST CONTACT');
  console.log('========================================');

  const initial = await captureState('step-0-initial');

  console.log('');
  console.log('URL:', initial.url);
  console.log('TITLE:', initial.title);
  console.log('LANG:', initial.lang);

  console.log('');
  console.log('BUTTONS:');
  console.log(initial.buttons);

  console.log('');
  console.log('LINKS:');
  console.log(initial.links);

  console.log('');
  console.log('ACCESSIBILITY SNAPSHOT:');
  console.log(initial.snapshot);

  console.log('');
  console.log('ERRORS:');
  console.log(
    consoleErrors.length ? consoleErrors : 'No console errors'
  );
  console.log(
    pageErrors.length ? pageErrors : 'No page errors'
  );
  console.log(
    requestFailures.length
      ? requestFailures
      : 'No request failures'
  );

  const welcome = page.getByRole('dialog', {
    name: /Welcome to Arrival Atlas/i,
  });

  const welcomeVisible = await welcome.isVisible().catch(() => false);

  console.log('');
  console.log(
    'WELCOME DIALOG:',
    welcomeVisible ? 'VISIBLE' : 'NOT FOUND'
  );

  console.log('');
  console.log('========================================');
  console.log('PROBE-001 / STEP 1 — SELECT UKRAINIAN');
  console.log('========================================');

  const ukrainianButton = page.getByRole('button', {
    name: /Українська/i,
  });

  console.log(
    'UKRAINIAN BUTTON:',
    await ukrainianButton.isVisible().catch(() => false)
      ? 'VISIBLE'
      : 'NOT FOUND'
  );

  if (await ukrainianButton.isVisible().catch(() => false)) {
    const before = await page.locator('body').ariaSnapshot();

    console.log('');
    console.log('ACTION: Click Українська');

    await ukrainianButton.click();

    let changed = false;
    const deadline = Date.now() + 10_000;

    while (Date.now() < deadline) {
      await page.waitForTimeout(250);

      const current = await page
        .locator('body')
        .ariaSnapshot()
        .catch(() => '');

      const currentLang = await page
        .locator('html')
        .getAttribute('lang');

      if (current !== before || currentLang === 'uk') {
        changed = true;
        break;
      }
    }

    console.log('UI CHANGED:', changed ? 'YES' : 'NO');

    const ukrainianState = await captureState(
      'step-1-after-ukrainian'
    );

    console.log('');
    console.log('--- AFTER UKRAINIAN ---');
    console.log('URL:', ukrainianState.url);
    console.log('TITLE:', ukrainianState.title);
    console.log('LANG:', ukrainianState.lang);

    console.log('');
    console.log('BUTTONS:');
    console.log(ukrainianState.buttons);

    console.log('');
    console.log('LINKS:');
    console.log(ukrainianState.links);

    console.log('');
    console.log('ACCESSIBILITY SNAPSHOT:');
    console.log(ukrainianState.snapshot);


    console.log('');
    console.log('========================================');
    console.log('PROBE-001 / STEP 2 — CONTINUE');
    console.log('========================================');

    const continueButton = page.getByRole('button', {
      name: /Продовжити/i,
    });

    console.log(
      'CONTINUE BUTTON:',
      await continueButton.isVisible().catch(() => false)
        ? 'VISIBLE'
        : 'NOT FOUND'
    );

    if (await continueButton.isVisible().catch(() => false)) {
      const before = await page.locator('body').ariaSnapshot();
      const beforeUrl = page.url();

      console.log('');
      console.log('ACTION: Click Продовжити');

      await continueButton.click();

      let changed = false;
      const deadline = Date.now() + 10_000;

      while (Date.now() < deadline) {
        await page.waitForTimeout(250);

        const current = await page
          .locator('body')
          .ariaSnapshot()
          .catch(() => '');

        if (current !== before || page.url() !== beforeUrl) {
          changed = true;
          break;
        }
      }

      console.log('UI CHANGED:', changed ? 'YES' : 'NO');

      const afterContinue = await captureState(
        'step-2-after-continue'
      );

      console.log('');
      console.log('--- AFTER CONTINUE ---');
      console.log('URL:', afterContinue.url);
      console.log('TITLE:', afterContinue.title);
      console.log('LANG:', afterContinue.lang);

      console.log('');
      console.log('BUTTONS:');
      console.log(afterContinue.buttons);

      console.log('');
      console.log('LINKS:');
      console.log(afterContinue.links);

      console.log('');
      console.log('ACCESSIBILITY SNAPSHOT:');
      console.log(afterContinue.snapshot);
    }

    console.log('');
    console.log('========================================');
    console.log('PROBE-001 / STEP 3 — NEXT 7 DAYS');
    console.log('========================================');

    const next7DaysButton = page.getByRole('button', {
      name: /Що далі протягом 7 днів/i,
    });

    console.log(
      'NEXT 7 DAYS BUTTON:',
      await next7DaysButton.isVisible().catch(() => false)
        ? 'VISIBLE'
        : 'NOT FOUND'
    );

    if (await next7DaysButton.isVisible().catch(() => false)) {
      const before = await page.locator('body').ariaSnapshot();
      const beforeUrl = page.url();

      console.log('');
      console.log('ACTION: Click Що далі протягом 7 днів');

      await next7DaysButton.click();

      let changed = false;
      const deadline = Date.now() + 10_000;

      while (Date.now() < deadline) {
        await page.waitForTimeout(250);

        const current = await page
          .locator('body')
          .ariaSnapshot()
          .catch(() => '');

        if (current !== before || page.url() !== beforeUrl) {
          changed = true;
          break;
        }
      }

      console.log('UI CHANGED:', changed ? 'YES' : 'NO');

      const afterNext7Days = await captureState(
        'step-3-after-next-7-days'
      );

      console.log('');
      console.log('--- AFTER NEXT 7 DAYS ---');
      console.log('URL:', afterNext7Days.url);
      console.log('TITLE:', afterNext7Days.title);
      console.log('LANG:', afterNext7Days.lang);

      console.log('');
      console.log('BUTTONS:');
      console.log(afterNext7Days.buttons);

      console.log('');
      console.log('LINKS:');
      console.log(afterNext7Days.links);

      console.log('');
      console.log('ACCESSIBILITY SNAPSHOT:');
      console.log(afterNext7Days.snapshot);
    }

  }

  if (welcomeVisible) {
    const startButton = welcome.getByRole('button', {
      name: /Start Guided Journey/i,
    });

    console.log(
      'START GUIDED JOURNEY:',
      await startButton.isVisible().catch(() => false)
        ? 'VISIBLE'
        : 'NOT FOUND'
    );
  }

  await fs.writeFile(
    `${OUT}/result.json`,
    JSON.stringify(
      {
        probe: 'PROBE-001',
        step: 'initial',
        initial,
        welcomeVisible,
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
