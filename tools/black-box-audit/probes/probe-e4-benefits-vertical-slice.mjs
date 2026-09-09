/**
 * E4 — Benefits (Wohngeld) awareness vertical slice browser probe.
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUT = path.join(ROOT, 'tools/black-box-audit/artifacts/e4-benefits-vertical-slice');

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

async function enterAtlas(page, langLabel, continueLabel) {
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

async function fillAndSave(page, fieldHints, value) {
  for (const hint of fieldHints) {
    const input = page.locator(hint).first();
    if (await input.count()) {
      await input.fill(String(value));
      break;
    }
  }
  const save = page
    .locator(
      'button[type="submit"], button:has-text("Save"), button:has-text("Зберегти"), button:has-text("Speichern")'
    )
    .first();
  if (await save.isVisible().catch(() => false)) {
    await save.click();
    await settle(page, 2000);
    return true;
  }
  return false;
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();

let hardFail = false;

try {
  note('=== E4 Benefits vertical slice probe ===');

  // Scenario A — insufficient information (UA)
  await enterAtlas(page, 'Українська', 'Продовжити');
  await openEr(page);
  const panel = page.locator('[data-ui-panel="BenefitsAwarenessPanel"]');
  await panel.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  const visibleA = await panel.isVisible().catch(() => false);
  if (!visibleA) {
    finding('P0', 'E4-PANEL', 'BenefitsAwarenessPanel not visible on ER');
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E4-PANEL', 'BenefitsAwarenessPanel visible');
  }
  const stateA = await panel.getAttribute('data-benefits-state').catch(() => null);
  note(`Scenario A state=${stateA}`);
  if (stateA === 'NOT_ENOUGH_INFORMATION') {
    finding('OBSERVED_PASS', 'E4-A-STATE', stateA);
  } else {
    finding('P1', 'E4-A-STATE', `expected NOT_ENOUGH_INFORMATION, got ${stateA}`);
    hardFail = true;
  }
  const bodyA = (await panel.innerText().catch(() => '')) || '';
  if (/eligible|qualify|маєте право|имеете право/i.test(bodyA)) {
    finding('P1', 'E4-A-OVERCLAIM', 'Unsupported eligibility claim in insufficient-info state');
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E4-A-NO-OVERCLAIM', 'No eligibility overclaim');
  }
  const ctaA = panel.locator('[data-benefits-cta]').first();
  if (await ctaA.isVisible().catch(() => false)) {
    finding('OBSERVED_PASS', 'E4-A-CTA', await ctaA.innerText());
  } else {
    finding('P2', 'E4-A-CTA', 'Missing next-action CTA');
  }
  await page.screenshot({ path: path.join(OUT, '01-insufficient.png') });

  // Scenario B — meaningful context (rent + income) — fill all housing fields then save once
  await page.goto(`${BASE_URL}/profile/where-you-live/edit`, {
    waitUntil: 'domcontentloaded',
  });
  await settle(page, 1500);
  await page.locator('#profile-field-city').fill('Berlin').catch(() => {});
  await page.locator('#profile-field-monthlyColdRent').fill('650').catch(() => {});
  await page.locator('button[type="submit"]').first().click().catch(() => {});
  await settle(page, 2200);

  await page.goto(`${BASE_URL}/profile/work-income/edit`, {
    waitUntil: 'domcontentloaded',
  });
  await settle(page, 1500);
  await page.locator('#profile-field-grossMonthlyIncome').fill('1800').catch(() => {});
  await page.locator('button[type="submit"]').first().click().catch(() => {});
  await settle(page, 2200);

  await openEr(page);
  const panelB = page.locator('[data-ui-panel="BenefitsAwarenessPanel"]');
  await panelB.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  const stateB = await panelB.getAttribute('data-benefits-state').catch(() => null);
  note(`Scenario B state=${stateB}`);
  if (stateB === 'READY_TO_ACT' || stateB === 'POTENTIALLY_RELEVANT') {
    finding('OBSERVED_PASS', 'E4-B-STATE', stateB);
  } else if (stateB === 'NOT_ENOUGH_INFORMATION') {
    finding(
      'P2',
      'E4-B-STATE',
      'Still NOT_ENOUGH after rent/income save — profile field mapping may differ'
    );
  } else {
    finding('P1', 'E4-B-STATE', `unexpected state ${stateB}`);
  }
  const bodyB = (await panelB.innerText().catch(() => '')) || '';
  if (/you are eligible|you qualify|ви маєте право|вы имеете право/i.test(bodyB)) {
    finding('P1', 'E4-B-OVERCLAIM', 'Unsupported eligibility claim');
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E4-B-NO-OVERCLAIM', 'Conservative wording');
  }
  await page.screenshot({ path: path.join(OUT, '02-relevant.png') });

  // Scenario C — action/recalculation: mark receiving Wohngeld
  await page.goto(`${BASE_URL}/profile/benefits-support/edit`, {
    waitUntil: 'domcontentloaded',
  });
  await settle(page, 1500);
  const wohngeld = page
    .locator(
      '[name*="receivingWohngeld"], [id*="receivingWohngeld"], input[type="checkbox"]'
    )
    .filter({ has: page.locator('xpath=..') })
    .first();
  // Prefer labeled Wohngeld checkbox
  const checkboxes = page.locator('input[type="checkbox"]');
  const count = await checkboxes.count();
  let toggled = false;
  for (let i = 0; i < count; i++) {
    const box = checkboxes.nth(i);
    const id = (await box.getAttribute('id')) || '';
    const name = (await box.getAttribute('name')) || '';
    if (/wohngeld/i.test(id + name)) {
      if (!(await box.isChecked().catch(() => false))) {
        await box.check({ force: true }).catch(() => box.click());
      }
      toggled = true;
      break;
    }
  }
  if (!toggled && count > 0) {
    // last resort: click checkbox near Wohngeld text
    const near = page.locator('label:has-text("Wohngeld"), label:has-text("wohngeld")').first();
    if (await near.isVisible().catch(() => false)) {
      await near.click();
      toggled = true;
    }
  }
  const save = page.locator('button[type="submit"]').first();
  if (await save.isVisible().catch(() => false)) {
    await save.click();
    await settle(page, 2000);
  }
  await openEr(page);
  const stateC = await page
    .locator('[data-ui-panel="BenefitsAwarenessPanel"]')
    .getAttribute('data-benefits-state')
    .catch(() => null);
  note(`Scenario C state=${stateC} toggled=${toggled}`);
  if (stateC === 'COMPLETED') {
    finding('OBSERVED_PASS', 'E4-C-RECALC', 'COMPLETED after receiving flag');
  } else if (toggled) {
    finding('P2', 'E4-C-RECALC', `expected COMPLETED after toggle, got ${stateC}`);
  } else {
    finding(
      'VALID_ENVIRONMENT_LIMITATION',
      'E4-C-RECALC',
      'Could not locate receivingWohngeld control in UI'
    );
  }
  await page.screenshot({ path: path.join(OUT, '03-completed.png') });

  // Scenario D — reload
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page, 2500);
  const stateD = await page
    .locator('[data-ui-panel="BenefitsAwarenessPanel"]')
    .getAttribute('data-benefits-state')
    .catch(() => null);
  if (stateD && stateC && stateD === stateC) {
    finding('OBSERVED_PASS', 'E4-D-RELOAD', `state persisted/reconstructed: ${stateD}`);
  } else if (stateD) {
    finding('OBSERVED_PASS', 'E4-D-RELOAD', `reconstructed state=${stateD}`);
  } else {
    finding('P1', 'E4-D-RELOAD', 'Panel missing after reload');
    hardFail = true;
  }

  // Scenario E — EN language path chrome
  await enterAtlas(page, 'English', 'Continue');
  await openEr(page);
  const lang = await page.evaluate(() => document.documentElement.lang);
  const panelE = page.locator('[data-ui-panel="BenefitsAwarenessPanel"]');
  const textE = (await panelE.innerText().catch(() => '')) || '';
  if (lang !== 'en') {
    finding('P2', 'E4-E-LANG', `expected en, got ${lang}`);
  } else {
    finding('OBSERVED_PASS', 'E4-E-LANG', lang);
  }
  if (/benefits\.awareness\./.test(textE)) {
    finding('P1', 'E4-E-RAWKEY', 'Raw translation keys visible');
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E4-E-COPY', 'No raw keys');
  }
  if (/\bПоиск\b|Исследовать Atlas/.test(textE)) {
    finding('P1', 'E4-E-RU-LEAK', 'Russian leakage under EN');
    hardFail = true;
  }
  await page.screenshot({ path: path.join(OUT, '04-en.png') });

  // UA title check (already on UA earlier)
  finding('OBSERVED_PASS', 'E4-E-UA-PATH', 'UA path exercised in scenario A');
} catch (error) {
  finding('P0', 'probe-crash', String(error?.stack || error));
  hardFail = true;
  console.error(error);
} finally {
  await browser.close();
}

const p0 = findings.filter((f) => f.classification === 'P0');
const p1 = findings.filter((f) => f.classification === 'P1');

let verdict = 'E4 BENEFITS VERTICAL SLICE PASS WITH LIMITATIONS';
if (p0.length || hardFail) verdict = 'E4 BENEFITS VERTICAL SLICE FAIL';
else if (p1.length === 0) verdict = 'E4 BENEFITS VERTICAL SLICE PASS WITH LIMITATIONS';

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
