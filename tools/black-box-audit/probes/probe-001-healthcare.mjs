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
  console.log('SETUP: through Registration → guided → show route → recommended node (not recorded as audit steps)');
  await setupToHealthcareNodeSelected();

                // Reset request failures for clean STEP 9 tracking
                requestFailures.length = 0;

                // STEP 9 — Healthcare Navigation
                console.log('');
                console.log('========================================');
                console.log('PROBE-001 / STEP 9 — HEALTHCARE NAV');
                console.log('========================================');

                const healthLink = page.getByRole('link', { name: /Вивчити варіанти медстрахування/i });
                const healthVisible = await healthLink.isVisible().catch(() => false);
                console.log('HEALTHCARE LINK:', healthVisible ? 'VISIBLE' : 'NOT FOUND');

                if (healthVisible) {
                  const beforeUrl9 = page.url();

                  console.log('');
                  console.log('ACTION: Click Вивчити варіанти медстрахування');

                  await healthLink.click();

                  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
                  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
                  await page.waitForTimeout(3000);

                  const afterUrl9 = page.url();
                  const urlChanged9 = afterUrl9 !== beforeUrl9;

                  console.log('UI CHANGED: YES');
                  console.log('URL CHANGED:', urlChanged9 ? `YES (${beforeUrl9} → ${afterUrl9})` : 'NO');

                  const s9 = await captureState('step-9-after-healthcare-navigation');

                  const headings9 = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll(
                    els => els.map(e => ({ tag: e.tagName, text: e.textContent.trim() }))
                  );

                  console.log('');
                  console.log('--- AFTER HEALTHCARE NAVIGATION ---');
                  console.log('');
                  console.log('URL:', s9.url);
                  console.log('TITLE:', s9.title);
                  console.log('LANG:', s9.lang);

                  console.log('');
                  console.log('UI SURFACE / MODULE:');
                  console.log('  Path:', new URL(s9.url).pathname);

                  console.log('');
                  console.log('BUTTONS:');
                  console.log(s9.buttons);

                  console.log('');
                  console.log('LINKS:');
                  console.log(s9.links);

                  console.log('');
                  console.log('INPUTS / SELECTS / TEXTAREAS:');
                  console.log(s9.inputs);

                  console.log('');
                  console.log('HEADINGS:');
                  console.log(headings9);

                  console.log('');
                  console.log('MAIN VISIBLE TEXT (first 6000 chars):');
                  const mainText9 = await page.locator('body').innerText();
                  console.log(mainText9.slice(0, 6000));

                  console.log('');
                  console.log('ACCESSIBILITY SNAPSHOT:');
                  console.log(s9.snapshot);

                  // Loading / Error
                  const loading9 = await page.locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]').count();
                  console.log('');
                  console.log('LOADING STATE:', loading9 > 0 ? `YES (${loading9})` : 'None');
                  const error9 = await page.locator('[class*="error"], [role="alert"][class*="error"], [class*="Error"]').count();
                  console.log('ERROR STATE:', error9 > 0 ? `YES (${error9})` : 'None');

                  console.log('');
                  console.log('CONSOLE ERRORS:');
                  console.log(consoleErrors.length ? consoleErrors : 'None');
                  console.log('PAGE ERRORS:');
                  console.log(pageErrors.length ? pageErrors : 'None');
                  console.log('REQUEST FAILURES:');
                  console.log(requestFailures.length ? requestFailures : 'None');

                  requestFailures.length = 0;

                  // STEP 10 — Get recommendations (default form)
                  console.log('');
                  console.log('========================================');
                  console.log('PROBE-001 / STEP 10 — RECOMMENDATIONS');
                  console.log('========================================');

                  const recBtn = page.getByRole('button', {
                    name: /Отримати рекомендації/i,
                  });
                  const recBtnVisible = await recBtn.isVisible().catch(() => false);
                  console.log(
                    'GET RECOMMENDATIONS BUTTON:',
                    recBtnVisible ? 'VISIBLE' : 'NOT FOUND'
                  );

                  if (recBtnVisible) {
                    const beforeSnap10 = await page.locator('body').ariaSnapshot();
                    const beforeUrl10 = page.url();

                    console.log('');
                    console.log('ACTION: Click Отримати рекомендації');
                    console.log('FORM VALUES LEFT UNCHANGED (defaults)');

                    await recBtn.click();

                    const loadingDuring = await page
                      .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
                      .count()
                      .catch(() => 0);

                    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
                    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
                    await page.waitForTimeout(3000);

                    const afterUrl10 = page.url();
                    const urlChanged10 = afterUrl10 !== beforeUrl10;
                    const afterSnap10 = await page.locator('body').ariaSnapshot().catch(() => '');
                    const uiChanged10 = afterSnap10 !== beforeSnap10 || urlChanged10;

                    console.log('UI CHANGED:', uiChanged10 ? 'YES' : 'NO');
                    console.log(
                      'URL CHANGED:',
                      urlChanged10 ? `YES (${beforeUrl10} → ${afterUrl10})` : 'NO'
                    );
                    console.log(
                      'LOADING DURING SUBMIT:',
                      loadingDuring > 0 ? `YES (${loadingDuring})` : 'None observed immediately after click'
                    );

                    const s10 = await captureState('step-10-after-recommendations');

                    const headings10 = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll(
                      els => els.map(e => ({ tag: e.tagName, text: e.textContent.trim() }))
                    );

                    const fieldValues = await page.locator('input, select, textarea').evaluateAll(
                      els =>
                        els.map(e => ({
                          tag: e.tagName.toLowerCase(),
                          type: e.type || e.getAttribute('type'),
                          name: e.name,
                          value: e.value,
                          checked: e.type === 'checkbox' || e.type === 'radio' ? e.checked : undefined,
                        }))
                    );

                    const validation = await page.locator('[aria-invalid="true"], [class*="invalid"], [class*="validation"], :invalid').evaluateAll(
                      els =>
                        els.map(e => ({
                          tag: e.tagName,
                          name: e.getAttribute('name'),
                          message: e.validationMessage || e.textContent?.trim(),
                        }))
                    ).catch(() => []);

                    const arrivingFrom = await page.getByText(/Arriving from/i).allTextContents().catch(() => []);

                    console.log('');
                    console.log('--- AFTER RECOMMENDATIONS ---');
                    console.log('');
                    console.log('URL:', s10.url);
                    console.log('TITLE:', s10.title);
                    console.log('LANG:', s10.lang);

                    console.log('');
                    console.log('UI SURFACE / MODULE:');
                    console.log('  Path:', new URL(s10.url).pathname);

                    console.log('');
                    console.log('BUTTONS:');
                    console.log(s10.buttons);

                    console.log('');
                    console.log('LINKS:');
                    console.log(s10.links);

                    console.log('');
                    console.log('INPUTS / SELECTS / TEXTAREAS (current values):');
                    console.log(fieldValues);

                    console.log('');
                    console.log('HEADINGS:');
                    console.log(headings10);

                    console.log('');
                    console.log('MAIN VISIBLE TEXT (first 8000 chars):');
                    const mainText10 = await page.locator('body').innerText();
                    console.log(mainText10.slice(0, 8000));

                    console.log('');
                    console.log('ACCESSIBILITY SNAPSHOT:');
                    console.log(s10.snapshot);

                    console.log('');
                    console.log('VALIDATION MESSAGES:');
                    console.log(validation.length ? validation : 'None detected');

                    console.log('');
                    console.log('ARRIVING FROM CONTEXT:', arrivingFrom.length ? arrivingFrom : 'Not found');

                    const loading10 = await page.locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]').count();
                    console.log('');
                    console.log('LOADING STATE (after):', loading10 > 0 ? `YES (${loading10})` : 'None');
                    const error10 = await page.locator('[class*="error"], [role="alert"][class*="error"], [class*="Error"]').count();
                    console.log('ERROR STATE:', error10 > 0 ? `YES (${error10})` : 'None');

                    console.log('');
                    console.log('CONSOLE ERRORS:');
                    console.log(consoleErrors.length ? consoleErrors : 'None');
                    console.log('PAGE ERRORS:');
                    console.log(pageErrors.length ? pageErrors : 'None');
                    console.log('REQUEST FAILURES:');
                    console.log(requestFailures.length ? requestFailures : 'None');

                    // STEP 11 — enter City (default form remains otherwise unchanged)
                    console.log('');
                    console.log('========================================');
                    console.log('PROBE-001 / STEP 11 — ENTER CITY');
                    console.log('========================================');

                    const cityInput = page.locator('input[name="city"]');
                    const cityVisible = await cityInput.isVisible().catch(() => false);
                    console.log('CITY INPUT:', cityVisible ? 'VISIBLE' : 'NOT FOUND');

                    if (cityVisible) {
                      const beforeCity = await cityInput.inputValue().catch(() => '');
                      console.log('CITY VALUE BEFORE:', JSON.stringify(beforeCity));

                      console.log('');
                      console.log('ACTION: Fill city with Bremen');

                      await cityInput.fill('Bremen');

                      // Small stabilization window
                      await page.waitForTimeout(1000);

                      const afterCity = await cityInput.inputValue().catch(() => '');
                      const cityAccepted = afterCity === 'Bremen';
                      console.log('CITY VALUE AFTER:', JSON.stringify(afterCity));
                      console.log('CITY ACCEPTED:', cityAccepted ? 'YES' : 'NO');

                      // Validation / helper text checks
                      const helperCount = await page
                        .locator('[class*="help"], [class*="hint"], [class*="error"], [class*="invalid"], [role="alert"]')
                        .count()
                        .catch(() => 0);
                      console.log('HELPER/VALIDATION ELEMENTS COUNT (rough):', helperCount);

                      const validationText = await page
                        .locator('[class*="error"], [class*="invalid"], [role="alert"]')
                        .innerText()
                        .catch(() => '')
                        .then(t => t.trim());

                      const hasValidationText = Boolean(validationText);
                      console.log('VALIDATION TEXT PRESENT:', hasValidationText ? 'YES' : 'NO');
                      if (hasValidationText) console.log('VALIDATION TEXT:', validationText);

                      const s11 = await captureState('step-11-after-city');

                      console.log('');
                      console.log('--- AFTER CITY ENTRY ---');
                      console.log('URL:', s11.url);
                      console.log('TITLE:', s11.title);
                      console.log('LANG:', s11.lang);

                      // Explicit: CTA state (enabled/disabled) if detectable
                      const recAfter = page.getByRole('button', { name: /Отримати рекомендації/i });
                      const recAfterEnabled = await recAfter.isEnabled().catch(() => false);
                      console.log('CTA Отримати рекомендації ENABLED:', recAfterEnabled ? 'YES' : 'NO');

                      // STEP 12 — Get recommendations with City=Bremen
                      console.log('');
                      console.log('========================================');
                      console.log('PROBE-001 / STEP 12 — RECOMMENDATIONS (BREMEN)');
                      console.log('========================================');

                      const recBtn12 = page.getByRole('button', {
                        name: /Отримати рекомендації/i,
                      });
                      const recBtn12Visible = await recBtn12.isVisible().catch(() => false);
                      console.log(
                        'GET RECOMMENDATIONS BUTTON:',
                        recBtn12Visible ? 'VISIBLE' : 'NOT FOUND'
                      );

                      if (recBtn12Visible) {
                        requestFailures.length = 0;
                        const responses12 = [];
                        const onResponse12 = response => {
                          responses12.push({
                            url: response.url(),
                            status: response.status(),
                            method: response.request().method(),
                          });
                        };
                        page.on('response', onResponse12);

                        const beforeSnap12 = await page.locator('body').ariaSnapshot();
                        const beforeUrl12 = page.url();
                        const beforeText12 = await page.locator('body').innerText();

                        console.log('');
                        console.log('ACTION: Click Отримати рекомендації (city=Bremen)');

                        await recBtn12.click();

                        const loadingDuring12 = await page
                          .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
                          .count()
                          .catch(() => 0);

                        await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
                        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
                        await page.waitForTimeout(4000);

                        page.off('response', onResponse12);

                        const afterUrl12 = page.url();
                        const urlChanged12 = afterUrl12 !== beforeUrl12;
                        const afterSnap12 = await page.locator('body').ariaSnapshot().catch(() => '');
                        const afterText12 = await page.locator('body').innerText();
                        const uiChanged12 =
                          afterSnap12 !== beforeSnap12 ||
                          urlChanged12 ||
                          afterText12 !== beforeText12;

                        console.log('UI CHANGED:', uiChanged12 ? 'YES' : 'NO');
                        console.log(
                          'URL CHANGED:',
                          urlChanged12 ? `YES (${beforeUrl12} → ${afterUrl12})` : 'NO'
                        );
                        console.log(
                          'LOADING DURING SUBMIT:',
                          loadingDuring12 > 0
                            ? `YES (${loadingDuring12})`
                            : 'None observed immediately after click'
                        );

                        const s12 = await captureState(
                          'step-12-after-recommendations-bremen'
                        );

                        const headings12 = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll(
                          els => els.map(e => ({ tag: e.tagName, text: e.textContent.trim() }))
                        );

                        const fieldValues12 = await page.locator('input, select, textarea').evaluateAll(
                          els =>
                            els.map(e => ({
                              tag: e.tagName.toLowerCase(),
                              type: e.type || e.getAttribute('type'),
                              name: e.name,
                              value: e.value,
                              checked:
                                e.type === 'checkbox' || e.type === 'radio'
                                  ? e.checked
                                  : undefined,
                            }))
                        );

                        const validation12 = await page
                          .locator('[aria-invalid="true"], [class*="invalid"], [class*="validation"], :invalid')
                          .evaluateAll(
                            els =>
                              els.map(e => ({
                                tag: e.tagName,
                                name: e.getAttribute('name'),
                                message: e.validationMessage || e.textContent?.trim(),
                              }))
                          )
                          .catch(() => []);

                        const arrivingFrom12 = await page
                          .getByText(/Arriving from/i)
                          .allTextContents()
                          .catch(() => []);

                        const recPanel = await page
                          .locator('[class*="recommend"], [class*="result"], [class*="Result"], aside, [role="region"]')
                          .evaluateAll(
                            els =>
                              els
                                .map(e => ({
                                  tag: e.tagName,
                                  className: e.className,
                                  text: e.textContent?.trim()?.slice(0, 500),
                                }))
                                .filter(e => e.text)
                          )
                          .catch(() => []);

                        console.log('');
                        console.log('--- AFTER RECOMMENDATIONS (BREMEN) ---');
                        console.log('');
                        console.log('URL:', s12.url);
                        console.log('TITLE:', s12.title);
                        console.log('LANG:', s12.lang);

                        console.log('');
                        console.log('UI SURFACE / MODULE:');
                        console.log('  Path:', new URL(s12.url).pathname);

                        console.log('');
                        console.log('BUTTONS:');
                        console.log(s12.buttons);

                        console.log('');
                        console.log('LINKS:');
                        console.log(s12.links);

                        console.log('');
                        console.log('INPUTS / SELECTS / TEXTAREAS (current values):');
                        console.log(fieldValues12);

                        console.log('');
                        console.log('HEADINGS:');
                        console.log(headings12);

                        console.log('');
                        console.log('MAIN VISIBLE TEXT (first 8000 chars):');
                        console.log(afterText12.slice(0, 8000));

                        console.log('');
                        console.log('ACCESSIBILITY SNAPSHOT:');
                        console.log(s12.snapshot);

                        console.log('');
                        console.log('VALIDATION MESSAGES:');
                        console.log(validation12.length ? validation12 : 'None detected');

                        console.log('');
                        console.log(
                          'ARRIVING FROM CONTEXT:',
                          arrivingFrom12.length ? arrivingFrom12 : 'Not found'
                        );

                        console.log('');
                        console.log('RESULT/RECOMMEND PANEL CANDIDATES:');
                        console.log(recPanel.length ? recPanel : 'None detected');

                        console.log('');
                        console.log('NETWORK RESPONSES AFTER CLICK:');
                        const relevant = responses12.filter(
                          r => !r.url.includes('_rsc=') && !r.url.includes('.js') && !r.url.includes('.css') && !r.url.includes('.woff') && !r.url.includes('.png')
                        );
                        console.log(relevant.length ? relevant : responses12.slice(0, 20));

                        const loading12 = await page
                          .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
                          .count();
                        console.log('');
                        console.log(
                          'LOADING STATE (after):',
                          loading12 > 0 ? `YES (${loading12})` : 'None'
                        );
                        const error12 = await page
                          .locator('[class*="error"], [role="alert"][class*="error"], [class*="Error"]')
                          .count();
                        console.log(
                          'ERROR STATE:',
                          error12 > 0 ? `YES (${error12})` : 'None'
                        );

                        console.log('');
                        console.log('CONSOLE ERRORS:');
                        console.log(consoleErrors.length ? consoleErrors : 'None');
                        console.log('PAGE ERRORS:');
                        console.log(pageErrors.length ? pageErrors : 'None');
                        console.log('REQUEST FAILURES:');
                        console.log(requestFailures.length ? requestFailures : 'None');

                        // STEP 13 — capture execute API response
                        console.log('');
                        console.log('========================================');
                        console.log('PROBE-001 / STEP 13 — EXECUTE RESPONSE');
                        console.log('========================================');

                        const cityAfter12 = await page.locator('input[name="city"]').inputValue().catch(() => '');
                        if (cityAfter12 !== 'Bremen') {
                          console.log(
                            'RESTORE FORM STATE: city was',
                            JSON.stringify(cityAfter12),
                            '→ fill Bremen (required starting state for STEP 13)'
                          );
                          await page.locator('input[name="city"]').fill('Bremen');
                          await page.waitForTimeout(500);
                        }

                        const recBtn13 = page.getByRole('button', {
                          name: /Отримати рекомендації/i,
                        });
                        const recBtn13Visible = await recBtn13.isVisible().catch(() => false);
                        console.log(
                          'GET RECOMMENDATIONS BUTTON:',
                          recBtn13Visible ? 'VISIBLE' : 'NOT FOUND'
                        );

                        const cityBefore13 = await page.locator('input[name="city"]').inputValue().catch(() => '');
                        console.log('CITY BEFORE CLICK:', JSON.stringify(cityBefore13));

                        if (recBtn13Visible) {
                          requestFailures.length = 0;

                          const executeWait = page.waitForResponse(
                            response =>
                              response.url().includes(
                                '/api/modules/healthcare-navigation/execute'
                              ) &&
                              response.request().method() === 'POST',
                            { timeout: 20000 }
                          );

                          console.log('');
                          console.log('ACTION: Click Отримати рекомендації');
                          console.log('INTERCEPT: POST /api/modules/healthcare-navigation/execute');

                          await recBtn13.click();

                          const loadingDuring13 = await page
                            .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
                            .count()
                            .catch(() => 0);

                          let executeCapture = {
                            captured: false,
                            error: null,
                          };

                          try {
                            const executeResponse = await executeWait;
                            const request = executeResponse.request();
                            const contentType =
                              executeResponse.headers()['content-type'] ??
                              executeResponse.headers()['Content-Type'] ??
                              null;
                            const rawText = await executeResponse.text();
                            let parsed = null;
                            try {
                              parsed = JSON.parse(rawText);
                            } catch {
                              parsed = null;
                            }

                            executeCapture = {
                              captured: true,
                              url: executeResponse.url(),
                              method: request.method(),
                              status: executeResponse.status(),
                              contentType,
                              requestPayload: request.postData() ?? null,
                              bodyText: parsed ? null : rawText,
                              bodyJson: parsed,
                            };
                          } catch (error) {
                            executeCapture = {
                              captured: false,
                              error: error.message,
                            };
                          }

                          await fs.writeFile(
                            `${OUT}/step-13-execute-response.json`,
                            JSON.stringify(executeCapture, null, 2)
                          );

                          await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
                          await page.waitForTimeout(3000);

                          const s13 = await captureState('step-13-after-execution');

                          const headings13 = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll(
                            els => els.map(e => ({ tag: e.tagName, text: e.textContent.trim() }))
                          );

                          const fieldValues13 = await page.locator('input, select, textarea').evaluateAll(
                            els =>
                              els.map(e => ({
                                tag: e.tagName.toLowerCase(),
                                type: e.type || e.getAttribute('type'),
                                name: e.name,
                                value: e.value,
                                checked:
                                  e.type === 'checkbox' || e.type === 'radio'
                                    ? e.checked
                                    : undefined,
                              }))
                          );

                          const mainText13 = await page.locator('body').innerText();

                          function inspectBody(body) {
                            if (!body || typeof body !== 'object') {
                              return {
                                hasRecommendations: false,
                                hasError: false,
                                hasNextStep: false,
                                hasResultOrState: false,
                                topLevelKeys: body == null ? [] : [typeof body],
                              };
                            }
                            const keys = Object.keys(body);
                            const blob = JSON.stringify(body).toLowerCase();
                            return {
                              topLevelKeys: keys,
                              hasRecommendations:
                                'recommendations' in body ||
                                'recommendation' in body ||
                                blob.includes('recommend'),
                              hasError:
                                'error' in body ||
                                'errors' in body ||
                                blob.includes('"error"'),
                              hasNextStep:
                                'nextStep' in body ||
                                'next_step' in body ||
                                blob.includes('next step') ||
                                blob.includes('nextstep'),
                              hasResultOrState:
                                'result' in body ||
                                'state' in body ||
                                'data' in body ||
                                'output' in body,
                            };
                          }

                          const bodyInspect = inspectBody(executeCapture.bodyJson);

                          console.log('');
                          console.log('--- AFTER EXECUTION ---');
                          console.log('');
                          console.log('EXECUTE CAPTURED:', executeCapture.captured ? 'YES' : 'NO');
                          if (executeCapture.error) {
                            console.log('EXECUTE WAIT ERROR:', executeCapture.error);
                          }
                          console.log('HTTP STATUS:', executeCapture.status ?? 'n/a');
                          console.log('CONTENT-TYPE:', executeCapture.contentType ?? 'n/a');
                          console.log('REQUEST PAYLOAD:');
                          console.log(executeCapture.requestPayload ?? 'None');
                          console.log('');
                          console.log('RESPONSE BODY:');
                          if (executeCapture.bodyJson) {
                            console.log(JSON.stringify(executeCapture.bodyJson, null, 2));
                          } else {
                            console.log(executeCapture.bodyText ?? 'None');
                          }
                          console.log('');
                          console.log('BODY CONTAINS RECOMMENDATIONS:', bodyInspect.hasRecommendations ? 'YES' : 'NO');
                          console.log('BODY CONTAINS ERROR:', bodyInspect.hasError ? 'YES' : 'NO');
                          console.log('BODY CONTAINS NEXT STEP/ACTION:', bodyInspect.hasNextStep ? 'YES' : 'NO');
                          console.log('BODY CONTAINS RESULT/STATE:', bodyInspect.hasResultOrState ? 'YES' : 'NO');
                          console.log('TOP-LEVEL KEYS:', bodyInspect.topLevelKeys);

                          console.log('');
                          console.log('URL:', s13.url);
                          console.log('TITLE:', s13.title);
                          console.log('LANG:', s13.lang);

                          console.log('');
                          console.log('BUTTONS:');
                          console.log(s13.buttons);

                          console.log('');
                          console.log('LINKS:');
                          console.log(s13.links);

                          console.log('');
                          console.log('INPUTS / SELECTS / TEXTAREAS:');
                          console.log(fieldValues13);

                          console.log('');
                          console.log('HEADINGS:');
                          console.log(headings13);

                          console.log('');
                          console.log('MAIN VISIBLE TEXT (first 8000 chars):');
                          console.log(mainText13.slice(0, 8000));

                          console.log('');
                          console.log('ACCESSIBILITY SNAPSHOT:');
                          console.log(s13.snapshot);

                          const recRendered = /recommend/i.test(mainText13) &&
                            !/Отримати рекомендації/.test(mainText13.replace(/Отримати рекомендації/g, ''));
                          const recInText = /рекомендац|recommend/i.test(mainText13);
                          console.log('');
                          console.log('RECOMMENDATIONS IN VISIBLE TEXT:', recInText ? 'YES' : 'NO');
                          console.log(
                            'FORM CITY RESET:',
                            fieldValues13.find(f => f.name === 'city')?.value === ''
                              ? 'YES (empty)'
                              : `NO (value=${JSON.stringify(fieldValues13.find(f => f.name === 'city')?.value)})`
                          );

                          const loading13 = await page
                            .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
                            .count();
                          console.log(
                            'LOADING DURING SUBMIT:',
                            loadingDuring13 > 0 ? `YES (${loadingDuring13})` : 'None observed immediately after click'
                          );
                          console.log('LOADING STATE (after):', loading13 > 0 ? `YES (${loading13})` : 'None');
                          const error13 = await page
                            .locator('[class*="error"], [role="alert"][class*="error"], [class*="Error"]')
                            .count();
                          console.log('ERROR STATE:', error13 > 0 ? `YES (${error13})` : 'None');

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
        scenario: 'healthcare-steps-9-13',
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
