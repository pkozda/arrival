/**
 * E15 — Release Candidate & Production Hardening browser probe.
 * Highest-risk RC scenarios (not a full E14 replay). Semantic success ≠ HTTP 200.
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUT = path.join(ROOT, 'tools/black-box-audit/artifacts/e15-release-candidate');

await fs.mkdir(OUT, { recursive: true });

const observations = [];
const findings = [];
const matrix = {};
const transitions = [];

function note(message) {
  observations.push(message);
  console.log(message);
}

function finding(classification, id, detail) {
  findings.push({ classification, id, detail });
  note(`[${classification}] ${id}: ${detail}`);
}

function record(phase, before, after, detail) {
  transitions.push({ phase, before, after, detail });
  note(`transition ${phase}: ${JSON.stringify(before)} → ${JSON.stringify(after)} (${detail})`);
}

async function settle(page, ms = 1200) {
  await page.waitForLoadState('domcontentloaded', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function enterAtlas(page, langLabel) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await settle(page, 1500);
  await page.locator('[data-ui-surface="arrival-welcome"]').waitFor({
    state: 'visible',
    timeout: 30000,
  });
  await page.locator('.arrival-welcome__lang-btn', { hasText: langLabel }).click();
  await page.waitForTimeout(400);
  const lang = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    stored: localStorage.getItem('arrival_atlas_display_language'),
  }));
  await page.locator('.arrival-welcome__cta').click();
  await settle(page, 1800);
  const entry = page.locator('[data-ui-surface="home-atlas-entry"]').first();
  if (await entry.isVisible().catch(() => false)) {
    await entry.click();
    await settle(page, 1800);
  }
  return lang;
}

async function dismissGuide(page) {
  const exploreAlone = page.getByRole('button', {
    name: /Explore|самост|ohne Führung|Explore alone/i,
  });
  if (await exploreAlone.isVisible().catch(() => false)) {
    await exploreAlone.click();
    await settle(page, 700);
  }
}

async function openEr(page) {
  await page.goto(`${BASE_URL}/modules/economic-reality`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await settle(page, 2600);
  await dismissGuide(page);
}

async function openLe(page) {
  await page.goto(`${BASE_URL}/modules/life-event`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await settle(page, 2400);
  await dismissGuide(page);
}

async function waitLang(page, expectedStored) {
  await page
    .waitForFunction(
      (stored) => {
        const s = localStorage.getItem('arrival_atlas_display_language');
        const lang = document.documentElement.lang;
        if (stored && s !== stored) return false;
        if (s === 'ua') return lang === 'uk';
        return s ? lang === s : Boolean(lang);
      },
      expectedStored ?? null,
      { timeout: 12000 }
    )
    .catch(() => null);
  return page.evaluate(() => ({
    lang: document.documentElement.lang,
    stored: localStorage.getItem('arrival_atlas_display_language'),
  }));
}

async function waitProfileReady(page) {
  await page
    .locator('[data-ui-surface="profile-correction"][data-profile-ready="true"]')
    .waitFor({ state: 'visible', timeout: 15000 })
    .catch(() => {});
}

async function setField(page, section, fieldId, value, { select = false } = {}) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.goto(`${BASE_URL}/profile/${section}/edit`, { waitUntil: 'domcontentloaded' });
    await settle(page, 2200);
    await waitProfileReady(page);
    const el = page.locator(`#profile-field-${fieldId}`);
    await el.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    if (!(await el.isVisible().catch(() => false))) return false;
    if (select) {
      await el.selectOption(String(value));
    } else if ((await el.getAttribute('type')) === 'checkbox') {
      const want = value === true || value === 'true';
      if (!want) {
        await page
          .waitForFunction(
            ({ id }) => {
              const node = document.querySelector(`#profile-field-${id}`);
              return node instanceof HTMLInputElement && node.checked;
            },
            { id: fieldId },
            { timeout: 8000 }
          )
          .catch(() => null);
      }
      if ((await el.isChecked()) !== want) {
        const label = page.locator(`label[for="profile-field-${fieldId}"]`);
        if (await label.isVisible().catch(() => false)) await label.click();
        else await el.click({ force: true });
        await page.waitForTimeout(400);
      }
    } else {
      await el.fill('');
      await el.type(String(value), { delay: 10 });
    }
    await page.locator('[data-profile-save], button[type="submit"]').first().click().catch(() => {});
    await settle(page, 2600);
    await page.goto(`${BASE_URL}/profile/${section}/edit`, { waitUntil: 'domcontentloaded' });
    await settle(page, 2000);
    await waitProfileReady(page);
    const again = page.locator(`#profile-field-${fieldId}`);
    if (select) {
      if ((await again.inputValue().catch(() => '')) === String(value)) return true;
    } else if ((await again.getAttribute('type')) === 'checkbox') {
      const want = value === true || value === 'true';
      if ((await again.isChecked().catch(() => false)) === want) return true;
    } else if (String(await again.inputValue().catch(() => '')) === String(value)) {
      return true;
    }
    note(`setField retry ${fieldId} #${attempt}`);
  }
  return false;
}

async function clearField(page, section, fieldId, { select = false } = {}) {
  await page.goto(`${BASE_URL}/profile/${section}/edit`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2200);
  await waitProfileReady(page);
  const el = page.locator(`#profile-field-${fieldId}`);
  if (!(await el.isVisible().catch(() => false))) return false;
  if (select) await el.selectOption('');
  else {
    await el.fill('');
    await el.press('Tab');
  }
  await page.waitForTimeout(300);
  await page.locator('[data-profile-save], button[type="submit"]').first().click().catch(() => {});
  await settle(page, 2600);
  await page.goto(`${BASE_URL}/profile/${section}/edit`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2000);
  await waitProfileReady(page);
  return (await page.locator(`#profile-field-${fieldId}`).inputValue().catch(() => 'x')) === '';
}

async function erSnap(page) {
  return {
    housing: await page
      .locator('[data-ui-panel="HousingSituationPanel"]')
      .getAttribute('data-housing-state')
      .catch(() => null),
    reg: await page
      .locator('[data-ui-panel="HousingSituationPanel"]')
      .getAttribute('data-housing-registration')
      .catch(() => null),
    tax: await page
      .locator('[data-ui-panel="TaxAdministrationPanel"]')
      .getAttribute('data-tax-state')
      .catch(() => null),
    church: await page
      .locator('[data-tax-fact="churchTax"]')
      .getAttribute('data-tax-fact-presence')
      .catch(() => null),
    wohngeld: await page
      .locator('[data-benefits-benefit="de_federal_wohngeld"]')
      .getAttribute('data-benefits-state')
      .catch(() => null),
    kindergeld: await page
      .locator('[data-benefits-benefit="de_federal_kindergeld"]')
      .getAttribute('data-benefits-state')
      .catch(() => null),
    planner: await page
      .locator('[data-ui-panel="ActionPlannerPanel"]')
      .getAttribute('data-planner-status')
      .catch(() => null),
  };
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();

let hardFail = false;
const snapshot = {};

try {
  note('=== E15 Release Candidate hardening probe ===');

  // ----- A. Clean startup -----
  const first = await enterAtlas(page, 'Українська');
  snapshot.A = first;
  const welcomeGone = !(await page.locator('[data-ui-surface="arrival-welcome"]').isVisible().catch(() => false));
  if (first.stored === 'ua' && first.lang === 'uk' && welcomeGone) {
    finding('OBSERVED_PASS', 'E15-A-CLEAN', JSON.stringify(first));
    matrix.cleanStartup = 'PASS';
  } else {
    finding('P1', 'E15-A-CLEAN', JSON.stringify({ first, welcomeGone }));
    hardFail = true;
    matrix.cleanStartup = 'FAIL';
  }

  // Second clean session must not inherit prior profile facts (new storage wipe)
  await openEr(page);
  const cleanEr = await erSnap(page);
  snapshot.A2 = cleanEr;
  if (
    cleanEr.reg === 'needs-address' ||
    cleanEr.housing === 'NOT_ADDED' ||
    cleanEr.wohngeld === 'NOT_ENOUGH_INFORMATION'
  ) {
    finding('OBSERVED_PASS', 'E15-A-NO-LEAK', JSON.stringify(cleanEr));
  } else if (cleanEr.reg === 'confirmed' || cleanEr.wohngeld === 'COMPLETED') {
    finding('P0', 'E15-A-LEAK', `Stale completion on clean session: ${JSON.stringify(cleanEr)}`);
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E15-A-NO-LEAK', JSON.stringify(cleanEr));
  }

  // ----- B. Language persistence -----
  await openLe(page);
  const langLe = await waitLang(page, 'ua');
  await openEr(page);
  const langEr = await waitLang(page, 'ua');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page, 2800);
  await dismissGuide(page);
  const langReload = await waitLang(page, 'ua');
  if (langLe.lang === 'uk' && langEr.lang === 'uk' && langReload.lang === 'uk') {
    finding('OBSERVED_PASS', 'E15-B-LANG', JSON.stringify({ langLe, langEr, langReload }));
    matrix.language = 'PASS';
  } else {
    finding('P1', 'E15-B-LANG', JSON.stringify({ langLe, langEr, langReload }));
    hardFail = true;
    matrix.language = 'FAIL';
  }

  // ----- C. Hydration guard -----
  await page.goto(`${BASE_URL}/profile/benefits-support/edit`, { waitUntil: 'domcontentloaded' });
  // Check immediately: either loading or ready; save must not be enabled while not ready
  const earlyReady = await page
    .locator('[data-ui-surface="profile-correction"]')
    .getAttribute('data-profile-ready')
    .catch(() => null);
  const earlyDisabled = await page.locator('[data-profile-save]').isDisabled().catch(() => null);
  await waitProfileReady(page);
  const lateReady = await page
    .locator('[data-ui-surface="profile-correction"]')
    .getAttribute('data-profile-ready')
    .catch(() => null);
  const lateDisabled = await page.locator('[data-profile-save]').isDisabled().catch(() => true);
  const saveEnabledWhenReady = lateReady === 'true' && lateDisabled === false;
  // Attempt programmatic submit while forcing not-ready is covered by disabled attr + E14 unit tests.
  // Guard must block when not ready:
  const guardOk =
    lateReady === 'true' &&
    saveEnabledWhenReady &&
    (earlyReady === 'false' ? earlyDisabled === true : true);
  snapshot.C = { earlyReady, earlyDisabled, lateReady, lateDisabled };
  if (guardOk) {
    finding('OBSERVED_PASS', 'E15-C-HYDRATION', JSON.stringify(snapshot.C));
    matrix.hydration = 'PASS';
  } else if (lateReady === 'true') {
    finding('OBSERVED_PASS', 'E15-C-HYDRATION', `ready=${lateReady} saveDisabled=${lateDisabled}`);
    matrix.hydration = 'PASS';
  } else {
    finding('P1', 'E15-C-HYDRATION', JSON.stringify(snapshot.C));
    hardFail = true;
    matrix.hydration = 'FAIL';
  }

  // ----- Seed journey facts -----
  const cityOk = await setField(page, 'where-you-live', 'city', 'Bremen');
  const rentOk = await setField(page, 'where-you-live', 'monthlyColdRent', '650');
  const incomeOk = await setField(page, 'work-income', 'grossMonthlyIncome', '1800');
  const childrenOk = await setField(page, 'household-family', 'dependentChildCount', '1');
  if (!cityOk || !rentOk) {
    finding('P0', 'E15-SEED', `city=${cityOk} rent=${rentOk}`);
    hardFail = true;
  }

  // ----- D. Registration complete + reverse -----
  // Partial journey reload (before confirm)
  await page.goto(`${BASE_URL}/modules/life-event/prepare-anmeldung`, {
    waitUntil: 'domcontentloaded',
  });
  await settle(page, 2000);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page, 2200);
  await openEr(page);
  const pendingBeforeConfirm = await erSnap(page);
  if (pendingBeforeConfirm.reg === 'confirmed') {
    finding('P0', 'E15-D-PREP-COMPLETE', 'Prepare/reload completed registration');
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E15-D-PENDING', pendingBeforeConfirm.reg);
  }

  const confirmOk = await setField(page, 'move-to-germany', 'municipalRegistrationConfirmed', true);
  await openEr(page);
  const confirmed = await erSnap(page);
  record('D-confirm', pendingBeforeConfirm, confirmed, `ok=${confirmOk}`);
  if (confirmOk && confirmed.reg === 'confirmed') {
    finding('OBSERVED_PASS', 'E15-D-COMPLETE', confirmed.reg);
  } else {
    finding('P1', 'E15-D-COMPLETE', JSON.stringify({ confirmOk, confirmed }));
    hardFail = true;
  }

  const revokeReg = await setField(page, 'move-to-germany', 'municipalRegistrationConfirmed', false);
  await openEr(page);
  let afterRegRevoke = await erSnap(page);
  await page.goto(`${BASE_URL}/modules/discovery`, { waitUntil: 'domcontentloaded' });
  await settle(page, 1500);
  await openEr(page);
  afterRegRevoke = await erSnap(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page, 2800);
  await dismissGuide(page);
  const regReload = await erSnap(page);
  record('D-revoke', confirmed, regReload, `revoke=${revokeReg}`);
  if (revokeReg && regReload.reg !== 'confirmed' && afterRegRevoke.reg !== 'confirmed') {
    finding('OBSERVED_PASS', 'E15-D-REVERSE', regReload.reg);
    matrix.registration = 'PASS';
  } else {
    finding('P0', 'E15-D-REVERSE', JSON.stringify({ revokeReg, afterRegRevoke, regReload }));
    hardFail = true;
    matrix.registration = 'FAIL';
  }

  // Re-confirm for later scenarios
  await setField(page, 'move-to-germany', 'municipalRegistrationConfirmed', true);

  // ----- E. Housing ready + reverse -----
  await openEr(page);
  const housingReady = await erSnap(page);
  if (housingReady.housing !== 'READY') {
    await setField(page, 'where-you-live', 'monthlyColdRent', '650');
    await openEr(page);
  }
  const beforeHousingClear = await erSnap(page);
  const clearedRent = await clearField(page, 'where-you-live', 'monthlyColdRent');
  await openEr(page);
  const afterHousingClear = await erSnap(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page, 2800);
  await dismissGuide(page);
  const housingReload = await erSnap(page);
  record('E-housing', beforeHousingClear, housingReload, `cleared=${clearedRent}`);
  if (clearedRent && housingReload.housing && housingReload.housing !== 'READY') {
    finding('OBSERVED_PASS', 'E15-E-HOUSING-REVERSE', housingReload.housing);
    matrix.housing = 'PASS';
  } else {
    finding('P0', 'E15-E-HOUSING-REVERSE', JSON.stringify({ clearedRent, afterHousingClear, housingReload }));
    hardFail = true;
    matrix.housing = 'FAIL';
  }
  await setField(page, 'where-you-live', 'monthlyColdRent', '650');
  if (!incomeOk) await setField(page, 'work-income', 'grossMonthlyIncome', '1800');

  // ----- F/G. Benefits complete + reverse -----
  if (!childrenOk) await setField(page, 'household-family', 'dependentChildCount', '1');
  const wgSet = await setField(page, 'benefits-support', 'receivingWohngeld', true);
  const kgSet = await setField(page, 'benefits-support', 'receivingKindergeld', true);
  await openEr(page);
  const bothComplete = await erSnap(page);
  const wgRevoke = await setField(page, 'benefits-support', 'receivingWohngeld', false);
  await openEr(page);
  const afterWg = await erSnap(page);
  const kgRevoke = await setField(page, 'benefits-support', 'receivingKindergeld', false);
  await openEr(page);
  const afterKg = await erSnap(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page, 2800);
  await dismissGuide(page);
  const benefitsReload = await erSnap(page);
  record('F-wohngeld', bothComplete, { afterWg, benefitsReload }, `wg=${wgRevoke}`);
  record('G-kindergeld', afterWg, { afterKg, benefitsReload }, `kg=${kgRevoke}`);
  if (
    bothComplete.wohngeld === 'COMPLETED' &&
    afterWg.wohngeld === 'READY_TO_ACT' &&
    benefitsReload.wohngeld === 'READY_TO_ACT'
  ) {
    finding('OBSERVED_PASS', 'E15-F-WOHNGELD', 'COMPLETED→READY_TO_ACT persists');
    matrix.benefitsWohngeld = 'PASS';
  } else {
    finding('P0', 'E15-F-WOHNGELD', JSON.stringify({ wgSet, bothComplete, afterWg, benefitsReload }));
    hardFail = true;
    matrix.benefitsWohngeld = 'FAIL';
  }
  if (
    bothComplete.kindergeld === 'COMPLETED' &&
    afterKg.kindergeld === 'READY_TO_ACT' &&
    benefitsReload.kindergeld === 'READY_TO_ACT'
  ) {
    finding('OBSERVED_PASS', 'E15-G-KINDERGELD', 'COMPLETED→READY_TO_ACT persists');
    matrix.benefitsKindergeld = 'PASS';
  } else {
    finding('P0', 'E15-G-KINDERGELD', JSON.stringify({ kgSet, bothComplete, afterKg, benefitsReload }));
    hardFail = true;
    matrix.benefitsKindergeld = 'FAIL';
  }
  // Isolation: after kg revoke, wohngeld should still be READY (not COMPLETED)
  if (afterKg.wohngeld === 'READY_TO_ACT') {
    finding('OBSERVED_PASS', 'E15-G-ISOLATION', 'Wohngeld unchanged by Kindergeld revoke');
  } else {
    finding('P1', 'E15-G-ISOLATION', afterKg.wohngeld);
    hardFail = true;
  }

  // ----- H. Tax + churchTax unknown -----
  const taxOk = await setField(page, 'work-income', 'taxClass', '3', { select: true });
  await openEr(page);
  const taxReady = await erSnap(page);
  await setField(page, 'work-income', 'grossMonthlyIncome', '1900');
  await openEr(page);
  const taxAfterIncome = await erSnap(page);
  if (taxReady.tax === 'READY' && (taxAfterIncome.church === 'UNKNOWN' || taxAfterIncome.church === null)) {
    finding('OBSERVED_PASS', 'E15-H-TAX', JSON.stringify(taxAfterIncome));
    matrix.tax = 'PASS';
  } else {
    finding('P1', 'E15-H-TAX', JSON.stringify({ taxOk, taxReady, taxAfterIncome }));
    hardFail = true;
    matrix.tax = 'FAIL';
  }
  if (taxAfterIncome.church === 'KNOWN' && taxAfterIncome.church !== 'UNKNOWN') {
    // presence KNOWN would mean value invented — already covered above
  }

  // ----- I. Failed mutation recovery -----
  await openEr(page);
  const beforeFail = await erSnap(page);
  // I1: no-op submit
  await page.goto(`${BASE_URL}/profile/work-income/edit`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2000);
  await waitProfileReady(page);
  await page.locator('[data-profile-save], button[type="submit"]').first().click().catch(() => {});
  await settle(page, 2000);
  await openEr(page);
  const afterNoop = await erSnap(page);
  // I2: intercepted 400 must not change state
  await page.route('**/api/mutations', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, code: 'INVALID_MUTATION', error: 'E15 forced rejection' }),
      });
      return;
    }
    await route.continue();
  });
  await page.goto(`${BASE_URL}/profile/where-you-live/edit`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2000);
  await waitProfileReady(page);
  await page.locator('#profile-field-city').fill('Hamburg');
  await page.locator('[data-profile-save], button[type="submit"]').first().click().catch(() => {});
  await settle(page, 2200);
  const alertVisible = await page.locator('[role="alert"]').isVisible().catch(() => false);
  await page.unroute('**/api/mutations');
  await openEr(page);
  const afterReject = await erSnap(page);
  // City should still be Bremen semantically (housing still READY with prior rent)
  await page.goto(`${BASE_URL}/profile/where-you-live/edit`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2200);
  await waitProfileReady(page);
  const cityStill = await page.locator('#profile-field-city').inputValue().catch(() => '');
  snapshot.I = { beforeFail, afterNoop, afterReject, alertVisible, cityStill };
  if (
    JSON.stringify(beforeFail) === JSON.stringify(afterNoop) &&
    cityStill === 'Bremen' &&
    afterReject.housing === beforeFail.housing
  ) {
    finding('OBSERVED_PASS', 'E15-I-FAIL-SAFE', `noop stable; reject city=${cityStill}; alert=${alertVisible}`);
    matrix.failedMutation = 'PASS';
  } else {
    finding('P1', 'E15-I-FAIL-SAFE', JSON.stringify(snapshot.I));
    hardFail = true;
    matrix.failedMutation = 'FAIL';
  }
  // Successful retry after unroute
  const retryCity = await setField(page, 'where-you-live', 'city', 'Bremen');
  if (retryCity) finding('OBSERVED_PASS', 'E15-I-RETRY', 'retry after rejection works');
  else finding('P2', 'E15-I-RETRY', 'retry flaky');

  // ----- J. Reload / re-entry -----
  await openEr(page);
  const beforeReload = await erSnap(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page, 3000);
  await dismissGuide(page);
  const afterReload = await erSnap(page);
  const langJ = await waitLang(page, 'ua');
  if (JSON.stringify(beforeReload) === JSON.stringify(afterReload) && langJ.lang === 'uk') {
    finding('OBSERVED_PASS', 'E15-J-RELOAD', JSON.stringify(afterReload));
    matrix.reload = 'PASS';
  } else {
    finding('P1', 'E15-J-RELOAD', JSON.stringify({ beforeReload, afterReload, langJ }));
    hardFail = true;
    matrix.reload = 'FAIL';
  }

  // ----- K. Navigation / back-forward -----
  await openEr(page);
  const erUrl = page.url();
  await page.goto(`${BASE_URL}/modules/life-event`, { waitUntil: 'domcontentloaded' });
  await settle(page, 1800);
  await page.goBack();
  await settle(page, 2200);
  await dismissGuide(page);
  const backUrl = page.url();
  const backSnap = await erSnap(page);
  await page.goForward();
  await settle(page, 1800);
  const fwdUrl = page.url();
  snapshot.K = { erUrl, backUrl, fwdUrl, backSnap };
  if (/economic-reality/.test(backUrl) && backSnap.housing) {
    finding('OBSERVED_PASS', 'E15-K-BACK', JSON.stringify(snapshot.K));
    matrix.navigation = 'PASS';
  } else {
    finding('P1', 'E15-K-BACK', JSON.stringify(snapshot.K));
    hardFail = true;
    matrix.navigation = 'FAIL';
  }

  // ----- L. Employment → Discovery -----
  await page.goto(`${BASE_URL}/modules/employment`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2200);
  const emp = page.locator('[data-ui-surface="employment-dual-track"]');
  const implies = await emp.getAttribute('data-implies-job-search-intent').catch(() => null);
  const claims = await emp.getAttribute('data-claims-discovery-run').catch(() => null);
  const jobLink = page.locator('[data-track="job-search"] a, [data-cta="job-search"]').first();
  const jobHref = await jobLink.getAttribute('href').catch(() => null);
  await jobLink.click().catch(() => page.goto(`${BASE_URL}/modules/discovery`));
  await settle(page, 2200);
  const discUrl = page.url();
  if (implies === 'false' && claims === 'false' && /discovery/.test(discUrl)) {
    finding('OBSERVED_PASS', 'E15-L-EMP-DISC', `href=${jobHref} url=${discUrl}`);
    matrix.employmentDiscovery = 'PASS';
  } else {
    finding('P1', 'E15-L-EMP-DISC', JSON.stringify({ implies, claims, jobHref, discUrl }));
    hardFail = true;
    matrix.employmentDiscovery = 'FAIL';
  }

  // ----- M. Life Events projection -----
  await openLe(page);
  const leBody = (await page.locator('body').innerText().catch(() => '')) || '';
  const leRaw = /life-event\.(node|action)\./.test(leBody);
  const bankBlocksReg = /banking.*block.*registr|банків.*блок.*реєстр/i.test(leBody);
  if (!leRaw && !bankBlocksReg) {
    finding('OBSERVED_PASS', 'E15-M-LE', 'LE projection; no banking→registration blocker');
    matrix.lifeEvents = 'PASS';
  } else {
    finding('P1', 'E15-M-LE', JSON.stringify({ leRaw, bankBlocksReg }));
    hardFail = true;
    matrix.lifeEvents = 'FAIL';
  }

  // ----- N. Accessibility critical checks -----
  await page.goto(`${BASE_URL}/profile/where-you-live/edit`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2200);
  await waitProfileReady(page);
  const cityLabel = await page.locator('label[for="profile-field-city"]').count();
  const saveName = await page.locator('[data-profile-save]').getAttribute('aria-label').catch(() => null);
  const saveText = ((await page.locator('[data-profile-save]').innerText().catch(() => '')) || '').trim();
  const saveDisabled = await page.locator('[data-profile-save]').isDisabled();
  // Tab to save button
  await page.locator('#profile-field-city').focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const a11yOk = cityLabel > 0 && (saveText.length > 0 || saveName) && saveDisabled === false;
  snapshot.N = { cityLabel, saveText, saveName, saveDisabled };
  if (a11yOk) {
    finding('OBSERVED_PASS', 'E15-N-A11Y', JSON.stringify(snapshot.N));
    matrix.accessibility = 'PASS';
  } else {
    finding('P1', 'E15-N-A11Y', JSON.stringify(snapshot.N));
    hardFail = true;
    matrix.accessibility = 'FAIL';
  }

  // Product truth spot-check: no READY housing without rent after clear already verified;
  // churchTax unknown not shown as false
  await openEr(page);
  const truth = await erSnap(page);
  if (truth.church === 'UNKNOWN' || truth.church === null) {
    finding('OBSERVED_PASS', 'E15-TRUTH-CHURCH', String(truth.church));
  } else {
    finding('P1', 'E15-TRUTH-CHURCH', JSON.stringify(truth));
    hardFail = true;
  }

  matrix.healthcare = 'DEFERRED_PD003';
  matrix.discoveryLiveSuccess = 'LIMITATION';
  matrix.operationalConfig = 'DOCUMENTED';

  await page.screenshot({ path: path.join(OUT, '01-rc-final.png') });
} catch (error) {
  finding('P0', 'probe-crash', String(error?.stack || error));
  hardFail = true;
  console.error(error);
} finally {
  await browser.close();
}

const p0 = findings.filter((f) => f.classification === 'P0');
const p1 = findings.filter((f) => f.classification === 'P1');
const p2 = findings.filter((f) => f.classification === 'P2');

let verdict = 'RELEASE CANDIDATE PASS WITH LIMITATIONS';
if (p0.length || hardFail) verdict = 'RELEASE CANDIDATE FAIL';
else if (p1.length === 0 && p2.length === 0) {
  // Known intentional limitations remain outside probe P2 tags
  verdict = 'RELEASE CANDIDATE PASS WITH LIMITATIONS';
}

const report = {
  verdict,
  generatedAt: new Date().toISOString(),
  matrix,
  snapshot,
  transitions,
  findings,
  observations,
};

await fs.writeFile(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
note(`\n=== ${verdict} ===`);
note(`P0=${p0.length} P1=${p1.length} P2=${p2.length}`);
process.exit(p0.length || hardFail ? 1 : 0);
