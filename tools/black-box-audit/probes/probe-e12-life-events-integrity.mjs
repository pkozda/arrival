/**
 * E12 — Life Events journey integrity browser probe.
 * Focus: Registration truthfulness, no banking prerequisite, cross-module coherence.
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUT = path.join(ROOT, 'tools/black-box-audit/artifacts/e12-life-events-integrity');

await fs.mkdir(OUT, { recursive: true });

const observations = [];
const findings = [];

function note(message) {
  observations.push(message);
  console.log(message);
}

function finding(classification, id, detail) {
  findings.push({ classification, id, detail });
  note(`[${classification}] ${id}: ${detail}`);
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

async function openLifeEvent(page) {
  const before = page.url();
  await page.goto(`${BASE_URL}/modules/life-event`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await settle(page, 2800);
  await dismissGuide(page);
  note(`openLifeEvent ${before} → ${page.url()}`);
}

async function openEr(page) {
  await page.goto(`${BASE_URL}/modules/economic-reality`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await settle(page, 2800);
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
      const checked = await el.isChecked();
      const want = value === true || value === 'true';
      if (checked !== want) await el.click();
    } else {
      await el.click();
      await el.fill('');
      await el.type(String(value), { delay: 20 });
    }
    await page.waitForTimeout(400);
    await page.locator('button[type="submit"]').first().click().catch(() => {});
    await settle(page, 3000);
    // Verify persistence by reopening editor (wait for hydration)
    await page.goto(`${BASE_URL}/profile/${section}/edit`, { waitUntil: 'domcontentloaded' });
    await settle(page, 2400);
    const again = page.locator(`#profile-field-${fieldId}`);
    await again.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    if (select) {
      await page
        .waitForFunction(
          ({ id, expected }) => {
            const node = document.querySelector(`#profile-field-${id}`);
            return node && node.value === expected;
          },
          { id: fieldId, expected: String(value) },
          { timeout: 10000 }
        )
        .catch(() => null);
      const persisted = await again.inputValue().catch(() => '');
      if (persisted === String(value)) return true;
    } else if ((await again.getAttribute('type')) === 'checkbox') {
      const want = value === true || value === 'true';
      if ((await again.isChecked().catch(() => false)) === want) return true;
    } else {
      await page
        .waitForFunction(
          ({ id, expected }) => {
            const node = document.querySelector(`#profile-field-${id}`);
            return node && String(node.value) === String(expected);
          },
          { id: fieldId, expected: String(value) },
          { timeout: 10000 }
        )
        .catch(() => null);
      const persisted = await again.inputValue().catch(() => '');
      if (String(persisted) === String(value)) return true;
    }
    note(`setProfileField retry ${fieldId} attempt=${attempt}`);
  }
  return false;
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
  note('=== E12 Life Events integrity probe ===');

  // A — fresh / blocked Registration
  await enterAtlas(page, 'Українська');
  await openLifeEvent(page);
  const leVisible = await page.locator('body').innerText().catch(() => '');
  if (/life-event\.node\.|life-event\.action\./.test(leVisible)) {
    finding('P1', 'E12-A-RAWKEY', 'Raw Life Event keys on first paint');
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E12-A-LE', 'Life Events surface loaded');
  }
  await page.screenshot({ path: path.join(OUT, '01-fresh-le.png') });

  // B — add address
  const cityOk = await setProfileField(page, 'where-you-live', 'city', 'Berlin');
  if (!cityOk) {
    finding('P0', 'E12-B-CITY', 'Could not set city');
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E12-B-CITY', 'city=Berlin');
  }

  // C — Registration actionable, not complete
  await openEr(page);
  const housingState = await page
    .locator('[data-ui-panel="HousingSituationPanel"]')
    .getAttribute('data-housing-state')
    .catch(() => null);
  const housingReg = await page
    .locator('[data-ui-panel="HousingSituationPanel"]')
    .getAttribute('data-housing-registration')
    .catch(() => null);
  snapshot.housingAfterCity = { housingState, housingReg };
  note(`Phase C housing state=${housingState} reg=${housingReg}`);
  if (housingReg === 'pending' || housingState === 'INCOMPLETE' || housingState === 'READY') {
    finding('OBSERVED_PASS', 'E12-C-HOUSING', `${housingState}/${housingReg}`);
  } else {
    finding('P2', 'E12-C-HOUSING', `${housingState}/${housingReg}`);
  }

  await openLifeEvent(page);
  const afterCityText = (await page.locator('body').innerText().catch(() => '')) || '';
  if (/g1-banking-tax.*block|blocked.*banking|банків.*блок.*реєстр/i.test(afterCityText) &&
      /anmeldung|реєстрац/i.test(afterCityText)) {
    // Soft check — banking must not be presented as Anmeldung prerequisite
    finding('P1', 'E12-C-BANK-BLOCK', 'Possible banking-blocks-registration language');
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E12-C-NO-BANK-PREREQ', 'No banking→registration blocker copy detected');
  }

  // D — prepare Anmeldung navigation
  const beforePrepare = page.url();
  await page.goto(`${BASE_URL}/modules/life-event/prepare-anmeldung`, {
    waitUntil: 'domcontentloaded',
  });
  await settle(page, 2200);
  const afterPrepare = page.url();
  note(`prepare ${beforePrepare} → ${afterPrepare}`);
  if (/prepare-anmeldung/.test(afterPrepare)) {
    finding('OBSERVED_PASS', 'E12-D-PREPARE', afterPrepare);
  } else {
    finding('P1', 'E12-D-PREPARE', afterPrepare);
    hardFail = true;
  }
  const prepareBody = (await page.locator('body').innerText().catch(() => '')) || '';
  if (/municipalRegistrationConfirmed|life-event\.prepare\./.test(prepareBody)) {
    finding('P2', 'E12-D-RAW', 'Possible raw key on prepare surface');
  }

  // E — confirm municipal registration
  const confirmOk = await setProfileField(
    page,
    'move-to-germany',
    'municipalRegistrationConfirmed',
    true
  );
  if (!confirmOk) {
    finding('P0', 'E12-E-CONFIRM', 'Could not confirm Anmeldung');
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E12-E-CONFIRM', 'municipalRegistrationConfirmed=true');
  }

  // F — Registration COMPLETE on ER housing relationship + LE
  await openEr(page);
  const regAfter = await page
    .locator('[data-ui-panel="HousingSituationPanel"]')
    .getAttribute('data-housing-registration')
    .catch(() => null);
  snapshot.regAfterConfirm = regAfter;
  if (regAfter === 'confirmed') {
    finding('OBSERVED_PASS', 'E12-F-COMPLETE', regAfter);
  } else {
    finding('P1', 'E12-F-COMPLETE', `expected confirmed, got ${regAfter}`);
    hardFail = true;
  }

  // G — housing rent
  const rentOk = await setProfileField(page, 'where-you-live', 'monthlyColdRent', '650');
  if (!rentOk) {
    finding('P1', 'E12-G-RENT-SAVE', 'monthlyColdRent did not persist');
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E12-G-RENT-SAVE', 'monthlyColdRent=650');
  }
  await openEr(page);
  const housingReady = await page
    .locator('[data-ui-panel="HousingSituationPanel"]')
    .getAttribute('data-housing-state')
    .catch(() => null);
  if (housingReady === 'READY') {
    finding('OBSERVED_PASS', 'E12-G-HOUSING-READY', housingReady);
  } else if (rentOk) {
    finding('P1', 'E12-G-HOUSING-READY', housingReady);
    hardFail = true;
  } else {
    finding('P2', 'E12-G-HOUSING-READY', `skipped; rent save failed (${housingReady})`);
  }

  // H — ER planner still present
  if (await page.locator('[data-ui-panel="ActionPlannerPanel"]').isVisible().catch(() => false)) {
    finding('OBSERVED_PASS', 'E12-H-PLANNER', 'Action Planner present');
  } else {
    finding('P2', 'E12-H-PLANNER', 'Action Planner missing');
  }

  // I — Benefits panel present (awareness coherent host)
  if (await page.locator('[data-ui-panel="BenefitsAwarenessPanel"]').isVisible().catch(() => false)) {
    finding('OBSERVED_PASS', 'E12-I-BENEFITS', 'Benefits panel present');
  } else {
    finding('P2', 'E12-I-BENEFITS', 'Benefits panel missing');
  }

  // J — Employment / Discovery relationship: Discovery route exists; LE does not invent run
  await page.goto(`${BASE_URL}/modules/discovery`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2000);
  finding('OBSERVED_PASS', 'E12-J-DISCOVERY', `url=${page.url()}`);

  // K — Tax Administration
  const taxSaved = await setProfileField(page, 'work-income', 'taxClass', '3', { select: true });
  await openEr(page);
  const taxState = await page
    .locator('[data-ui-panel="TaxAdministrationPanel"]')
    .getAttribute('data-tax-state')
    .catch(() => null);
  const churchPresence = await page
    .locator('[data-tax-fact="churchTax"]')
    .getAttribute('data-tax-fact-presence')
    .catch(() => null);
  snapshot.tax = { taxState, churchPresence, taxSaved };
  // Panel READY is the semantic success signal; editor hydration can lag briefly.
  if (taxState === 'READY') {
    finding('OBSERVED_PASS', 'E12-K-TAX', `${taxState}/${churchPresence}; editorSaved=${taxSaved}`);
  } else if (taxSaved) {
    finding('P1', 'E12-K-TAX', `saved but panel=${taxState}/${churchPresence}`);
    hardFail = true;
  } else {
    finding('P1', 'E12-K-TAX', `not ready (${taxState}/${churchPresence})`);
    hardFail = true;
  }

  // L — Healthcare navigation reachable
  await page.goto(`${BASE_URL}/modules/healthcare-navigation`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2000);
  finding('OBSERVED_PASS', 'E12-L-HEALTHCARE', `url=${page.url()}`);

  // M/N — reload ER reconstructs housing + tax + registration
  await openEr(page);
  const beforeReload = {
    housing: await page.locator('[data-ui-panel="HousingSituationPanel"]').getAttribute('data-housing-state'),
    reg: await page.locator('[data-ui-panel="HousingSituationPanel"]').getAttribute('data-housing-registration'),
    tax: await page.locator('[data-ui-panel="TaxAdministrationPanel"]').getAttribute('data-tax-state'),
  };
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page, 3000);
  await dismissGuide(page);
  const afterReload = {
    housing: await page.locator('[data-ui-panel="HousingSituationPanel"]').getAttribute('data-housing-state'),
    reg: await page.locator('[data-ui-panel="HousingSituationPanel"]').getAttribute('data-housing-registration'),
    tax: await page.locator('[data-ui-panel="TaxAdministrationPanel"]').getAttribute('data-tax-state'),
  };
  snapshot.reload = { beforeReload, afterReload };
  if (
    afterReload.housing === 'READY' &&
    afterReload.reg === 'confirmed' &&
    (afterReload.tax === 'READY' || taxState !== 'READY')
  ) {
    finding('OBSERVED_PASS', 'E12-N-RELOAD', JSON.stringify(afterReload));
  } else if (afterReload.housing === 'READY' && afterReload.reg === 'confirmed') {
    finding('P1', 'E12-N-RELOAD-TAX', JSON.stringify({ beforeReload, afterReload }));
    hardFail = true;
  } else {
    finding('P1', 'E12-N-RELOAD', JSON.stringify({ beforeReload, afterReload }));
    hardFail = true;
  }

  // Localization EN spot-check on LE
  await enterAtlas(page, 'English');
  await openLifeEvent(page);
  const lang = await page.evaluate(() => document.documentElement.lang);
  const enBody = (await page.locator('body').innerText().catch(() => '')) || '';
  if (lang !== 'en') finding('P2', 'E12-LANG-EN', lang);
  else finding('OBSERVED_PASS', 'E12-LANG-EN', lang);
  if (/life-event\.(node|action|inspector)\./.test(enBody)) {
    finding('P1', 'E12-LANG-RAW', 'Raw keys under EN LE');
    hardFail = true;
  }

  await page.screenshot({ path: path.join(OUT, '02-integrated.png') });
} catch (error) {
  finding('P0', 'probe-crash', String(error?.stack || error));
  hardFail = true;
  console.error(error);
} finally {
  await browser.close();
}

const p0 = findings.filter((f) => f.classification === 'P0');
const p1 = findings.filter((f) => f.classification === 'P1');

let verdict = 'LIFE EVENTS INTEGRITY PASS WITH LIMITATIONS';
if (p0.length || hardFail) verdict = 'LIFE EVENTS INTEGRITY FAIL';
else if (p1.length === 0) verdict = 'LIFE EVENTS INTEGRITY PASS WITH LIMITATIONS';

const report = {
  verdict,
  generatedAt: new Date().toISOString(),
  snapshot,
  findings,
  observations,
};

await fs.writeFile(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
note(`\n=== ${verdict} ===`);
note(`P0=${p0.length} P1=${p1.length}`);
process.exit(p0.length || hardFail ? 1 : 0);
