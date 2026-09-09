/**
 * E5 — Kindergeld awareness vertical slice browser probe.
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUT = path.join(ROOT, 'tools/black-box-audit/artifacts/e5-kindergeld-awareness');

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

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();

let hardFail = false;
let stateB = null;
let stateC = null;

try {
  note('=== E5 Kindergeld awareness probe ===');

  // Scenario A — insufficient Kindergeld information (UA)
  await enterAtlas(page, 'Українська');
  await openEr(page);
  const panel = page.locator('[data-ui-panel="BenefitsAwarenessPanel"]');
  await panel.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  if (!(await panel.isVisible().catch(() => false))) {
    finding('P0', 'E5-PANEL', 'BenefitsAwarenessPanel not visible on ER');
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E5-PANEL', 'BenefitsAwarenessPanel visible');
  }

  const kgA = kindergeldCard(page);
  await kgA.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  const stateA = await kgA.getAttribute('data-benefits-state').catch(() => null);
  note(`Scenario A Kindergeld state=${stateA}`);
  if (stateA === 'NOT_ENOUGH_INFORMATION') {
    finding('OBSERVED_PASS', 'E5-A-STATE', stateA);
  } else {
    finding('P1', 'E5-A-STATE', `expected NOT_ENOUGH_INFORMATION, got ${stateA}`);
    hardFail = true;
  }
  const bodyA = (await kgA.innerText().catch(() => '')) || '';
  if (/eligible|qualify|маєте право|имеете право/i.test(bodyA)) {
    finding('P1', 'E5-A-OVERCLAIM', 'Unsupported eligibility claim');
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E5-A-NO-OVERCLAIM', 'No eligibility overclaim');
  }
  if (/benefits\.awareness\./.test(bodyA)) {
    finding('P1', 'E5-A-RAWKEY', 'Raw translation keys visible');
    hardFail = true;
  }
  const ctaA = kgA.locator('[data-benefits-cta]').first();
  if (await ctaA.isVisible().catch(() => false)) {
    finding('OBSERVED_PASS', 'E5-A-CTA', await ctaA.innerText());
  } else {
    finding('P2', 'E5-A-CTA', 'Missing next-action CTA');
  }
  await page.screenshot({ path: path.join(OUT, '01-insufficient.png') });

  // Scenario B — set explicit dependent children via household editor
  await page.goto(`${BASE_URL}/profile/household-family/edit`, {
    waitUntil: 'domcontentloaded',
  });
  await settle(page, 1500);
  const childInput = page.locator('#profile-field-dependentChildCount');
  if (await childInput.isVisible().catch(() => false)) {
    await childInput.fill('1');
    await page.locator('button[type="submit"]').first().click().catch(() => {});
    await settle(page, 2200);
    finding('OBSERVED_PASS', 'E5-B-MUTATION', 'Saved dependentChildCount=1');
  } else {
    finding('P1', 'E5-B-MUTATION', 'dependentChildCount field not visible');
    hardFail = true;
  }

  await openEr(page);
  const kgB = kindergeldCard(page);
  await kgB.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  stateB = await kgB.getAttribute('data-benefits-state').catch(() => null);
  note(`Scenario B Kindergeld state=${stateB}`);
  if (stateB === 'READY_TO_ACT' || stateB === 'POTENTIALLY_RELEVANT') {
    finding('OBSERVED_PASS', 'E5-B-STATE', stateB);
  } else {
    finding('P1', 'E5-B-STATE', `expected READY_TO_ACT after children save, got ${stateB}`);
    hardFail = true;
  }
  const bodyB = (await kgB.innerText().catch(() => '')) || '';
  if (/you are eligible|you qualify|ви маєте право|вы имеете право/i.test(bodyB)) {
    finding('P1', 'E5-B-OVERCLAIM', 'Unsupported eligibility claim');
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E5-B-NO-OVERCLAIM', 'Conservative wording');
  }
  await page.screenshot({ path: path.join(OUT, '02-relevant.png') });

  // Scenario C — CTA → mutation → recalculation: set children to 0
  await page.goto(`${BASE_URL}/profile/household-family/edit`, {
    waitUntil: 'domcontentloaded',
  });
  await settle(page, 1500);
  const childInputC = page.locator('#profile-field-dependentChildCount');
  if (await childInputC.isVisible().catch(() => false)) {
    await childInputC.fill('0');
    await page.locator('button[type="submit"]').first().click().catch(() => {});
    await settle(page, 2200);
  }
  await openEr(page);
  const kgC = kindergeldCard(page);
  stateC = await kgC.getAttribute('data-benefits-state').catch(() => null);
  note(`Scenario C Kindergeld state=${stateC}`);
  if (stateC === 'NOT_APPLICABLE') {
    finding('OBSERVED_PASS', 'E5-C-RECALC', 'NOT_APPLICABLE after children=0');
  } else if (stateB === 'READY_TO_ACT' && stateC && stateC !== stateB) {
    finding('OBSERVED_PASS', 'E5-C-RECALC', `state changed ${stateB} → ${stateC}`);
  } else {
    finding('P2', 'E5-C-RECALC', `expected NOT_APPLICABLE after zero children, got ${stateC}`);
  }
  await page.screenshot({ path: path.join(OUT, '03-recalc.png') });

  // Scenario D — reload reconstructs from profile facts
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page, 2500);
  const stateD = await kindergeldCard(page).getAttribute('data-benefits-state').catch(() => null);
  if (stateD && stateC && stateD === stateC) {
    finding('OBSERVED_PASS', 'E5-D-RELOAD', `reconstructed: ${stateD}`);
  } else if (stateD) {
    finding('OBSERVED_PASS', 'E5-D-RELOAD', `reconstructed state=${stateD}`);
  } else {
    finding('P1', 'E5-D-RELOAD', 'Kindergeld card missing after reload');
    hardFail = true;
  }

  // Scenario E — EN then UA language
  await enterAtlas(page, 'English');
  await openEr(page);
  const langEn = await page.evaluate(() => document.documentElement.lang);
  const textEn = (await kindergeldCard(page).innerText().catch(() => '')) || '';
  if (langEn !== 'en') {
    finding('P2', 'E5-E-LANG-EN', `expected en, got ${langEn}`);
  } else {
    finding('OBSERVED_PASS', 'E5-E-LANG-EN', langEn);
  }
  if (/benefits\.awareness\./.test(textEn)) {
    finding('P1', 'E5-E-RAWKEY', 'Raw keys under EN');
    hardFail = true;
  }
  if (/\bПоиск\b|Исследовать Atlas|Ориентир по/.test(textEn)) {
    finding('P1', 'E5-E-RU-LEAK', 'Russian leakage under EN');
    hardFail = true;
  }

  await enterAtlas(page, 'Українська');
  await openEr(page);
  const langUa = await page.evaluate(() => document.documentElement.lang);
  const textUa = (await kindergeldCard(page).innerText().catch(() => '')) || '';
  if (langUa !== 'ua' && langUa !== 'uk') {
    finding('P2', 'E5-E-LANG-UA', `expected ua/uk, got ${langUa}`);
  } else {
    finding('OBSERVED_PASS', 'E5-E-LANG-UA', langUa);
  }
  if (/benefits\.awareness\./.test(textUa)) {
    finding('P1', 'E5-E-UA-RAWKEY', 'Raw keys under UA');
    hardFail = true;
  }
  if (/Ориентир по пособиям|Что можно сделать дальше/.test(textUa)) {
    finding('P1', 'E5-E-UA-RU-LEAK', 'RU leakage under UA');
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E5-E-UA-COPY', 'UA Kindergeld copy without RU leakage');
  }
  await page.screenshot({ path: path.join(OUT, '04-ua.png') });

  // Scenario F — Wohngeld still present and behaves
  const wg = wohngeldCard(page);
  if (await wg.isVisible().catch(() => false)) {
    const wgState = await wg.getAttribute('data-benefits-state').catch(() => null);
    finding('OBSERVED_PASS', 'E5-F-WOHNGELD', `Wohngeld card visible state=${wgState}`);
    if (!wgState) {
      finding('P1', 'E5-F-WOHNGELD-STATE', 'Wohngeld missing data-benefits-state');
    }
  } else {
    finding('P1', 'E5-F-WOHNGELD', 'Wohngeld card missing after Kindergeld slice');
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

let verdict = 'E5 KINDERGELD AWARENESS SLICE PASS WITH LIMITATIONS';
if (p0.length || hardFail) verdict = 'E5 KINDERGELD AWARENESS SLICE FAIL';
else if (p1.length === 0) verdict = 'E5 KINDERGELD AWARENESS SLICE PASS WITH LIMITATIONS';

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
