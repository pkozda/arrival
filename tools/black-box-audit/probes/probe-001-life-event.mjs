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

async function setupLanguageAndJourney() {
  await page.goto(`${BASE_URL}/`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

  await page.getByRole('button', { name: /Українська/i }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Продовжити/i }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Що далі протягом 7 днів/i }).click();
  await page.getByRole('button', { name: /02/i }).waitFor({
    state: 'visible',
    timeout: 15000,
  });
}

async function setupToStartRegistration() {
  await setupLanguageAndJourney();
  await page.getByRole('button', { name: /02/i }).click();
  await page.waitForTimeout(1000);
  await page.getByRole('link', { name: /Start Registration/i }).click();
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);
}

async function setupToHealthcareNodeSelected() {
  await setupToStartRegistration();

  const guided = page.getByRole('button', {
    name: /Почати супроводжуваний шлях/i,
  });
  if (await guided.isVisible().catch(() => false)) {
    await guided.click();
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);
  }

  const showRoute = page.getByRole('button', { name: /Показати маршрут/i });
  if (await showRoute.isVisible().catch(() => false)) {
    await showRoute.click();
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);
  }

  await page.getByRole('button', {
    name: /Зрозуміти обовʼязкове медичне страхування/i,
  }).click();
  await page.waitForTimeout(1500);
}

