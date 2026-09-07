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
  console.log('SETUP: through Start Registration so Life Event nav is available (not recorded as audit steps)');
  await setupToStartRegistration();

                          // STEP 14 — open health insurance profile action
                          console.log('');
                          console.log('========================================');
                          console.log('PROBE-001 / STEP 14 — HEALTH INSURANCE EDIT');
                          console.log('========================================');

                          console.log('SETUP: Navigate via Життєві події (not Back)');
                          const lifeEventNav = page.getByRole('link', {
                            name: /Життєві події/i,
                          });
                          const lifeEventNavVisible = await lifeEventNav.isVisible().catch(() => false);
                          console.log(
                            'NAV LINK Життєві події:',
                            lifeEventNavVisible ? 'VISIBLE' : 'NOT FOUND'
                          );

                          if (lifeEventNavVisible) {
                            await lifeEventNav.click();
                            await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
                            await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
                            await page.waitForTimeout(2000);

                            console.log('SETUP URL AFTER NAV:', page.url());

                            const setupModal = page.getByRole('dialog');
                            const setupModalVisible = await setupModal.isVisible().catch(() => false);
                            console.log(
                              'SETUP WELCOME MODAL:',
                              setupModalVisible ? 'VISIBLE' : 'NOT VISIBLE'
                            );

                            if (setupModalVisible) {
                              const exploreBtn = page.getByRole('button', {
                                name: /Досліджувати самостійно/i,
                              });
                              if (await exploreBtn.isVisible().catch(() => false)) {
                                console.log('SETUP: Click Досліджувати самостійно (to reach graph)');
                                await exploreBtn.click();
                                await page.waitForTimeout(1500);
                              }
                            }

                            const healthNode = page.getByRole('button', {
                              name: /Зрозуміти обовʼязкове медичне страхування/i,
                            });
                            const healthNodeVisible = await healthNode.isVisible().catch(() => false);
                            console.log(
                              'SETUP NODE:',
                              healthNodeVisible ? 'VISIBLE' : 'NOT FOUND'
                            );

                            if (healthNodeVisible) {
                              console.log('SETUP: Click Зрозуміти обовʼязкове медичне страхування');
                              await healthNode.click();
                              await page.waitForTimeout(1500);
                            }

                            const editLink = page.getByRole('link', {
                              name: /Оновити медичне страхування/i,
                            });
                            const editVisible = await editLink.isVisible().catch(() => false);
                            console.log(
                              'EDIT LINK Оновити медичне страхування:',
                              editVisible ? 'VISIBLE' : 'NOT FOUND'
                            );

                            if (editVisible) {
                              requestFailures.length = 0;
                              const beforeUrl14 = page.url();
                              const href = await editLink.getAttribute('href').catch(() => null);
                              console.log('EDIT LINK HREF:', href);

                              console.log('');
                              console.log('ACTION: Click Оновити медичне страхування');

                              await editLink.click();
                              await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
                              await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
                              await page.waitForTimeout(3000);

                              const afterUrl14 = page.url();
                              console.log(
                                'URL CHANGED:',
                                afterUrl14 !== beforeUrl14
                                  ? `YES (${beforeUrl14} → ${afterUrl14})`
                                  : 'NO'
                              );

                              const s14 = await captureState(
                                'step-14-after-health-insurance-edit'
                              );

                              const headings14 = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll(
                                els => els.map(e => ({ tag: e.tagName, text: e.textContent.trim() }))
                              );

                              const fieldValues14 = await page.locator('input, select, textarea').evaluateAll(
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
                                    placeholder: e.getAttribute('placeholder'),
                                    ariaLabel: e.getAttribute('aria-label'),
                                  }))
                              );

                              const selectedOptions = await page.locator('option[selected], [aria-selected="true"], input:checked').evaluateAll(
                                els =>
                                  els.map(e => ({
                                    tag: e.tagName,
                                    name: e.getAttribute('name'),
                                    value: e.value || e.textContent?.trim(),
                                  }))
                              ).catch(() => []);

                              const mainText14 = await page.locator('body').innerText();

                              console.log('');
                              console.log('--- AFTER HEALTH INSURANCE EDIT ---');
                              console.log('');
                              console.log('URL:', s14.url);
                              console.log('TITLE:', s14.title);
                              console.log('LANG:', s14.lang);

                              console.log('');
                              console.log('UI SURFACE / PATH:');
                              console.log('  Path:', new URL(s14.url).pathname);

                              console.log('');
                              console.log('BUTTONS:');
                              console.log(s14.buttons);

                              console.log('');
                              console.log('LINKS:');
                              console.log(s14.links);

                              console.log('');
                              console.log('INPUTS / SELECTS / TEXTAREAS:');
                              console.log(fieldValues14);

                              console.log('');
                              console.log('CHECKED / SELECTED:');
                              console.log(selectedOptions.length ? selectedOptions : 'None detected');

                              console.log('');
                              console.log('HEADINGS:');
                              console.log(headings14);

                              console.log('');
                              console.log('MAIN VISIBLE TEXT (first 8000 chars):');
                              console.log(mainText14.slice(0, 8000));

                              console.log('');
                              console.log('ACCESSIBILITY SNAPSHOT:');
                              console.log(s14.snapshot);

                              const loading14 = await page
                                .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
                                .count();
                              console.log('');
                              console.log('LOADING STATE:', loading14 > 0 ? `YES (${loading14})` : 'None');
                              const error14 = await page
                                .locator('[class*="error"], [role="alert"][class*="error"], [class*="Error"]')
                                .count();
                              console.log('ERROR STATE:', error14 > 0 ? `YES (${error14})` : 'None');

                              console.log('');
                              console.log('CONSOLE ERRORS:');
                              console.log(consoleErrors.length ? consoleErrors : 'None');
                              console.log('PAGE ERRORS:');
                              console.log(pageErrors.length ? pageErrors : 'None');
                              console.log('REQUEST FAILURES:');
                              console.log(requestFailures.length ? requestFailures : 'None');

                              // STEP 15 — Cancel health insurance edit
                              console.log('');
                              console.log('========================================');
                              console.log('PROBE-001 / STEP 15 — CANCEL EDIT');
                              console.log('========================================');

                              const typeBefore15 = await page
                                .locator('select[aria-label="Тип страхування"]')
                                .inputValue()
                                .catch(() => '');
                              const insuredBefore15 = await page
                                .getByRole('checkbox', {
                                  name: /Зараз застрахований/i,
                                })
                                .isChecked()
                                .catch(() => null);

                              console.log('FORM BEFORE CANCEL:');
                              console.log('  insurance type:', JSON.stringify(typeBefore15));
                              console.log('  currently insured checked:', insuredBefore15);

                              const cancelBtn = page.getByRole('button', {
                                name: /Скасувати/i,
                              });
                              const cancelVisible = await cancelBtn.isVisible().catch(() => false);
                              console.log(
                                'CANCEL BUTTON:',
                                cancelVisible ? 'VISIBLE' : 'NOT FOUND'
                              );

                              if (cancelVisible) {
                                requestFailures.length = 0;
                                const beforeUrl15 = page.url();

                                console.log('');
                                console.log('ACTION: Click Скасувати');
                                console.log('FIELDS LEFT UNCHANGED');

                                await cancelBtn.click();
                                await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
                                await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
                                await page.waitForTimeout(2500);

                                const afterUrl15 = page.url();
                                console.log(
                                  'URL CHANGED:',
                                  afterUrl15 !== beforeUrl15
                                    ? `YES (${beforeUrl15} → ${afterUrl15})`
                                    : 'NO'
                                );

                                const s15 = await captureState('step-15-after-cancel');

                                const headings15 = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll(
                                  els => els.map(e => ({ tag: e.tagName, text: e.textContent.trim() }))
                                );

                                const fieldValues15 = await page.locator('input, select, textarea').evaluateAll(
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
                                      ariaLabel: e.getAttribute('aria-label'),
                                    }))
                                );

                                const mainText15 = await page.locator('body').innerText();
                                const arrivingFrom15 = await page
                                  .getByText(/Arriving from/i)
                                  .allTextContents()
                                  .catch(() => []);

                                console.log('');
                                console.log('--- AFTER CANCEL ---');
                                console.log('');
                                console.log('URL:', s15.url);
                                console.log('TITLE:', s15.title);
                                console.log('LANG:', s15.lang);

                                console.log('');
                                console.log('UI SURFACE / PATH:');
                                console.log('  Path:', new URL(s15.url).pathname);

                                console.log('');
                                console.log('BUTTONS:');
                                console.log(s15.buttons);

                                console.log('');
                                console.log('LINKS:');
                                console.log(s15.links);

                                console.log('');
                                console.log('INPUTS / SELECTS / TEXTAREAS:');
                                console.log(fieldValues15);

                                console.log('');
                                console.log('HEADINGS:');
                                console.log(headings15);

                                console.log('');
                                console.log('MAIN VISIBLE TEXT (first 8000 chars):');
                                console.log(mainText15.slice(0, 8000));

                                console.log('');
                                console.log('ACCESSIBILITY SNAPSHOT:');
                                console.log(s15.snapshot);

                                console.log('');
                                console.log(
                                  'ARRIVING FROM CONTEXT:',
                                  arrivingFrom15.length ? arrivingFrom15 : 'Not found'
                                );

                                const loading15 = await page
                                  .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
                                  .count();
                                console.log('');
                                console.log('LOADING STATE:', loading15 > 0 ? `YES (${loading15})` : 'None');
                                const error15 = await page
                                  .locator('[class*="error"], [role="alert"][class*="error"], [class*="Error"]')
                                  .count();
                                console.log('ERROR STATE:', error15 > 0 ? `YES (${error15})` : 'None');

                                console.log('');
                                console.log('CONSOLE ERRORS:');
                                console.log(consoleErrors.length ? consoleErrors : 'None');
                                console.log('PAGE ERRORS:');
                                console.log(pageErrors.length ? pageErrors : 'None');
                                console.log('REQUEST FAILURES:');
                                console.log(requestFailures.length ? requestFailures : 'None');

                                // STEP 16 — Show route from Profile graph
                                console.log('');
                                console.log('========================================');
                                console.log('PROBE-001 / STEP 16 — SHOW ROUTE (PROFILE)');
                                console.log('========================================');

                                const showRoute16 = page.getByRole('button', {
                                  name: /Показати маршрут/i,
                                });
                                const showRoute16Visible = await showRoute16
                                  .isVisible()
                                  .catch(() => false);
                                console.log(
                                  'SHOW ROUTE BUTTON:',
                                  showRoute16Visible ? 'VISIBLE' : 'NOT FOUND'
                                );

                                if (showRoute16Visible) {
                                  requestFailures.length = 0;
                                  const beforeSnap16 = await page.locator('body').ariaSnapshot();
                                  const beforeUrl16 = page.url();
                                  const beforeText16 = await page.locator('body').innerText();

                                  console.log('');
                                  console.log('ACTION: Click Показати маршрут');

                                  await showRoute16.click();
                                  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
                                  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
                                  await page.waitForTimeout(2500);

                                  const afterUrl16 = page.url();
                                  const afterSnap16 = await page.locator('body').ariaSnapshot().catch(() => '');
                                  const afterText16 = await page.locator('body').innerText();
                                  const urlChanged16 = afterUrl16 !== beforeUrl16;
                                  const uiChanged16 =
                                    afterSnap16 !== beforeSnap16 ||
                                    urlChanged16 ||
                                    afterText16 !== beforeText16;

                                  console.log('UI CHANGED:', uiChanged16 ? 'YES' : 'NO');
                                  console.log(
                                    'URL CHANGED:',
                                    urlChanged16
                                      ? `YES (${beforeUrl16} → ${afterUrl16})`
                                      : 'NO'
                                  );

                                  const s16 = await captureState('step-16-after-show-route');

                                  const headings16 = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll(
                                    els => els.map(e => ({ tag: e.tagName, text: e.textContent.trim() }))
                                  );

                                  const fieldValues16 = await page.locator('input, select, textarea').evaluateAll(
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

                                  const selectedNode16 = await page
                                    .locator('[aria-selected="true"], [aria-current="true"]')
                                    .allTextContents()
                                    .catch(() => []);

                                  const recStep16 = await page.locator('[role="status"]').textContent().catch(() => 'None');
                                  const modal16 = await page.locator('[role="dialog"]').isVisible().catch(() => false);
                                  const status16 = await page.locator('[role="status"]').isVisible().catch(() => false);
                                  const graphNodes16 = await page
                                    .locator('[role="listbox"] button')
                                    .allTextContents()
                                    .catch(() => []);

                                  console.log('');
                                  console.log('--- AFTER SHOW ROUTE (PROFILE) ---');
                                  console.log('');
                                  console.log('URL:', s16.url);
                                  console.log('TITLE:', s16.title);
                                  console.log('LANG:', s16.lang);

                                  console.log('');
                                  console.log('UI SURFACE / PATH:');
                                  console.log('  Path:', new URL(s16.url).pathname);

                                  console.log('');
                                  console.log('BUTTONS:');
                                  console.log(s16.buttons);

                                  console.log('');
                                  console.log('LINKS:');
                                  console.log(s16.links);

                                  console.log('');
                                  console.log('INPUTS / SELECTS / TEXTAREAS:');
                                  console.log(fieldValues16);

                                  console.log('');
                                  console.log('HEADINGS:');
                                  console.log(headings16);

                                  console.log('');
                                  console.log('MAIN VISIBLE TEXT (first 8000 chars):');
                                  console.log(afterText16.slice(0, 8000));

                                  console.log('');
                                  console.log('ACCESSIBILITY SNAPSHOT:');
                                  console.log(s16.snapshot);

                                  console.log('');
                                  console.log(
                                    'SELECTED NODE:',
                                    selectedNode16.length ? selectedNode16 : 'None detected'
                                  );
                                  console.log('RECOMMENDED NEXT STEP:', recStep16);
                                  console.log('MODAL:', modal16 ? 'VISIBLE' : 'NOT VISIBLE');
                                  console.log('STATUS BANNER:', status16 ? 'VISIBLE' : 'NOT VISIBLE');
                                  console.log('GRAPH NODES:', graphNodes16);

                                  const loading16 = await page
                                    .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
                                    .count();
                                  console.log('');
                                  console.log('LOADING STATE:', loading16 > 0 ? `YES (${loading16})` : 'None');
                                  const error16 = await page
                                    .locator('[class*="error"], [role="alert"][class*="error"], [class*="Error"]')
                                    .count();
                                  console.log('ERROR STATE:', error16 > 0 ? `YES (${error16})` : 'None');

                                  console.log('');
                                  console.log('CONSOLE ERRORS:');
                                  console.log(consoleErrors.length ? consoleErrors : 'None');
                                  console.log('PAGE ERRORS:');
                                  console.log(pageErrors.length ? pageErrors : 'None');
                                  console.log('REQUEST FAILURES:');
                                  console.log(requestFailures.length ? requestFailures : 'None');

                                  // STEP 17 — change insurance type to GKV
                                  console.log('');
                                  console.log('========================================');
                                  console.log('PROBE-001 / STEP 17 — SELECT GKV');
                                  console.log('========================================');

                                  console.log('SETUP: Navigate to /profile/health-insurance/edit');
                                  const lifeEventNav17 = page.getByRole('link', {
                                    name: /Життєві події/i,
                                  });
                                  await lifeEventNav17.click();
                                  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
                                  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
                                  await page.waitForTimeout(2000);

                                  const modal17 = page.getByRole('dialog');
                                  if (await modal17.isVisible().catch(() => false)) {
                                    const explore17 = page.getByRole('button', {
                                      name: /Досліджувати самостійно/i,
                                    });
                                    if (await explore17.isVisible().catch(() => false)) {
                                      console.log('SETUP: Dismiss modal via Досліджувати самостійно');
                                      await explore17.click();
                                      await page.waitForTimeout(1500);
                                    }
                                  }

                                  const healthNode17 = page.getByRole('button', {
                                    name: /Зрозуміти обовʼязкове медичне страхування/i,
                                  });
                                  if (await healthNode17.isVisible().catch(() => false)) {
                                    console.log('SETUP: Select healthcare node');
                                    await healthNode17.click();
                                    await page.waitForTimeout(1500);
                                  }

                                  const editLink17 = page.getByRole('link', {
                                    name: /Оновити медичне страхування/i,
                                  });
                                  const editVisible17 = await editLink17.isVisible().catch(() => false);
                                  console.log(
                                    'SETUP EDIT LINK:',
                                    editVisible17 ? 'VISIBLE' : 'NOT FOUND'
                                  );

                                  if (editVisible17) {
                                    await editLink17.click();
                                    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
                                    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
                                    await page.waitForTimeout(2000);

                                    const typeSelect = page.getByRole('combobox', {
                                      name: /Тип страхування/i,
                                    });
                                    const insuredBox = page.getByRole('checkbox', {
                                      name: /Зараз застрахований/i,
                                    });
                                    const typeBefore = await typeSelect.inputValue().catch(() => '');
                                    const insuredBefore = await insuredBox.isChecked().catch(() => null);
                                    console.log('FORM BEFORE SELECT:');
                                    console.log('  type:', JSON.stringify(typeBefore));
                                    console.log('  insured checked:', insuredBefore);

                                    const saveBefore = page.getByRole('button', { name: /^Зберегти$/i });
                                    const cancelBefore = page.getByRole('button', { name: /Скасувати/i });
                                    const saveEnabledBefore = await saveBefore.isEnabled().catch(() => false);
                                    const cancelEnabledBefore = await cancelBefore.isEnabled().catch(() => false);
                                    console.log('SAVE ENABLED BEFORE:', saveEnabledBefore ? 'YES' : 'NO');
                                    console.log('CANCEL ENABLED BEFORE:', cancelEnabledBefore ? 'YES' : 'NO');

                                    requestFailures.length = 0;
                                    const net17 = [];
                                    const onReq17 = request => {
                                      net17.push({
                                        method: request.method(),
                                        url: request.url(),
                                      });
                                    };
                                    page.on('request', onReq17);

                                    console.log('');
                                    console.log('ACTION: Select Державне медстрахування (GKV)');

                                    await typeSelect.selectOption({
                                      label: 'Державне медстрахування (GKV)',
                                    });
                                    await page.waitForTimeout(2000);
                                    page.off('request', onReq17);

                                    const s17 = await captureState('step-17-after-select-gkv');

                                    const typeAfter = await typeSelect.inputValue().catch(() => '');
                                    const selectedLabel = await typeSelect.evaluate(
                                      el => el.options[el.selectedIndex]?.textContent?.trim()
                                    ).catch(() => '');
                                    const insuredAfter = await insuredBox.isChecked().catch(() => null);
                                    const saveEnabledAfter = await saveBefore.isEnabled().catch(() => false);
                                    const cancelEnabledAfter = await cancelBefore.isEnabled().catch(() => false);

                                    const headings17 = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll(
                                      els => els.map(e => ({ tag: e.tagName, text: e.textContent.trim() }))
                                    );
                                    const fieldValues17 = await page.locator('input, select, textarea').evaluateAll(
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
                                          ariaLabel: e.getAttribute('aria-label'),
                                        }))
                                    );
                                    const mainText17 = await page.locator('body').innerText();
                                    const helper17 = await page
                                      .locator('[class*="help"], [class*="hint"], [class*="helper"]')
                                      .allTextContents()
                                      .catch(() => []);
                                    const validation17 = await page
                                      .locator('[aria-invalid="true"], [class*="invalid"], [class*="validation"], :invalid')
                                      .evaluateAll(
                                        els =>
                                          els.map(e => ({
                                            name: e.getAttribute('name'),
                                            message: e.validationMessage || e.textContent?.trim(),
                                          }))
                                      )
                                      .catch(() => []);

                                    const relevantNet = net17.filter(
                                      r =>
                                        !r.url.includes('_rsc=') &&
                                        !r.url.match(/\.(js|css|woff2?|png|svg|ico)(\?|$)/i)
                                    );

                                    console.log('');
                                    console.log('--- AFTER SELECT GKV ---');
                                    console.log('');
                                    console.log('URL:', s17.url);
                                    console.log('TITLE:', s17.title);
                                    console.log('LANG:', s17.lang);

                                    console.log('');
                                    console.log('UI SURFACE / PATH:');
                                    console.log('  Path:', new URL(s17.url).pathname);

                                    console.log('');
                                    console.log('BUTTONS:');
                                    console.log(s17.buttons);

                                    console.log('');
                                    console.log('LINKS:');
                                    console.log(s17.links);

                                    console.log('');
                                    console.log('INPUTS / SELECTS / TEXTAREAS:');
                                    console.log(fieldValues17);

                                    console.log('');
                                    console.log('SELECTED OPTION VALUE:', JSON.stringify(typeAfter));
                                    console.log('SELECTED OPTION LABEL:', selectedLabel);
                                    console.log('CHECKBOX INSURED:', insuredAfter);

                                    console.log('');
                                    console.log('HEADINGS:');
                                    console.log(headings17);

                                    console.log('');
                                    console.log('MAIN VISIBLE TEXT (first 8000 chars):');
                                    console.log(mainText17.slice(0, 8000));

                                    console.log('');
                                    console.log('ACCESSIBILITY SNAPSHOT:');
                                    console.log(s17.snapshot);

                                    console.log('');
                                    console.log('HELPER TEXT:', helper17.length ? helper17 : 'None detected');
                                    console.log('VALIDATION:', validation17.length ? validation17 : 'None detected');
                                    console.log('SAVE ENABLED AFTER:', saveEnabledAfter ? 'YES' : 'NO');
                                    console.log('CANCEL ENABLED AFTER:', cancelEnabledAfter ? 'YES' : 'NO');
                                    console.log(
                                      'SAVE STATE CHANGED:',
                                      saveEnabledBefore !== saveEnabledAfter ? 'YES' : 'NO'
                                    );
                                    console.log(
                                      'CANCEL STATE CHANGED:',
                                      cancelEnabledBefore !== cancelEnabledAfter ? 'YES' : 'NO'
                                    );

                                    console.log('');
                                    console.log('NETWORK AFTER SELECT (filtered):');
                                    console.log(relevantNet.length ? relevantNet : 'None');
                                    console.log('NETWORK AFTER SELECT (all count):', net17.length);

                                    const loading17 = await page
                                      .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
                                      .count();
                                    console.log('');
                                    console.log('LOADING STATE:', loading17 > 0 ? `YES (${loading17})` : 'None');
                                    const error17 = await page
                                      .locator('[class*="error"], [role="alert"][class*="error"], [class*="Error"]')
                                      .count();
                                    console.log('ERROR STATE:', error17 > 0 ? `YES (${error17})` : 'None');

                                    console.log('');
                                    console.log('CONSOLE ERRORS:');
                                    console.log(consoleErrors.length ? consoleErrors : 'None');
                                    console.log('PAGE ERRORS:');
                                    console.log(pageErrors.length ? pageErrors : 'None');
                                    console.log('REQUEST FAILURES:');
                                    console.log(requestFailures.length ? requestFailures : 'None');

                                    // STEP 18 — Save GKV
                                    console.log('');
                                    console.log('========================================');
                                    console.log('PROBE-001 / STEP 18 — SAVE GKV');
                                    console.log('========================================');

                                    const saveBtn18 = page.getByRole('button', {
                                      name: /^Зберегти$/i,
                                    });
                                    const saveVisible18 = await saveBtn18.isVisible().catch(() => false);
                                    console.log(
                                      'SAVE BUTTON:',
                                      saveVisible18 ? 'VISIBLE' : 'NOT FOUND'
                                    );

                                    const typeBefore18 = await typeSelect.inputValue().catch(() => '');
                                    const insuredBefore18 = await insuredBox.isChecked().catch(() => null);
                                    console.log('FORM BEFORE SAVE:');
                                    console.log('  type:', JSON.stringify(typeBefore18));
                                    console.log('  insured checked:', insuredBefore18);

                                    if (saveVisible18) {
                                      requestFailures.length = 0;
                                      const beforeUrl18 = page.url();
                                      const mutations18 = [];
                                      const onResp18 = async response => {
                                        const method = response.request().method();
                                        if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
                                          return;
                                        }
                                        const contentType =
                                          response.headers()['content-type'] ??
                                          response.headers()['Content-Type'] ??
                                          null;
                                        let bodyText = null;
                                        let bodyJson = null;
                                        try {
                                          bodyText = await response.text();
                                          try {
                                            bodyJson = JSON.parse(bodyText);
                                          } catch {
                                            bodyJson = null;
                                          }
                                        } catch {
                                          bodyText = '(could not read body)';
                                        }
                                        mutations18.push({
                                          method,
                                          url: response.url(),
                                          status: response.status(),
                                          contentType,
                                          requestPayload: response.request().postData() ?? null,
                                          bodyJson,
                                          bodyText: bodyJson ? null : bodyText,
                                        });
                                      };
                                      page.on('response', onResp18);

                                      console.log('');
                                      console.log('ACTION: Click Зберегти');
                                      console.log('URL BEFORE:', beforeUrl18);

                                      await saveBtn18.click();

                                      const loadingDuring18 = await page
                                        .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
                                        .count()
                                        .catch(() => 0);

                                      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
                                      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
                                      await page.waitForTimeout(3000);
                                      page.off('response', onResp18);

                                      await fs.writeFile(
                                        `${OUT}/step-18-save-mutations.json`,
                                        JSON.stringify(mutations18, null, 2)
                                      );

                                      const afterUrl18 = page.url();
                                      const s18 = await captureState('step-18-after-save');

                                      const headings18 = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll(
                                        els => els.map(e => ({ tag: e.tagName, text: e.textContent.trim() }))
                                      );
                                      const fieldValues18 = await page.locator('input, select, textarea').evaluateAll(
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
                                            ariaLabel: e.getAttribute('aria-label'),
                                          }))
                                      );
                                      const mainText18 = await page.locator('body').innerText();
                                      const arrivingFrom18 = await page
                                        .getByText(/Arriving from/i)
                                        .allTextContents()
                                        .catch(() => []);
                                      const recBanner18 = await page.locator('[role="status"]').textContent().catch(() => '');
                                      const alerts18 = await page.locator('[role="alert"], [class*="success"], [class*="toast"]').allTextContents().catch(() => []);

                                      console.log('');
                                      console.log('--- AFTER SAVE ---');
                                      console.log('');
                                      console.log('URL AFTER:', s18.url);
                                      console.log(
                                        'URL CHANGED:',
                                        afterUrl18 !== beforeUrl18
                                          ? `YES (${beforeUrl18} → ${afterUrl18})`
                                          : 'NO'
                                      );
                                      console.log('TITLE:', s18.title);
                                      console.log('LANG:', s18.lang);

                                      console.log('');
                                      console.log('UI SURFACE / PATH:');
                                      console.log('  Path:', new URL(s18.url).pathname);

                                      console.log('');
                                      console.log('BUTTONS:');
                                      console.log(s18.buttons);

                                      console.log('');
                                      console.log('LINKS:');
                                      console.log(s18.links);

                                      console.log('');
                                      console.log('INPUTS / SELECTS / TEXTAREAS:');
                                      console.log(fieldValues18);

                                      console.log('');
                                      console.log('HEADINGS:');
                                      console.log(headings18);

                                      console.log('');
                                      console.log('MAIN VISIBLE TEXT (first 8000 chars):');
                                      console.log(mainText18.slice(0, 8000));

                                      console.log('');
                                      console.log('ACCESSIBILITY SNAPSHOT:');
                                      console.log(s18.snapshot);

                                      console.log('');
                                      console.log(
                                        'ARRIVING FROM CONTEXT:',
                                        arrivingFrom18.length ? arrivingFrom18 : 'Not found'
                                      );
                                      console.log(
                                        'STATUS BANNER:',
                                        recBanner18 ? recBanner18 : 'None'
                                      );
                                      console.log(
                                        'ALERTS / SUCCESS CANDIDATES:',
                                        alerts18.length ? alerts18 : 'None detected'
                                      );

                                      console.log('');
                                      console.log('MUTATION REQUESTS:');
                                      console.log(
                                        mutations18.length
                                          ? JSON.stringify(mutations18, null, 2)
                                          : 'None captured'
                                      );

                                      const loading18 = await page
                                        .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
                                        .count();
                                      console.log('');
                                      console.log(
                                        'LOADING DURING SAVE:',
                                        loadingDuring18 > 0
                                          ? `YES (${loadingDuring18})`
                                          : 'None observed immediately after click'
                                      );
                                      console.log('LOADING STATE (after):', loading18 > 0 ? `YES (${loading18})` : 'None');
                                      const error18 = await page
                                        .locator('[class*="error"], [role="alert"][class*="error"], [class*="Error"]')
                                        .count();
                                      console.log('ERROR STATE:', error18 > 0 ? `YES (${error18})` : 'None');

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
                                      }


  await fs.writeFile(
    `${OUT}/result.json`,
    JSON.stringify(
      {
        probe: 'PROBE-001',
        scenario: 'profile-health-insurance-steps-14-18',
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
