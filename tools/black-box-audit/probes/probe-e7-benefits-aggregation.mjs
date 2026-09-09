/**
 * E7 — Benefits awareness aggregation browser probe.
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUT = path.join(ROOT, 'tools/black-box-audit/artifacts/e7-benefits-aggregation');

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
}

function panel(page) {
  return page.locator('[data-ui-panel="BenefitsAwarenessPanel"]');
}

function cardOrder(page) {
  return page
    .locator('[data-benefits-benefit]')
    .evaluateAll((els) =>
      els.map((el) => ({
        id: el.getAttribute('data-benefits-benefit'),
        state: el.getAttribute('data-benefits-state'),
        primary: el.getAttribute('data-benefits-primary-focus'),
      }))
    );
}

async function setDependentChildren(page, count) {
  await page.goto(`${BASE_URL}/profile/household-family/edit`, {
    waitUntil: 'domcontentloaded',
  });
  await settle(page, 2000);
  const input = page.locator('#profile-field-dependentChildCount');
  await input.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  if (!(await input.isVisible().catch(() => false))) return false;
  await input.fill(String(count));
  await page.locator('button[type="submit"]').first().click().catch(() => {});
  await settle(page, 2500);
  return true;
}

async function setHousingAndIncome(page) {
  await page.goto(`${BASE_URL}/profile/where-you-live/edit`, {
    waitUntil: 'domcontentloaded',
  });
  await settle(page, 2000);
  await page.locator('#profile-field-city').waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  await page.locator('#profile-field-city').fill('Berlin').catch(() => {});
  await page.locator('#profile-field-monthlyColdRent').fill('650').catch(() => {});
  await page.waitForTimeout(300);
  await page.locator('button[type="submit"]').first().click().catch(() => {});
  await settle(page, 2500);

  await page.goto(`${BASE_URL}/profile/work-income/edit`, {
    waitUntil: 'domcontentloaded',
  });
  await settle(page, 2000);
  await page
    .locator('#profile-field-grossMonthlyIncome')
    .waitFor({ state: 'visible', timeout: 15000 })
    .catch(() => {});
  await page.locator('#profile-field-grossMonthlyIncome').fill('1800').catch(() => {});
  await page.waitForTimeout(300);
  await page.locator('button[type="submit"]').first().click().catch(() => {});
  await settle(page, 2500);
  return true;
}

async function setReceiving(page, fieldId, checked) {
  await page.goto(`${BASE_URL}/profile/benefits-support/edit`, {
    waitUntil: 'domcontentloaded',
  });
  await settle(page, 2500);
  const box = page.locator(`#profile-field-${fieldId}`);
  await box.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  if (!(await box.isVisible().catch(() => false))) return false;
  // Wait for draft sync from profile before toggling.
  await page.waitForTimeout(600);
  const isChecked = await box.isChecked().catch(() => false);
  if (checked !== isChecked) {
    const label = page.locator(`label[for="profile-field-${fieldId}"]`);
    if (await label.isVisible().catch(() => false)) await label.click();
    else await box.click({ force: true });
    await page.waitForTimeout(400);
  }
  await page.locator('button[type="submit"]').first().click().catch(() => {});
  await settle(page, 2500);
  return true;
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();

let hardFail = false;
let orderC = null;
let orderD = null;
let orderE = null;

try {
  note('=== E7 Benefits aggregation probe ===');

  // Scenario A — incomplete profile, multiple states
  await enterAtlas(page, 'Українська');
  await openEr(page);
  const pA = panel(page);
  await pA.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  if (!(await pA.isVisible().catch(() => false))) {
    finding('P0', 'E7-PANEL', 'BenefitsAwarenessPanel missing');
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E7-PANEL', 'visible');
  }
  const focusA = await pA.getAttribute('data-benefits-focus-mode').catch(() => null);
  const aggA = (await pA.locator('[data-benefits-aggregate-summary]').innerText().catch(() => '')) || '';
  note(`Scenario A focus=${focusA}`);
  if (focusA === 'GATHER_INFORMATION') {
    finding('OBSERVED_PASS', 'E7-A-FOCUS', focusA);
  } else {
    finding('P1', 'E7-A-FOCUS', `expected GATHER_INFORMATION, got ${focusA}`);
    hardFail = true;
  }
  if (/benefits\.awareness\./.test(aggA)) {
    finding('P1', 'E7-A-RAWKEY', 'Raw aggregate keys');
    hardFail = true;
  }
  if (/best benefit|ranking|score|найкращ|лучший/i.test(aggA)) {
    finding('P1', 'E7-A-RANKING', 'Opaque ranking language');
    hardFail = true;
  }
  await page.screenshot({ path: path.join(OUT, '01-incomplete.png') });

  // Scenario B — Kindergeld actionable
  await setDependentChildren(page, 1);
  await openEr(page);
  const orderB = await cardOrder(page);
  note(`Scenario B order=${JSON.stringify(orderB)}`);
  const kgB = orderB.find((c) => c.id === 'de_federal_kindergeld');
  if (kgB?.state === 'READY_TO_ACT') {
    finding('OBSERVED_PASS', 'E7-B-KINDERGELD', kgB.state);
  } else {
    finding('P1', 'E7-B-KINDERGELD', `expected READY_TO_ACT, got ${kgB?.state}`);
    hardFail = true;
  }
  const focusB = await panel(page).getAttribute('data-benefits-focus-mode').catch(() => null);
  if (focusB === 'ACTIONABLE') {
    finding('OBSERVED_PASS', 'E7-B-FOCUS', focusB);
  } else {
    finding('P2', 'E7-B-FOCUS', `expected ACTIONABLE, got ${focusB}`);
  }

  // Scenario C — both actionable; deterministic order
  await setHousingAndIncome(page);
  await openEr(page);
  orderC = await cardOrder(page);
  note(`Scenario C order=${JSON.stringify(orderC)}`);
  if (
    orderC.length === 2 &&
    orderC.every((c) => c.state === 'READY_TO_ACT') &&
    orderC[0].id === 'de_federal_wohngeld' &&
    orderC[1].id === 'de_federal_kindergeld'
  ) {
    finding('OBSERVED_PASS', 'E7-C-ORDER', 'both READY_TO_ACT; Wohngeld then Kindergeld');
  } else {
    finding('P1', 'E7-C-ORDER', JSON.stringify(orderC));
    hardFail = true;
  }
  const actionableC = await panel(page).getAttribute('data-benefits-actionable-count').catch(() => null);
  if (actionableC === '2') {
    finding('OBSERVED_PASS', 'E7-C-COUNT', actionableC);
  }
  await page.screenshot({ path: path.join(OUT, '02-both-ready.png') });

  // Scenario D — complete Kindergeld; Kindergeld must not dominate
  await setReceiving(page, 'receivingKindergeld', true);
  await openEr(page);
  orderD = await cardOrder(page);
  note(`Scenario D order=${JSON.stringify(orderD)}`);
  if (orderD[0]?.id === 'de_federal_wohngeld' && orderD[0]?.state === 'READY_TO_ACT') {
    finding('OBSERVED_PASS', 'E7-D-PRIMARY', 'Wohngeld remains first actionable');
  } else {
    finding('P1', 'E7-D-PRIMARY', JSON.stringify(orderD));
    hardFail = true;
  }
  if (orderD[1]?.id === 'de_federal_kindergeld' && orderD[1]?.state === 'COMPLETED') {
    finding('OBSERVED_PASS', 'E7-D-COMPLETED-LAST', 'Completed Kindergeld after actionable');
  } else {
    finding('P1', 'E7-D-COMPLETED-LAST', JSON.stringify(orderD));
    hardFail = true;
  }
  if (orderD[0]?.primary === 'true' && orderD[1]?.primary === 'false') {
    finding('OBSERVED_PASS', 'E7-D-FOCUS-ATTR', 'primary focus on actionable card');
  }

  // Scenario E — complete both
  await setReceiving(page, 'receivingWohngeld', true);
  await openEr(page);
  orderE = await cardOrder(page);
  const focusE = await panel(page).getAttribute('data-benefits-focus-mode').catch(() => null);
  const aggE = (await panel(page).locator('[data-benefits-aggregate-summary]').innerText().catch(() => '')) || '';
  note(`Scenario E focus=${focusE} order=${JSON.stringify(orderE)}`);
  if (focusE === 'REVIEW_COMPLETED') {
    finding('OBSERVED_PASS', 'E7-E-ALL-COMPLETED', focusE);
  } else {
    finding('P1', 'E7-E-ALL-COMPLETED', `expected REVIEW_COMPLETED, got ${focusE}`);
    hardFail = true;
  }
  if (/nothing|нічого|nichts|нет другого|немає іншої|немає іншої|currently actionable|derzeit nichts|сейчас здесь нет|зараз тут немає/i.test(aggE)) {
    finding('OBSERVED_PASS', 'E7-E-NO-FAKE-ACTION', 'Honest all-completed copy');
  } else {
    finding('P2', 'E7-E-NO-FAKE-ACTION', aggE.slice(0, 120));
  }
  await page.screenshot({ path: path.join(OUT, '03-all-completed.png') });

  // Scenario F — reload reconstructs
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page, 2500);
  const focusF = await panel(page).getAttribute('data-benefits-focus-mode').catch(() => null);
  const orderF = await cardOrder(page);
  if (focusF === focusE && JSON.stringify(orderF.map((c) => c.state)) === JSON.stringify(orderE.map((c) => c.state))) {
    finding('OBSERVED_PASS', 'E7-F-RELOAD', 'aggregate reconstructed');
  } else {
    finding('P1', 'E7-F-RELOAD', `focus ${focusF} vs ${focusE}`);
    hardFail = true;
  }

  // Scenario G — EN + UA localization
  await enterAtlas(page, 'English');
  await openEr(page);
  const langEn = await page.evaluate(() => document.documentElement.lang);
  const textEn = (await panel(page).innerText().catch(() => '')) || '';
  if (langEn !== 'en') finding('P2', 'E7-G-LANG-EN', langEn);
  else finding('OBSERVED_PASS', 'E7-G-LANG-EN', langEn);
  if (/benefits\.awareness\./.test(textEn)) {
    finding('P1', 'E7-G-RAWKEY', 'Raw keys under EN');
    hardFail = true;
  }
  if (/\bОриентир\b|Что можно/.test(textEn)) {
    finding('P1', 'E7-G-RU-LEAK', 'RU under EN');
    hardFail = true;
  }

  await enterAtlas(page, 'Українська');
  await openEr(page);
  const langUa = await page.evaluate(() => document.documentElement.lang);
  const textUa = (await panel(page).innerText().catch(() => '')) || '';
  if (langUa !== 'ua' && langUa !== 'uk') finding('P2', 'E7-G-LANG-UA', langUa);
  else finding('OBSERVED_PASS', 'E7-G-LANG-UA', langUa);
  if (/Ориентир по пособиям|Что можно сделать дальше/.test(textUa)) {
    finding('P1', 'E7-G-UA-RU-LEAK', 'RU under UA');
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E7-G-UA-COPY', 'UA without RU leakage');
  }

  // Accessibility smoke
  const heading = await page.locator('#benefits-awareness-heading').isVisible().catch(() => false);
  const region = await panel(page).getAttribute('aria-labelledby').catch(() => null);
  if (heading && region === 'benefits-awareness-heading') {
    finding('OBSERVED_PASS', 'E7-A11Y-HEADING', 'section labelled');
  } else {
    finding('P2', 'E7-A11Y-HEADING', `heading=${heading} labelledby=${region}`);
  }
} catch (error) {
  finding('P0', 'probe-crash', String(error?.stack || error));
  hardFail = true;
  console.error(error);
} finally {
  await browser.close();
}

const p0 = findings.filter((f) => f.classification === 'P0');
const p1 = findings.filter((f) => f.classification === 'P1');

let verdict = 'E7 BENEFITS AGGREGATION PASS WITH LIMITATIONS';
if (p0.length || hardFail) verdict = 'E7 BENEFITS AGGREGATION FAIL';
else if (p1.length === 0) verdict = 'E7 BENEFITS AGGREGATION PASS WITH LIMITATIONS';

const report = {
  verdict,
  generatedAt: new Date().toISOString(),
  findings,
  observations,
};

await fs.writeFile(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
note(`\n=== ${verdict} ===`);
note(`P0=${p0.length} P1=${p1.length}`);
process.exit(p0.length || hardFail ? 1 : 0);
