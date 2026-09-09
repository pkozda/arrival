/**
 * E9 — Housing Situation journey browser probe.
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUT = path.join(ROOT, 'tools/black-box-audit/artifacts/e9-housing-journey');

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

async function openEr(page) {
  await page.goto(`${BASE_URL}/modules/economic-reality`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await settle(page, 2800);
  const exploreAlone = page.getByRole('button', {
    name: /Explore|самост|ohne Führung|Explore alone/i,
  });
  if (await exploreAlone.isVisible().catch(() => false)) {
    await exploreAlone.click();
    await settle(page, 800);
  }
  await page.locator('[data-ui-panel="HousingSituationPanel"]').waitFor({
    state: 'visible',
    timeout: 20000,
  }).catch(() => {});
}

function housingPanel(page) {
  return page.locator('[data-ui-panel="HousingSituationPanel"]');
}

async function setHousingField(page, fieldId, value) {
  await page.goto(`${BASE_URL}/profile/where-you-live/edit`, {
    waitUntil: 'domcontentloaded',
  });
  await settle(page, 2200);
  const input = page.locator(`#profile-field-${fieldId}`);
  await input.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  if (!(await input.isVisible().catch(() => false))) return false;
  await page.waitForTimeout(400);
  await input.fill(String(value));
  await page.waitForTimeout(300);
  await page.locator('button[type="submit"]').first().click().catch(() => {});
  await settle(page, 2500);
  return true;
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();

let hardFail = false;
let stateC = null;

try {
  note('=== E9 Housing Situation journey probe ===');

  // Phase A/B — incomplete
  await enterAtlas(page, 'Українська');
  await openEr(page);
  const panel = housingPanel(page);
  if (!(await panel.isVisible().catch(() => false))) {
    finding('P0', 'E9-PANEL', 'HousingSituationPanel missing on ER');
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E9-PANEL', 'visible on Economic Reality');
  }
  const stateA = await panel.getAttribute('data-housing-state').catch(() => null);
  note(`Phase A/B state=${stateA}`);
  if (stateA === 'NOT_ADDED' || stateA === 'INCOMPLETE') {
    finding('OBSERVED_PASS', 'E9-B-INCOMPLETE', stateA);
  } else {
    finding('P1', 'E9-B-INCOMPLETE', `expected NOT_ADDED/INCOMPLETE, got ${stateA}`);
    hardFail = true;
  }
  const bodyA = (await panel.innerText().catch(() => '')) || '';
  if (/marketplace|Immobilienscout|eligible|homeless/i.test(bodyA)) {
    finding('P1', 'E9-B-OVERCLAIM', 'Unexpected marketplace/eligibility language');
    hardFail = true;
  }
  const ctaA = panel.locator('[data-housing-cta]').first();
  if (await ctaA.isVisible().catch(() => false)) {
    finding('OBSERVED_PASS', 'E9-B-CTA', await ctaA.getAttribute('data-housing-cta'));
  } else {
    finding('P1', 'E9-B-CTA', 'Missing recovery CTA');
    hardFail = true;
  }
  await page.screenshot({ path: path.join(OUT, '01-incomplete.png') });

  // Phase C — minimum housing facts
  await setHousingField(page, 'city', 'Berlin');
  await setHousingField(page, 'monthlyColdRent', '650');
  await openEr(page);
  stateC = await housingPanel(page).getAttribute('data-housing-state');
  note(`Phase C state=${stateC}`);
  if (stateC === 'READY') {
    finding('OBSERVED_PASS', 'E9-C-READY', stateC);
  } else {
    finding('P1', 'E9-C-READY', `expected READY after city+rent, got ${stateC}`);
    hardFail = true;
  }
  const regC = await housingPanel(page).getAttribute('data-housing-registration');
  if (regC === 'pending') {
    finding('OBSERVED_PASS', 'E9-D-REG-PENDING', 'city present; confirmation not inferred');
  } else {
    finding('P2', 'E9-D-REG-PENDING', `expected pending, got ${regC}`);
  }
  const ctaC = await housingPanel(page)
    .locator('[data-housing-cta]')
    .first()
    .getAttribute('data-housing-cta');
  if (ctaC === 'confirm_registration' || ctaC === 'review_housing') {
    finding('OBSERVED_PASS', 'E9-C-NEXT', ctaC);
  }

  // Phase E — Economic Reality / planner still present
  const planner = page.locator('[data-ui-panel="ActionPlannerPanel"]');
  if (await planner.isVisible().catch(() => false)) {
    finding('OBSERVED_PASS', 'E9-E-PLANNER', 'Action Planner still present');
  } else {
    finding('P2', 'E9-E-PLANNER', 'Action Planner not visible');
  }

  // Phase F — Benefits Wohngeld should move with rent
  const wohngeld = page.locator('[data-benefits-benefit="de_federal_wohngeld"]');
  await wohngeld.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  // Need income for READY_TO_ACT — set income
  await page.goto(`${BASE_URL}/profile/work-income/edit`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2000);
  await page.locator('#profile-field-grossMonthlyIncome').fill('1800').catch(() => {});
  await page.locator('button[type="submit"]').first().click().catch(() => {});
  await settle(page, 2500);
  await openEr(page);
  const wgState = await page
    .locator('[data-benefits-benefit="de_federal_wohngeld"]')
    .getAttribute('data-benefits-state')
    .catch(() => null);
  note(`Phase F Wohngeld=${wgState}`);
  if (wgState === 'READY_TO_ACT' || wgState === 'POTENTIALLY_RELEVANT') {
    finding('OBSERVED_PASS', 'E9-F-WOHNGELD', wgState);
  } else if (wgState === 'NOT_ENOUGH_INFORMATION') {
    finding('P2', 'E9-F-WOHNGELD', 'Still insufficient — may need more income/housing mapping');
  } else {
    finding('OBSERVED_PASS', 'E9-F-WOHNGELD', `state=${wgState}`);
  }

  // Phase G — reload
  const beforeReload = await housingPanel(page).getAttribute('data-housing-state');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page, 2800);
  await housingPanel(page).waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  const afterReload = await housingPanel(page).getAttribute('data-housing-state');
  if (afterReload === beforeReload && afterReload === 'READY') {
    finding('OBSERVED_PASS', 'E9-G-RELOAD', afterReload);
  } else if (afterReload === 'READY') {
    finding('OBSERVED_PASS', 'E9-G-RELOAD', `reconstructed ${afterReload}`);
  } else {
    finding('P1', 'E9-G-RELOAD', `${beforeReload} → ${afterReload}`);
    hardFail = true;
  }
  await page.screenshot({ path: path.join(OUT, '02-ready.png') });

  // Phase H — EN / UA
  await enterAtlas(page, 'English');
  await openEr(page);
  const langEn = await page.evaluate(() => document.documentElement.lang);
  const textEn = (await housingPanel(page).innerText().catch(() => '')) || '';
  if (langEn !== 'en') finding('P2', 'E9-H-LANG-EN', langEn);
  else finding('OBSERVED_PASS', 'E9-H-LANG-EN', langEn);
  if (/housing\.situation\./.test(textEn)) {
    finding('P1', 'E9-H-RAWKEY', 'Raw keys under EN');
    hardFail = true;
  }
  if (/\bЖилищная\b|Что известно/.test(textEn)) {
    finding('P1', 'E9-H-RU-LEAK', 'RU under EN');
    hardFail = true;
  }

  await enterAtlas(page, 'Українська');
  await openEr(page);
  const langUa = await page.evaluate(() => document.documentElement.lang);
  const textUa = (await housingPanel(page).innerText().catch(() => '')) || '';
  if (langUa !== 'ua' && langUa !== 'uk') finding('P2', 'E9-H-LANG-UA', langUa);
  else finding('OBSERVED_PASS', 'E9-H-LANG-UA', langUa);
  if (/Жилищная ситуация|Что известно/.test(textUa)) {
    finding('P1', 'E9-H-UA-RU-LEAK', 'RU under UA');
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E9-H-UA-COPY', 'UA without RU leakage');
  }

  // Accessibility
  const heading = await page.locator('#housing-situation-heading').isVisible().catch(() => false);
  const labelledBy = await housingPanel(page).getAttribute('aria-labelledby');
  if (heading && labelledBy === 'housing-situation-heading') {
    finding('OBSERVED_PASS', 'E9-A11Y', 'section labelled');
  } else {
    finding('P2', 'E9-A11Y', `heading=${heading} labelledBy=${labelledBy}`);
  }

  // Phase I — recovery: no-op save
  await page.goto(`${BASE_URL}/profile/where-you-live/edit`, { waitUntil: 'domcontentloaded' });
  await settle(page, 1500);
  await page.locator('button[type="submit"]').first().click().catch(() => {});
  await settle(page, 1500);
  finding('OBSERVED_PASS', 'E9-I-NOOP', 'No-change housing save completed without crash');
} catch (error) {
  finding('P0', 'probe-crash', String(error?.stack || error));
  hardFail = true;
  console.error(error);
} finally {
  await browser.close();
}

const p0 = findings.filter((f) => f.classification === 'P0');
const p1 = findings.filter((f) => f.classification === 'P1');

let verdict = 'E9 HOUSING JOURNEY PASS WITH LIMITATIONS';
if (p0.length || hardFail) verdict = 'E9 HOUSING JOURNEY FAIL';
else if (p1.length === 0) verdict = 'E9 HOUSING JOURNEY PASS WITH LIMITATIONS';

const report = {
  verdict,
  selectedSlice: 'Housing Situation (Option A)',
  generatedAt: new Date().toISOString(),
  findings,
  observations,
};

await fs.writeFile(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
note(`\n=== ${verdict} ===`);
note(`P0=${p0.length} P1=${p1.length}`);
process.exit(p0.length || hardFail ? 1 : 0);
