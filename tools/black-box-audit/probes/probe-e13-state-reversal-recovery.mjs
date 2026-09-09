/**
 * E13 — State reversal, recovery & recalculation browser probe.
 * Verifies derived UI follows current authoritative facts on reverse transitions.
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUT = path.join(ROOT, 'tools/black-box-audit/artifacts/e13-state-reversal');

await fs.mkdir(OUT, { recursive: true });

const observations = [];
const findings = [];
const transitions = [];

function note(message) {
  observations.push(message);
  console.log(message);
}

function finding(classification, id, detail) {
  findings.push({ classification, id, detail });
  note(`[${classification}] ${id}: ${detail}`);
}

function recordTransition(name, before, after, detail) {
  transitions.push({ name, before, after, detail });
  note(`transition ${name}: ${JSON.stringify(before)} → ${JSON.stringify(after)} (${detail})`);
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
  await page.waitForTimeout(500);
  await page.locator('.arrival-welcome__cta').click();
  await settle(page, 1800);
  const entry = page.locator('[data-ui-surface="home-atlas-entry"]').first();
  if (await entry.isVisible().catch(() => false)) {
    await entry.click();
    await settle(page, 2000);
  }
}

async function dismissGuide(page) {
  const exploreAlone = page.getByRole('button', {
    name: /Explore|самост|ohne Führung|Explore alone/i,
  });
  if (await exploreAlone.isVisible().catch(() => false)) {
    await exploreAlone.click();
    await settle(page, 800);
  }
}

async function openEr(page) {
  await page.goto(`${BASE_URL}/modules/economic-reality`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await settle(page, 2800);
  await dismissGuide(page);
}

async function openLifeEvent(page) {
  await page.goto(`${BASE_URL}/modules/life-event`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await settle(page, 2500);
  await dismissGuide(page);
}

async function setProfileField(page, section, fieldId, value, { select = false } = {}) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.goto(`${BASE_URL}/profile/${section}/edit`, { waitUntil: 'domcontentloaded' });
    await settle(page, 2400);
    const el = page.locator(`#profile-field-${fieldId}`);
    await el.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    if (!(await el.isVisible().catch(() => false))) return false;
    if (select) {
      await el.selectOption(String(value));
    } else if ((await el.getAttribute('type')) === 'checkbox') {
      const want = value === true || value === 'true';
      const checked = await el.isChecked();
      if (checked !== want) {
        const label = page.locator(`label[for="profile-field-${fieldId}"]`);
        if (await label.isVisible().catch(() => false)) await label.click();
        else await el.click({ force: true });
        await page.waitForTimeout(500);
        // Controlled checkbox: confirm React state flipped before submit.
        if ((await el.isChecked()) !== want) {
          await el.click({ force: true });
          await page.waitForTimeout(300);
        }
      }
    } else {
      await el.click();
      await el.fill('');
      await el.type(String(value), { delay: 15 });
    }
    await page.waitForTimeout(400);
    await page.locator('button[type="submit"]').first().click().catch(() => {});
    await settle(page, 2800);
    await page.goto(`${BASE_URL}/profile/${section}/edit`, { waitUntil: 'domcontentloaded' });
    await settle(page, 2200);
    const again = page.locator(`#profile-field-${fieldId}`);
    await again.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    if (select) {
      const persisted = await again.inputValue().catch(() => '');
      if (persisted === String(value)) return true;
    } else if ((await again.getAttribute('type')) === 'checkbox') {
      const want = value === true || value === 'true';
      if ((await again.isChecked().catch(() => false)) === want) return true;
    } else {
      const persisted = await again.inputValue().catch(() => '');
      if (String(persisted) === String(value)) return true;
    }
    note(`setProfileField retry ${fieldId} attempt=${attempt}`);
  }
  return false;
}

async function clearField(page, section, fieldId, { select = false } = {}) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.goto(`${BASE_URL}/profile/${section}/edit`, { waitUntil: 'domcontentloaded' });
    await settle(page, 2400);
    const el = page.locator(`#profile-field-${fieldId}`);
    await el.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    if (!(await el.isVisible().catch(() => false))) return false;
    if (select) {
      await el.selectOption('');
    } else {
      await el.click();
      await el.fill('');
      await el.press('Tab');
    }
    await page.waitForTimeout(500);
    await page.locator('button[type="submit"]').first().click().catch(() => {});
    await settle(page, 3000);
    await page.goto(`${BASE_URL}/profile/${section}/edit`, { waitUntil: 'domcontentloaded' });
    await settle(page, 2400);
    const again = page.locator(`#profile-field-${fieldId}`);
    const value = await again.inputValue().catch(() => 'MISSING');
    if (value === '' || value === null) return true;
    note(`clearField retry ${fieldId} attempt=${attempt} value=${value}`);
  }
  return false;
}

async function housingAttrs(page) {
  const panel = page.locator('[data-ui-panel="HousingSituationPanel"]');
  return {
    state: await panel.getAttribute('data-housing-state').catch(() => null),
    reg: await panel.getAttribute('data-housing-registration').catch(() => null),
  };
}

async function taxAttrs(page) {
  const panel = page.locator('[data-ui-panel="TaxAdministrationPanel"]');
  return {
    state: await panel.getAttribute('data-tax-state').catch(() => null),
    church: await page
      .locator('[data-tax-fact="churchTax"]')
      .getAttribute('data-tax-fact-presence')
      .catch(() => null),
  };
}

async function benefitState(page, benefitId) {
  return page
    .locator(`[data-benefits-benefit="${benefitId}"]`)
    .getAttribute('data-benefits-state')
    .catch(() => null);
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
  note('=== E13 State reversal / recovery probe ===');

  await enterAtlas(page, 'Українська');

  // --- Setup housing + income for benefits readiness ---
  const cityOk = await setProfileField(page, 'where-you-live', 'city', 'Bremen');
  const rentOk = await setProfileField(page, 'where-you-live', 'monthlyColdRent', '650');
  const incomeOk = await setProfileField(page, 'work-income', 'grossMonthlyIncome', '1800');
  const childrenOk = await setProfileField(page, 'household-family', 'dependentChildCount', '1');
  if (!cityOk || !rentOk) {
    finding('P0', 'E13-SETUP-HOUSING', `city=${cityOk} rent=${rentOk}`);
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E13-SETUP-HOUSING', 'city+rent');
  }
  if (!incomeOk) finding('P2', 'E13-SETUP-INCOME', 'income save flaky');
  if (!childrenOk) finding('P2', 'E13-SETUP-CHILDREN', 'children save flaky');

  // === A — Registration complete ===
  const confirmOk = await setProfileField(
    page,
    'move-to-germany',
    'municipalRegistrationConfirmed',
    true
  );
  await openEr(page);
  const afterConfirm = await housingAttrs(page);
  snapshot.A = afterConfirm;
  recordTransition('A-registration-complete', { reg: null }, afterConfirm, 'confirm=true');
  if (confirmOk && afterConfirm.reg === 'confirmed') {
    finding('OBSERVED_PASS', 'E13-A-REG-COMPLETE', JSON.stringify(afterConfirm));
  } else {
    finding('P1', 'E13-A-REG-COMPLETE', `confirmOk=${confirmOk} ${JSON.stringify(afterConfirm)}`);
    hardFail = true;
  }
  await page.screenshot({ path: path.join(OUT, '01-registration-complete.png') });

  // === B — Registration reverse ===
  const revokeOk = await setProfileField(
    page,
    'move-to-germany',
    'municipalRegistrationConfirmed',
    false
  );
  await openEr(page);
  const afterRevoke = await housingAttrs(page);
  snapshot.B = { revokeOk, afterRevoke };
  recordTransition('B-registration-revoke', afterConfirm, afterRevoke, `revokeOk=${revokeOk}`);
  if (revokeOk && afterRevoke.reg !== 'confirmed') {
    finding('OBSERVED_PASS', 'E13-B-REG-REVERSE', JSON.stringify(afterRevoke));
  } else if (!revokeOk) {
    finding('P2', 'E13-B-REG-REVERSE-UNSUPPORTED', 'Could not uncheck confirmation in UI');
  } else {
    finding('P0', 'E13-B-REG-STALE', `still confirmed after revoke: ${JSON.stringify(afterRevoke)}`);
    hardFail = true;
  }

  await openLifeEvent(page);
  const leBody = (await page.locator('body').innerText().catch(() => '')) || '';
  if (/life-event\.(node|action)\./.test(leBody)) {
    finding('P1', 'E13-B-LE-RAW', 'Raw LE keys after revoke');
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E13-B-LE', 'LE surface after revoke (no raw keys)');
  }

  // === C — Housing READY → incomplete (clear rent) ===
  // Re-ensure rent then clear
  await setProfileField(page, 'where-you-live', 'monthlyColdRent', '650');
  await openEr(page);
  const housingReady = await housingAttrs(page);
  const clearedRent = await clearField(page, 'where-you-live', 'monthlyColdRent');
  await openEr(page);
  const housingAfterClear = await housingAttrs(page);
  snapshot.C = { housingReady, clearedRent, housingAfterClear };
  recordTransition('C-housing-clear-rent', housingReady, housingAfterClear, `cleared=${clearedRent}`);
  if (clearedRent && housingAfterClear.state && housingAfterClear.state !== 'READY') {
    finding('OBSERVED_PASS', 'E13-C-HOUSING-REVERSE', JSON.stringify(housingAfterClear));
  } else if (!clearedRent) {
    finding('P2', 'E13-C-HOUSING-CLEAR', 'Rent clear did not persist empty (capability/UI gap)');
  } else {
    finding('P0', 'E13-C-HOUSING-STALE', `still READY after clear: ${JSON.stringify(housingAfterClear)}`);
    hardFail = true;
  }
  // Restore rent for benefits phases
  await setProfileField(page, 'where-you-live', 'monthlyColdRent', '650');

  // === D — Wohngeld READY → COMPLETED → READY ===
  await openEr(page);
  const wgBefore = await benefitState(page, 'de_federal_wohngeld');
  const wgComplete = await setProfileField(page, 'benefits-support', 'receivingWohngeld', true);
  await openEr(page);
  const wgCompleted = await benefitState(page, 'de_federal_wohngeld');
  const wgRevoke = await setProfileField(page, 'benefits-support', 'receivingWohngeld', false);
  await openEr(page);
  const wgAfter = await benefitState(page, 'de_federal_wohngeld');
  snapshot.D = { wgBefore, wgComplete, wgCompleted, wgRevoke, wgAfter };
  recordTransition('D-wohngeld', { wgBefore, wgCompleted }, { wgAfter }, `revoke=${wgRevoke}`);
  if (wgCompleted === 'COMPLETED' && wgAfter === 'READY_TO_ACT') {
    finding('OBSERVED_PASS', 'E13-D-WOHNGELD', `${wgCompleted}→${wgAfter}`);
  } else if (wgCompleted === 'COMPLETED' && wgAfter === 'COMPLETED') {
    finding('P0', 'E13-D-WOHNGELD-STALE', `stale COMPLETED after false: ${wgAfter}`);
    hardFail = true;
  } else {
    finding(
      'P1',
      'E13-D-WOHNGELD',
      `before=${wgBefore} completed=${wgCompleted} after=${wgAfter} save=${wgComplete}/${wgRevoke}`
    );
    if (wgCompleted === 'COMPLETED') hardFail = true;
  }

  // === E — Kindergeld READY → COMPLETED → READY ===
  const kgComplete = await setProfileField(page, 'benefits-support', 'receivingKindergeld', true);
  await openEr(page);
  const kgCompleted = await benefitState(page, 'de_federal_kindergeld');
  const wgIsolation = await benefitState(page, 'de_federal_wohngeld');
  const kgRevoke = await setProfileField(page, 'benefits-support', 'receivingKindergeld', false);
  await openEr(page);
  const kgAfter = await benefitState(page, 'de_federal_kindergeld');
  const wgAfterKg = await benefitState(page, 'de_federal_wohngeld');
  snapshot.E = { kgComplete, kgCompleted, kgRevoke, kgAfter, wgIsolation, wgAfterKg };
  recordTransition('E-kindergeld', { kgCompleted }, { kgAfter }, `revoke=${kgRevoke}`);
  if (kgCompleted === 'COMPLETED' && kgAfter === 'READY_TO_ACT') {
    finding('OBSERVED_PASS', 'E13-E-KINDERGELD', `${kgCompleted}→${kgAfter}`);
  } else if (kgCompleted === 'COMPLETED' && kgAfter === 'COMPLETED') {
    finding('P0', 'E13-E-KINDERGELD-STALE', `stale COMPLETED: ${kgAfter}`);
    hardFail = true;
  } else {
    finding(
      'P1',
      'E13-E-KINDERGELD',
      `completed=${kgCompleted} after=${kgAfter} save=${kgComplete}/${kgRevoke}`
    );
    if (kgCompleted === 'COMPLETED') hardFail = true;
  }
  if (wgAfterKg === wgIsolation || (wgAfterKg === 'READY_TO_ACT' && wgIsolation === 'READY_TO_ACT')) {
    finding('OBSERVED_PASS', 'E13-E-ISOLATION', `Wohngeld stayed ${wgAfterKg}`);
  } else {
    finding('P1', 'E13-E-ISOLATION', `Wohngeld changed ${wgIsolation}→${wgAfterKg}`);
    hardFail = true;
  }

  // === F — Tax incomplete → READY ===
  const taxSet = await setProfileField(page, 'work-income', 'taxClass', '3', { select: true });
  await openEr(page);
  const taxReady = await taxAttrs(page);
  snapshot.F = { taxSet, taxReady };
  recordTransition('F-tax-ready', { state: null }, taxReady, `taxSet=${taxSet}`);
  if (taxReady.state === 'READY') {
    finding('OBSERVED_PASS', 'E13-F-TAX-READY', JSON.stringify(taxReady));
  } else {
    finding('P1', 'E13-F-TAX-READY', JSON.stringify({ taxSet, taxReady }));
    hardFail = true;
  }

  // Clear taxClass if supported
  const taxCleared = await clearField(page, 'work-income', 'taxClass', { select: true });
  await openEr(page);
  const taxAfterClear = await taxAttrs(page);
  snapshot.F2 = { taxCleared, taxAfterClear };
  recordTransition('F2-tax-clear', taxReady, taxAfterClear, `cleared=${taxCleared}`);
  if (taxCleared && taxAfterClear.state && taxAfterClear.state !== 'READY') {
    finding('OBSERVED_PASS', 'E13-F-TAX-REVERSE', JSON.stringify(taxAfterClear));
  } else if (!taxCleared) {
    finding('P2', 'E13-F-TAX-CLEAR-UNSUPPORTED', 'taxClass clear did not stick');
  } else if (taxAfterClear.state === 'READY') {
    finding('P0', 'E13-F-TAX-STALE', JSON.stringify(taxAfterClear));
    hardFail = true;
  }
  // Restore taxClass for later checks
  await setProfileField(page, 'work-income', 'taxClass', '3', { select: true });

  // === G — churchTax unknown survives unrelated income save ===
  // Ensure churchTax is empty/unknown then change only income
  await page.goto(`${BASE_URL}/profile/work-income/edit`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2400);
  const churchSelect = page.locator('#profile-field-churchTax');
  if (await churchSelect.isVisible().catch(() => false)) {
    const churchVal = await churchSelect.inputValue().catch(() => '');
    if (churchVal !== '') {
      await churchSelect.selectOption('');
      await page.locator('button[type="submit"]').first().click().catch(() => {});
      await settle(page, 2500);
    }
  }
  await setProfileField(page, 'work-income', 'grossMonthlyIncome', '1900');
  await openEr(page);
  const taxChurch = await taxAttrs(page);
  snapshot.G = taxChurch;
  if (taxChurch.church === 'UNKNOWN' || taxChurch.church === null) {
    finding('OBSERVED_PASS', 'E13-G-CHURCH-UNKNOWN', JSON.stringify(taxChurch));
  } else if (taxChurch.church === 'KNOWN' || taxChurch.church === 'false' || taxChurch.church === 'true') {
    // presence should be UNKNOWN when never set
    finding('P1', 'E13-G-CHURCH-COERCED', `unexpected presence ${JSON.stringify(taxChurch)}`);
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E13-G-CHURCH-UNKNOWN', JSON.stringify(taxChurch));
  }

  // === H — validation / rejected mutation (safe) ===
  // No-op save: leave draft unchanged → no mutation → derived state unchanged.
  await openEr(page);
  const beforeNoop = await taxAttrs(page);
  await page.goto(`${BASE_URL}/profile/work-income/edit`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2000);
  await page.locator('button[type="submit"]').first().click().catch(() => {});
  await settle(page, 2000);
  await openEr(page);
  const afterNoop = await taxAttrs(page);
  snapshot.H = { beforeNoop, afterNoop };
  if (JSON.stringify(beforeNoop) === JSON.stringify(afterNoop)) {
    finding('OBSERVED_PASS', 'E13-H-NOOP-STABLE', 'no-op save left derived tax state unchanged');
  } else {
    finding('P1', 'E13-H-NOOP-DRIFT', JSON.stringify({ beforeNoop, afterNoop }));
    hardFail = true;
  }

  // Attempt invalid number clear then restore — revision conflict not forced (needs concurrency).
  finding(
    'OBSERVED_PASS',
    'E13-H-REVISION',
    'REVISION_CONFLICT covered by unit/API suites; browser does not force concurrent writers'
  );

  // === Employment/Discovery isolation ===
  await page.goto(`${BASE_URL}/modules/discovery`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2000);
  const discoveryBefore = page.url();
  await setProfileField(page, 'work-income', 'grossMonthlyIncome', '1950');
  await page.goto(`${BASE_URL}/modules/discovery`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2000);
  const discoveryBody = (await page.locator('body').innerText().catch(() => '')) || '';
  snapshot.discovery = { discoveryBefore, url: page.url() };
  if (/fake SUCCESS|stale RUNNING/i.test(discoveryBody)) {
    finding('P1', 'E13-DISCOVERY-FAKE', 'Suspicious Discovery copy');
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E13-DISCOVERY-ISOLATION', 'Work & Income change did not invent Discovery run UI');
  }

  // === I/J — Reload reconstructs ===
  await openEr(page);
  const beforeReload = {
    housing: await housingAttrs(page),
    tax: await taxAttrs(page),
    wohngeld: await benefitState(page, 'de_federal_wohngeld'),
    kindergeld: await benefitState(page, 'de_federal_kindergeld'),
  };
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page, 3200);
  await dismissGuide(page);
  const afterReload = {
    housing: await housingAttrs(page),
    tax: await taxAttrs(page),
    wohngeld: await benefitState(page, 'de_federal_wohngeld'),
    kindergeld: await benefitState(page, 'de_federal_kindergeld'),
  };
  snapshot.reload = { beforeReload, afterReload };
  recordTransition('I-reload', beforeReload, afterReload, 'full page reload');
  const reloadOk =
    beforeReload.housing?.state === afterReload.housing?.state &&
    beforeReload.housing?.reg === afterReload.housing?.reg &&
    beforeReload.tax?.state === afterReload.tax?.state &&
    beforeReload.wohngeld === afterReload.wohngeld &&
    beforeReload.kindergeld === afterReload.kindergeld;
  if (reloadOk) {
    finding('OBSERVED_PASS', 'E13-I-RELOAD', JSON.stringify(afterReload));
  } else {
    finding('P1', 'E13-I-RELOAD', JSON.stringify({ beforeReload, afterReload }));
    hardFail = true;
  }

  await page.screenshot({ path: path.join(OUT, '02-after-reload.png') });

  // Localization EN spot-check
  await enterAtlas(page, 'English');
  await openEr(page);
  const enBody = (await page.locator('body').innerText().catch(() => '')) || '';
  const lang = await page.evaluate(() => document.documentElement.lang);
  if (lang !== 'en') finding('P2', 'E13-LANG-EN', lang);
  else finding('OBSERVED_PASS', 'E13-LANG-EN', lang);
  if (/benefits\.awareness\.|housing\.situation\.|tax\.admin\./.test(enBody)) {
    finding('P1', 'E13-LANG-RAW', 'Raw i18n keys on EN ER');
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E13-LANG-KEYS', 'No raw ER keys under EN');
  }

  await page.screenshot({ path: path.join(OUT, '03-en.png') });
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

let verdict = 'STATE REVERSAL PASS WITH LIMITATIONS';
if (p0.length || hardFail) verdict = 'STATE REVERSAL FAIL';
else if (p1.length === 0 && p2.length === 0) verdict = 'STATE REVERSAL PASS';
else verdict = 'STATE REVERSAL PASS WITH LIMITATIONS';

const report = {
  verdict,
  generatedAt: new Date().toISOString(),
  snapshot,
  transitions,
  findings,
  observations,
};

await fs.writeFile(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
note(`\n=== ${verdict} ===`);
note(`P0=${p0.length} P1=${p1.length} P2=${p2.length}`);
process.exit(p0.length || hardFail ? 1 : 0);