try {
  console.log('');
  console.log('SETUP: language → continue → next 7 days (not recorded as audit steps)');
  await setupLanguageAndJourney();

      // STEP 4 — Registration (Journey slide 02)
      console.log('');
      console.log('========================================');
      console.log('PROBE-001 / STEP 4 — REGISTRATION');
      console.log('========================================');

      // Try multiple selectors for Journey slide 02
      let regButton = null;
      const regSelectors = [
        () => page.getByRole('button', { name: /02/i }),
        () => page.getByRole('button', { name: /Registration/i }),
        () => page.locator('button:has-text("02")'),
        () => page.locator('[data-slide="02"]'),
        () => page.locator('[data-slide="registration"]'),
        () => page.locator('[data-step="02"]'),
        () => page.locator('[data-step="registration"]'),
        () => page.locator('button').filter({ hasText: '02' }),
        () => page.locator('[class*="journey"] button').nth(1),
        () => page.locator('[class*="slide"] button').nth(1),
        () => page.getByText('02', { exact: true }),
        () => page.getByText('Registration'),
      ];

      for (const sel of regSelectors) {
        const loc = sel();
        if (await loc.isVisible().catch(() => false)) {
          regButton = loc;
          console.log('REGISTRATION ELEMENT FOUND via:', sel.toString().slice(6));
          break;
        }
      }

      if (!regButton) {
        // Dump all clickable elements for debugging
        const allButtons = await page.getByRole('button').allTextContents();
        const allLinks = await page.getByRole('link').allTextContents();
        console.log('REGISTRATION ELEMENT: NOT FOUND');
        console.log('Available buttons:', allButtons);
        console.log('Available links:', allLinks);

        // Try finding any element with "02" or "Registration" text
        const bodyText = await page.locator('body').innerText();
        const regMentions = bodyText.split('\n').filter(
          l => /02|registration|реєстрац/i.test(l)
        );
        console.log('Text mentions of 02/Registration:', regMentions);
      }

      if (regButton) {
        const before = await page.locator('body').ariaSnapshot();
        const beforeUrl = page.url();

        console.log('');
        console.log('ACTION: Click Journey slide 02 (Registration)');

        await regButton.click();

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

        const afterReg = await captureState('step-4-after-registration');

        console.log('');
        console.log('--- AFTER REGISTRATION ---');
        console.log('URL:', afterReg.url);
        console.log('TITLE:', afterReg.title);
        console.log('LANG:', afterReg.lang);

        console.log('');
        console.log('BUTTONS:');
        console.log(afterReg.buttons);

        console.log('');
        console.log('LINKS:');
        console.log(afterReg.links);

        console.log('');
        console.log('INPUTS:');
        console.log(afterReg.inputs);

        console.log('');
        console.log('VISIBLE TEXT (first 3000 chars):');
        const visibleText = await page.locator('body').innerText();
        console.log(visibleText.slice(0, 3000));

        console.log('');
        console.log('ACCESSIBILITY SNAPSHOT:');
        console.log(afterReg.snapshot);

        console.log('');
        console.log('ERRORS (cumulative):');
        console.log('Console errors:', consoleErrors.length ? consoleErrors : 'None');
        console.log('Page errors:', pageErrors.length ? pageErrors : 'None');
        console.log('Request failures:', requestFailures.length ? requestFailures : 'None');

        // STEP 5 — Start Registration
        console.log('');
        console.log('========================================');
        console.log('PROBE-001 / STEP 5 — START REGISTRATION');
        console.log('========================================');

        const startRegLink = page.getByRole('link', { name: /Start Registration/i });
        const startRegVisible = await startRegLink.isVisible().catch(() => false);
        console.log('START REGISTRATION LINK:', startRegVisible ? 'VISIBLE' : 'NOT FOUND');

        if (startRegVisible) {
          const beforeSnap = await page.locator('body').ariaSnapshot();
          const beforeUrl = page.url();

          console.log('');
          console.log('ACTION: Click Start Registration');

          await startRegLink.click();

          // Wait for navigation or UI change
          await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
          await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

          // Extra stabilization
          await page.waitForTimeout(2000);

          const afterUrl = page.url();
          const urlChanged = afterUrl !== beforeUrl;
          const afterSnap = await page.locator('body').ariaSnapshot().catch(() => '');
          const uiChanged = afterSnap !== beforeSnap || urlChanged;

          console.log('UI CHANGED:', uiChanged ? 'YES' : 'NO');
          console.log('URL CHANGED:', urlChanged ? `YES (${beforeUrl} → ${afterUrl})` : 'NO');

          const afterStartReg = await captureState('step-5-after-start-registration');

          // Headings
          const headings = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll(
            els => els.map(e => ({ tag: e.tagName, text: e.textContent.trim() }))
          );

          console.log('');
          console.log('--- AFTER START REGISTRATION ---');
          console.log('');
          console.log('URL:', afterStartReg.url);
          console.log('TITLE:', afterStartReg.title);
          console.log('LANG:', afterStartReg.lang);

          console.log('');
          console.log('BUTTONS:');
          console.log(afterStartReg.buttons);

          console.log('');
          console.log('LINKS:');
          console.log(afterStartReg.links);

          console.log('');
          console.log('INPUTS / SELECTS / TEXTAREAS:');
          console.log(afterStartReg.inputs);

          console.log('');
          console.log('HEADINGS:');
          console.log(headings);

          console.log('');
          console.log('MAIN VISIBLE TEXT (first 4000 chars):');
          const mainText = await page.locator('body').innerText();
          console.log(mainText.slice(0, 4000));

          console.log('');
          console.log('ACCESSIBILITY SNAPSHOT:');
          console.log(afterStartReg.snapshot);

          // Loading state
          const loadingEls = await page.locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]').count();
          console.log('');
          console.log('LOADING STATE:', loadingEls > 0 ? `YES (${loadingEls} elements)` : 'None detected');

          // Error state
          const errorEls = await page.locator('[class*="error"], [role="alert"][class*="error"], [class*="Error"]').count();
          console.log('ERROR STATE:', errorEls > 0 ? `YES (${errorEls} elements)` : 'None detected');

          console.log('');
          console.log('CONSOLE ERRORS:');
          console.log(consoleErrors.length ? consoleErrors : 'None');
          console.log('PAGE ERRORS:');
          console.log(pageErrors.length ? pageErrors : 'None');
          console.log('REQUEST FAILURES:');
          console.log(requestFailures.length ? requestFailures : 'None');

          // Extra observations
          console.log('');
          console.log('--- OBSERVATIONS ---');
          console.log('URL changed:', urlChanged ? 'YES' : 'NO');
          console.log('Main UI changed:', uiChanged ? 'YES' : 'NO');

          const lifeEventModule = await page.locator('[class*="life-event"], [data-module="life-event"], [class*="LifeEvent"]').count();
          console.log('Life Event Module detected:', lifeEventModule > 0 ? 'YES' : 'NO');

          const formEls = await page.locator('form, [class*="intake"], [class*="Intake"]').count();
          console.log('Intake/form detected:', formEls > 0 ? 'YES' : 'NO');

          const actionRequired = afterStartReg.inputs.length > 0 || afterStartReg.buttons.length > 0;
          console.log('User action required:', actionRequired ? 'LIKELY (inputs/buttons present)' : 'NO inputs found');

          const prefilled = await page.locator('input, select, textarea').evaluateAll(
            els => els.filter(e => e.value).map(e => ({ tag: e.tagName, name: e.name, value: e.value }))
          );
          console.log('Prefilled/default values:', prefilled.length ? prefilled : 'None');

          const explanationEls = await page.locator('[class*="explanation"], [class*="description"], [class*="intro"], [class*="helper"]').count();
          console.log('Explanation text present:', explanationEls > 0 ? `YES (${explanationEls} elements)` : 'Not detected by class');

          // STEP 6 — Guided Journey
          console.log('');
          console.log('========================================');
          console.log('PROBE-001 / STEP 6 — GUIDED JOURNEY');
          console.log('========================================');

          const guidedBtn = page.getByRole('button', { name: /Почати супроводжуваний шлях/i });
          const guidedVisible = await guidedBtn.isVisible().catch(() => false);
          console.log('GUIDED JOURNEY BUTTON:', guidedVisible ? 'VISIBLE' : 'NOT FOUND');

          if (guidedVisible) {
            const beforeSnap6 = await page.locator('body').ariaSnapshot();
            const beforeUrl6 = page.url();

            console.log('');
            console.log('ACTION: Click Почати супроводжуваний шлях');

            await guidedBtn.click();

            await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
            await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
            await page.waitForTimeout(2000);

            const afterUrl6 = page.url();
            const urlChanged6 = afterUrl6 !== beforeUrl6;
            const afterSnap6 = await page.locator('body').ariaSnapshot().catch(() => '');
            const uiChanged6 = afterSnap6 !== beforeSnap6 || urlChanged6;

            console.log('UI CHANGED:', uiChanged6 ? 'YES' : 'NO');
            console.log('URL CHANGED:', urlChanged6 ? `YES (${beforeUrl6} → ${afterUrl6})` : 'NO');

            const s6 = await captureState('step-6-after-guided-journey');

            const headings6 = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll(
              els => els.map(e => ({ tag: e.tagName, text: e.textContent.trim() }))
            );

            console.log('');
            console.log('--- AFTER GUIDED JOURNEY ---');
            console.log('');
            console.log('URL:', s6.url);
            console.log('TITLE:', s6.title);
            console.log('LANG:', s6.lang);

            // UI surface
            const breadcrumb = await page.locator('[class*="breadcrumb"], [aria-label*="breadcrumb"]').textContent().catch(() => 'None');
            const moduleLabel = await page.locator('[class*="module-label"], [class*="moduleLabel"], [class*="ModuleLabel"]').textContent().catch(() => 'None');
            console.log('');
            console.log('UI SURFACE / MODULE:');
            console.log('  Current URL path:', new URL(s6.url).pathname);
            console.log('  Breadcrumb:', breadcrumb);
            console.log('  Module label:', moduleLabel);

            console.log('');
            console.log('BUTTONS:');
            console.log(s6.buttons);

            console.log('');
            console.log('LINKS:');
            console.log(s6.links);

            console.log('');
            console.log('INPUTS / SELECTS / TEXTAREAS:');
            console.log(s6.inputs);

            console.log('');
            console.log('HEADINGS:');
            console.log(headings6);

            console.log('');
            console.log('MAIN VISIBLE TEXT (first 5000 chars):');
            const mainText6 = await page.locator('body').innerText();
            console.log(mainText6.slice(0, 5000));

            console.log('');
            console.log('ACCESSIBILITY SNAPSHOT:');
            console.log(s6.snapshot);

            // Modal check
            const modalVisible = await page.locator('[role="dialog"]').isVisible().catch(() => false);
            console.log('');
            console.log('MODAL:', modalVisible ? 'VISIBLE' : 'NOT VISIBLE');
            if (modalVisible) {
              const modalText = await page.locator('[role="dialog"]').innerText().catch(() => '');
              console.log('MODAL TEXT:', modalText);
            }

            // Life Event graph
            const graphNodes = await page.locator('[role="listbox"]').isVisible().catch(() => false);
            console.log('LIFE EVENT GRAPH:', graphNodes ? 'VISIBLE' : 'NOT VISIBLE');

            // Selected node
            const selectedNode = await page.locator('[aria-selected="true"], [aria-current="true"], [class*="selected"], [class*="active"][role="option"]').allTextContents().catch(() => []);
            console.log('SELECTED NODE / EVENT:', selectedNode.length ? selectedNode : 'None detected');

            // Guided step
            const guidedStep = await page.locator('[class*="guided"], [class*="step-indicator"], [class*="wizard"], [aria-label*="step"]').allTextContents().catch(() => []);
            console.log('GUIDED STEP:', guidedStep.length ? guidedStep : 'None detected');

            // Loading
            const loading6 = await page.locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]').count();
            console.log('');
            console.log('LOADING STATE:', loading6 > 0 ? `YES (${loading6} elements)` : 'None detected');

            // Error
            const error6 = await page.locator('[class*="error"], [role="alert"][class*="error"], [class*="Error"]').count();
            console.log('ERROR STATE:', error6 > 0 ? `YES (${error6} elements)` : 'None detected');

            console.log('');
            console.log('CONSOLE ERRORS:');
            console.log(consoleErrors.length ? consoleErrors : 'None');
            console.log('PAGE ERRORS:');
            console.log(pageErrors.length ? pageErrors : 'None');
            console.log('REQUEST FAILURES:');
            console.log(requestFailures.length ? requestFailures : 'None');

            // Extra checks
            console.log('');
            console.log('--- EXTRA CHECKS ---');

            const prefilled6 = await page.locator('input, select, textarea').evaluateAll(
              els => els.filter(e => e.value).map(e => ({ tag: e.tagName, name: e.name, type: e.type, value: e.value }))
            );
            console.log('Prefilled values:', prefilled6.length ? prefilled6 : 'None');

            const formCount = await page.locator('form').count();
            console.log('Form elements:', formCount);

            // STEP 7 — Show Route
            console.log('');
            console.log('========================================');
            console.log('PROBE-001 / STEP 7 — SHOW ROUTE');
            console.log('========================================');

            const showRouteBtn = page.getByRole('button', { name: /Показати маршрут/i });
            const showRouteVisible = await showRouteBtn.isVisible().catch(() => false);
            console.log('SHOW ROUTE BUTTON:', showRouteVisible ? 'VISIBLE' : 'NOT FOUND');

            if (showRouteVisible) {
              const beforeSnap7 = await page.locator('body').ariaSnapshot();
              const beforeUrl7 = page.url();

              console.log('');
              console.log('ACTION: Click Показати маршрут');

              await showRouteBtn.click();

              await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
              await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
              await page.waitForTimeout(2000);

              const afterUrl7 = page.url();
              const urlChanged7 = afterUrl7 !== beforeUrl7;
              const afterSnap7 = await page.locator('body').ariaSnapshot().catch(() => '');
              const uiChanged7 = afterSnap7 !== beforeSnap7 || urlChanged7;

              console.log('UI CHANGED:', uiChanged7 ? 'YES' : 'NO');
              console.log('URL CHANGED:', urlChanged7 ? `YES (${beforeUrl7} → ${afterUrl7})` : 'NO');

              const s7 = await captureState('step-7-after-show-route');

              const headings7 = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll(
                els => els.map(e => ({ tag: e.tagName, text: e.textContent.trim() }))
              );

              console.log('');
              console.log('--- AFTER SHOW ROUTE ---');
              console.log('');
              console.log('URL:', s7.url);
              console.log('TITLE:', s7.title);
              console.log('LANG:', s7.lang);

              console.log('');
              console.log('UI SURFACE / MODULE:');
              console.log('  Path:', new URL(s7.url).pathname);

              console.log('');
              console.log('BUTTONS:');
              console.log(s7.buttons);

              console.log('');
              console.log('LINKS:');
              console.log(s7.links);

              console.log('');
              console.log('INPUTS / SELECTS / TEXTAREAS:');
              console.log(s7.inputs);

              console.log('');
              console.log('HEADINGS:');
              console.log(headings7);

              console.log('');
              console.log('MAIN VISIBLE TEXT (first 5000 chars):');
              const mainText7 = await page.locator('body').innerText();
              console.log(mainText7.slice(0, 5000));

              console.log('');
              console.log('ACCESSIBILITY SNAPSHOT:');
              console.log(s7.snapshot);

              // Selected node
              const selectedNode7 = await page.locator('[aria-selected="true"], [aria-current="true"], [class*="selected"], [class*="active"][role="option"]').allTextContents().catch(() => []);
              console.log('');
              console.log('SELECTED NODE / EVENT:', selectedNode7.length ? selectedNode7 : 'None detected');

              // Recommended next step
              const recStep = await page.locator('[role="status"]').textContent().catch(() => 'None');
              console.log('RECOMMENDED NEXT STEP:', recStep);

              // Route / guide elements
              const routeEls = await page.locator('[class*="route"], [class*="Route"], [class*="path"], [class*="Path"], [class*="guide"], [class*="Guide"], [role="navigation"][class*="route"]').count();
              console.log('');
              console.log('ROUTE / GUIDE:');
              console.log('  Route-like elements:', routeEls);

              // Check for overlay/panel
              const overlays = await page.locator('[class*="overlay"], [class*="Overlay"], [class*="panel"], [class*="Panel"], [class*="drawer"], [class*="Drawer"]').count();
              console.log('  Overlay/panel elements:', overlays);

              // Modal
              const modal7 = await page.locator('[role="dialog"]').isVisible().catch(() => false);
              console.log('  Modal:', modal7 ? 'VISIBLE' : 'NOT VISIBLE');

              // Graph state
              const graphVisible7 = await page.locator('[role="listbox"]').isVisible().catch(() => false);
              console.log('  Life Event Graph:', graphVisible7 ? 'VISIBLE' : 'NOT VISIBLE');

              // Graph node details
              const graphNodes7 = await page.locator('[role="listbox"] button').allTextContents().catch(() => []);
              console.log('  Graph nodes:', graphNodes7);

              // Loading
              const loading7 = await page.locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]').count();
              console.log('');
              console.log('LOADING STATE:', loading7 > 0 ? `YES (${loading7} elements)` : 'None detected');

              const error7 = await page.locator('[class*="error"], [role="alert"][class*="error"], [class*="Error"]').count();
              console.log('ERROR STATE:', error7 > 0 ? `YES (${error7} elements)` : 'None detected');

              console.log('');
              console.log('CONSOLE ERRORS:');
              console.log(consoleErrors.length ? consoleErrors : 'None');
              console.log('PAGE ERRORS:');
              console.log(pageErrors.length ? pageErrors : 'None');
              console.log('REQUEST FAILURES:');
              console.log(requestFailures.length ? requestFailures : 'None');

              // STEP 8 — Click recommended node
              console.log('');
              console.log('========================================');
              console.log('PROBE-001 / STEP 8 — RECOMMENDED STEP');
              console.log('========================================');

              const recNodeBtn = page.getByRole('button', { name: /Зрозуміти обовʼязкове медичне страхування/i });
              const recNodeVisible = await recNodeBtn.isVisible().catch(() => false);
              console.log('RECOMMENDED NODE BUTTON:', recNodeVisible ? 'VISIBLE' : 'NOT FOUND');

              if (recNodeVisible) {
                const beforeSnap8 = await page.locator('body').ariaSnapshot();
                const beforeUrl8 = page.url();

                console.log('');
                console.log('ACTION: Click Зрозуміти обовʼязкове медичне страхування');

                await recNodeBtn.click();

                await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
                await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
                await page.waitForTimeout(2000);

                const afterUrl8 = page.url();
                const urlChanged8 = afterUrl8 !== beforeUrl8;
                const afterSnap8 = await page.locator('body').ariaSnapshot().catch(() => '');
                const uiChanged8 = afterSnap8 !== beforeSnap8 || urlChanged8;

                console.log('UI CHANGED:', uiChanged8 ? 'YES' : 'NO');
                console.log('URL CHANGED:', urlChanged8 ? `YES (${beforeUrl8} → ${afterUrl8})` : 'NO');

                const s8 = await captureState('step-8-after-recommended-step');

                const headings8 = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll(
                  els => els.map(e => ({ tag: e.tagName, text: e.textContent.trim() }))
                );

                console.log('');
                console.log('--- AFTER RECOMMENDED STEP ---');
                console.log('');
                console.log('URL:', s8.url);
                console.log('TITLE:', s8.title);
                console.log('LANG:', s8.lang);

                console.log('');
                console.log('UI SURFACE / MODULE:');
                console.log('  Path:', new URL(s8.url).pathname);

                console.log('');
                console.log('BUTTONS:');
                console.log(s8.buttons);

                console.log('');
                console.log('LINKS:');
                console.log(s8.links);

                console.log('');
                console.log('INPUTS / SELECTS / TEXTAREAS:');
                console.log(s8.inputs);

                console.log('');
                console.log('HEADINGS:');
                console.log(headings8);

                console.log('');
                console.log('MAIN VISIBLE TEXT (first 5000 chars):');
                const mainText8 = await page.locator('body').innerText();
                console.log(mainText8.slice(0, 5000));

                console.log('');
                console.log('ACCESSIBILITY SNAPSHOT:');
                console.log(s8.snapshot);

                // Selected node
                const selectedNode8 = await page.locator('[aria-selected="true"], [aria-current="true"], [class*="selected"], [class*="active"][role="option"]').allTextContents().catch(() => []);
                console.log('');
                console.log('SELECTED NODE / EVENT:', selectedNode8.length ? selectedNode8 : 'None detected');

                // Node state from detail panel
                const nodeState = await page.locator('complementary, [role="complementary"]').locator('p').first().textContent().catch(() => 'N/A');
                console.log('NODE STATE:', nodeState);

                // Recommended next step
                const recStep8 = await page.locator('[role="status"]').textContent().catch(() => 'None');
                console.log('RECOMMENDED NEXT STEP:', recStep8);

                // Graph nodes
                const graphNodes8 = await page.locator('[role="listbox"] button').allTextContents().catch(() => []);
                console.log('');
                console.log('GRAPH NODES:', graphNodes8);

                // Detail panel (complementary)
                const detailPanel = await page.locator('[role="complementary"]').innerText().catch(() => 'None');
                console.log('');
                console.log('DETAIL PANEL:');
                console.log(detailPanel);

                // Modal / banner / route
                const modal8 = await page.locator('[role="dialog"]').isVisible().catch(() => false);
                console.log('');
                console.log('MODAL:', modal8 ? 'VISIBLE' : 'NOT VISIBLE');

                const statusBanner = await page.locator('[role="status"]').isVisible().catch(() => false);
                console.log('STATUS BANNER:', statusBanner ? 'VISIBLE' : 'NOT VISIBLE');

                // Loading / Error
                const loading8 = await page.locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]').count();
                console.log('');
                console.log('LOADING STATE:', loading8 > 0 ? `YES (${loading8})` : 'None');
                const error8 = await page.locator('[class*="error"], [role="alert"][class*="error"], [class*="Error"]').count();
                console.log('ERROR STATE:', error8 > 0 ? `YES (${error8})` : 'None');

                console.log('');
                console.log('CONSOLE ERRORS:');
                console.log(consoleErrors.length ? consoleErrors : 'None');
                console.log('PAGE ERRORS:');
                console.log(pageErrors.length ? pageErrors : 'None');
                console.log('REQUEST FAILURES:');
                console.log(requestFailures.length ? requestFailures : 'None');
        }
          }
            }
              }
                }


  await fs.writeFile(
    `${OUT}/result.json`,
    JSON.stringify(
      {
        probe: 'PROBE-001',
        scenario: 'life-event-steps-4-8',
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
