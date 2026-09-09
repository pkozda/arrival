/**
 * E6 — Kindergeld completion fact browser probe.
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUT = path.join(ROOT, 'tools/black-box-audit/artifacts/e6-kindergeld-completion');

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

function kindergeldCard(page) {
  return page.locator('[data-benefits-benefit="de_federal_kindergeld"]');
}

function wohngeldCard(page) {
  return page.locator('[data-benefits-benefit="de_federal_wohngeld"]');
}

async function setDependentChildren(page, count) {
  await page.goto(`${BASE_URL}/profile/household-family/edit`, {
    waitUntil: 'domcontentloaded',
  });
  await settle(page, 2000);
  const input = page.locator('#profile-field-dependentChildCount');
  await input.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  if (!(await input.isVisible().catch(() => false))) {
    return false;
  }
  await input.fill(String(count));
  await page.locator('button[type="submit"]').first().click().catch(() => {});
  await settle(page, 2500);
  return true;
}

async function setReceivingKindergeld(page, checked) {
  await page.goto(`${BASE_URL}/profile/benefits-support/edit`, {
    waitUntil: 'domcontentloaded',
  });
  await settle(page, 2000);
  const box = page.locator('#profile-field-receivingKindergeld');
  await box.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  if (!(await box.count()) || !(await box.isVisible().catch(() => false))) {
    return false;
  }
  const isChecked = await box.isChecked().catch(() => false);
  if (checked !== isChecked) {
    // Controlled React checkbox: prefer label click so onChange fires reliably.
    const label = page.locator('label[for="profile-field-receivingKindergeld"]');
    if (await label.isVisible().catch(() => false)) {
      await label.click();
    } else {
      await box.click({ force: true });
    }
    await page.waitForTimeout(500);
  }
  const after = await box.isChecked().catch(() => false);
  if (after !== checked) {
    return false;
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
let stateA = null;
let stateB = null;
let stateD = null;

try {
  note('=== E6 Kindergeld completion probe ===');

  // Scenario A — awareness only (children, receiving unknown)
  await enterAtlas(page, 'Українська');
  const childrenOk = await setDependentChildren(page, 1);
  if (!childrenOk) {
    finding('P1', 'E6-A-CHILDREN', 'dependentChildCount field missing');
    hardFail = true;
  }
  await openEr(page);
  const kgA = kindergeldCard(page);
  await kgA.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  stateA = await kgA.getAttribute('data-benefits-state').catch(() => null);
  note(`Scenario A Kindergeld state=${stateA}`);
  if (stateA === 'READY_TO_ACT' || stateA === 'POTENTIALLY_RELEVANT') {
    finding('OBSERVED_PASS', 'E6-A-AWARENESS', stateA);
  } else {
    finding('P1', 'E6-A-AWARENESS', `expected awareness-only READY_TO_ACT, got ${stateA}`);
    hardFail = true;
  }
  if (stateA === 'COMPLETED') {
    finding('P0', 'E6-A-FALSE-COMPLETED', 'COMPLETED without receivingKindergeld');
    hardFail = true;
  }
  const bodyA = (await kgA.innerText().catch(() => '')) || '';
  if (/eligible|qualify|маєте право|имеете право/i.test(bodyA)) {
    finding('P1', 'E6-A-OVERCLAIM', 'Unsupported eligibility claim');
    hardFail = true;
  }
  await page.screenshot({ path: path.join(OUT, '01-awareness.png') });

  // Scenario B — confirm receipt → COMPLETED
  const toggled = await setReceivingKindergeld(page, true);
  if (!toggled) {
    finding('P1', 'E6-B-FIELD', 'receivingKindergeld checkbox missing');
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E6-B-MUTATION', 'Saved receivingKindergeld=true');
  }
  await openEr(page);
  stateB = await kindergeldCard(page).getAttribute('data-benefits-state').catch(() => null);
  note(`Scenario B Kindergeld state=${stateB}`);
  if (stateB === 'COMPLETED') {
    finding('OBSERVED_PASS', 'E6-B-COMPLETED', stateB);
  } else {
    finding('P1', 'E6-B-COMPLETED', `expected COMPLETED after confirm, got ${stateB}`);
    hardFail = true;
  }
  const bodyB = (await kindergeldCard(page).innerText().catch(() => '')) || '';
  if (/authority confirmed|офіційно підтверд|официально подтверд/i.test(bodyB)) {
    finding('P1', 'E6-B-OVERCLAIM', 'Implies authority verification');
    hardFail = true;
  }
  const applyCta = kindergeldCard(page).locator('[data-benefits-cta="open_official_source"]');
  if (await applyCta.isVisible().catch(() => false)) {
    finding('P2', 'E6-B-APPLY-CTA', 'Official apply CTA still shown in COMPLETED');
  } else {
    finding('OBSERVED_PASS', 'E6-B-NO-APPLY', 'No open_official_source CTA in COMPLETED');
  }
  await page.screenshot({ path: path.join(OUT, '02-completed.png') });

  // Scenario C — reload
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page, 2500);
  const stateC = await kindergeldCard(page).getAttribute('data-benefits-state').catch(() => null);
  if (stateC === 'COMPLETED') {
    finding('OBSERVED_PASS', 'E6-C-RELOAD', 'COMPLETED reconstructed after reload');
  } else {
    finding('P1', 'E6-C-RELOAD', `expected COMPLETED after reload, got ${stateC}`);
    hardFail = true;
  }

  // Scenario D — revoke → normal awareness
  const revoked = await setReceivingKindergeld(page, false);
  if (!revoked) {
    finding('P1', 'E6-D-MUTATION', 'Could not uncheck/save receivingKindergeld=false');
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E6-D-MUTATION', 'Saved receivingKindergeld=false');
  }
  await openEr(page);
  stateD = await kindergeldCard(page).getAttribute('data-benefits-state').catch(() => null);
  note(`Scenario D Kindergeld state=${stateD}`);
  if (stateD && stateD !== 'COMPLETED' && (stateD === 'READY_TO_ACT' || stateD === stateA)) {
    finding('OBSERVED_PASS', 'E6-D-REVOKE', `${stateB} → ${stateD}`);
  } else if (stateD === 'COMPLETED') {
    finding('P1', 'E6-D-REVOKE', 'Stale COMPLETED after receivingKindergeld=false');
    hardFail = true;
  } else {
    finding('P2', 'E6-D-REVOKE', `unexpected post-revoke state ${stateD}`);
  }
  await page.screenshot({ path: path.join(OUT, '03-revoked.png') });

  // Scenario E — EN language
  await enterAtlas(page, 'English');
  await setDependentChildren(page, 1);
  await setReceivingKindergeld(page, true);
  await openEr(page);
  const langEn = await page.evaluate(() => document.documentElement.lang);
  const textEn = (await kindergeldCard(page).innerText().catch(() => '')) || '';
  const stateEn = await kindergeldCard(page).getAttribute('data-benefits-state').catch(() => null);
  if (langEn !== 'en') {
    finding('P2', 'E6-E-LANG-EN', `expected en, got ${langEn}`);
  } else {
    finding('OBSERVED_PASS', 'E6-E-LANG-EN', langEn);
  }
  if (stateEn !== 'COMPLETED') {
    finding('P1', 'E6-E-EN-COMPLETED', `expected COMPLETED under EN, got ${stateEn}`);
    hardFail = true;
  }
  if (/benefits\.awareness\.|profile\.fields\./.test(textEn)) {
    finding('P1', 'E6-E-RAWKEY', 'Raw keys under EN');
    hardFail = true;
  }
  if (/\bПоиск\b|Ориентир по/.test(textEn)) {
    finding('P1', 'E6-E-RU-LEAK', 'Russian leakage under EN');
    hardFail = true;
  }

  // UA language check (path already used in A)
  await enterAtlas(page, 'Українська');
  await openEr(page);
  const langUa = await page.evaluate(() => document.documentElement.lang);
  const textUa = (await kindergeldCard(page).innerText().catch(() => '')) || '';
  if (langUa !== 'ua' && langUa !== 'uk') {
    finding('P2', 'E6-E-LANG-UA', `expected ua/uk, got ${langUa}`);
  } else {
    finding('OBSERVED_PASS', 'E6-E-LANG-UA', langUa);
  }
  if (/Ориентир по пособиям|Что можно сделать дальше/.test(textUa)) {
    finding('P1', 'E6-E-UA-RU-LEAK', 'RU leakage under UA');
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E6-E-UA-COPY', 'UA without RU leakage');
  }
  await page.screenshot({ path: path.join(OUT, '04-lang.png') });

  // Scenario F — Wohngeld still present
  const wg = wohngeldCard(page);
  if (await wg.isVisible().catch(() => false)) {
    const wgState = await wg.getAttribute('data-benefits-state').catch(() => null);
    finding('OBSERVED_PASS', 'E6-F-WOHNGELD', `Wohngeld visible state=${wgState}`);
  } else {
    finding('P1', 'E6-F-WOHNGELD', 'Wohngeld card missing');
    hardFail = true;
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

let verdict = 'E6 KINDERGELD COMPLETION SLICE PASS WITH LIMITATIONS';
if (p0.length || hardFail) verdict = 'E6 KINDERGELD COMPLETION SLICE FAIL';
else if (p1.length === 0) verdict = 'E6 KINDERGELD COMPLETION SLICE PASS WITH LIMITATIONS';

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
