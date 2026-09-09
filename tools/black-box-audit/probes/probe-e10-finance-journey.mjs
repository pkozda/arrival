/**
 * E10 — Finance journey (Tax Administration Option C) browser probe.
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUT = path.join(ROOT, 'tools/black-box-audit/artifacts/e10-finance-journey');

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
  await page.locator('[data-ui-panel="TaxAdministrationPanel"]').waitFor({
    state: 'visible',
    timeout: 20000,
  }).catch(() => {});
}

function taxPanel(page) {
  return page.locator('[data-ui-panel="TaxAdministrationPanel"]');
}

async function setTaxClass(page, value) {
  await page.goto(`${BASE_URL}/profile/work-income/edit`, {
    waitUntil: 'domcontentloaded',
  });
  await settle(page, 2200);
  const select = page.locator('#profile-field-taxClass');
  await select.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  if (!(await select.isVisible().catch(() => false))) return false;
  await select.selectOption(String(value));
  await page.waitForTimeout(300);
  await page.locator('button[type="submit"]').first().click().catch(() => {});
  await settle(page, 2500);
  return true;
}

async function openWorkIncomeEdit(page) {
  await page.goto(`${BASE_URL}/profile/work-income/edit`, {
    waitUntil: 'domcontentloaded',
  });
  await settle(page, 2200);
  await page.locator('#profile-field-churchTax').waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
}

async function readChurchTaxSelect(page) {
  return page.locator('#profile-field-churchTax').inputValue().catch(() => null);
}

async function setChurchTaxSelect(page, value) {
  await openWorkIncomeEdit(page);
  const select = page.locator('#profile-field-churchTax');
  if (!(await select.isVisible().catch(() => false))) return false;
  await select.selectOption(String(value));
  await page.waitForTimeout(300);
  await page.locator('button[type="submit"]').first().click().catch(() => {});
  await settle(page, 2500);
  return true;
}

async function setIncomeOnly(page, value) {
  await openWorkIncomeEdit(page);
  const income = page.locator('#profile-field-grossMonthlyIncome');
  if (!(await income.isVisible().catch(() => false))) return false;
  await income.fill(String(value));
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

try {
  note('=== E10 Finance Tax Administration journey probe ===');

  // Phase A — initial / unknown
  await enterAtlas(page, 'Українська');
  await openEr(page);
  const panel = taxPanel(page);
  if (!(await panel.isVisible().catch(() => false))) {
    finding('P0', 'E10-PANEL', 'TaxAdministrationPanel missing on ER');
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E10-PANEL', 'visible on Economic Reality');
  }

  const slice = await panel.getAttribute('data-finance-slice').catch(() => null);
  if (slice === 'tax-administration') {
    finding('OBSERVED_PASS', 'E10-SLICE', slice);
  } else {
    finding('P1', 'E10-SLICE', `expected tax-administration, got ${slice}`);
    hardFail = true;
  }

  const stateA = await panel.getAttribute('data-tax-state').catch(() => null);
  note(`Phase A state=${stateA}`);
  if (stateA === 'NOT_ADDED' || stateA === 'INCOMPLETE') {
    finding('OBSERVED_PASS', 'E10-A-UNKNOWN', stateA);
  } else {
    finding('P1', 'E10-A-UNKNOWN', `expected NOT_ADDED/INCOMPLETE, got ${stateA}`);
    hardFail = true;
  }

  const bodyA = (await panel.innerText().catch(() => '')) || '';
  if (/IBAN|budget|eligible|marketplace|open a bank|банківськ.*готовий/i.test(bodyA) &&
      !/not available|nicht verfügbar|недоступн/i.test(bodyA)) {
    finding('P1', 'E10-A-OVERCLAIM', 'Unexpected banking/budget/eligibility claim');
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E10-A-NO-BANKING-CLAIM', 'banking deferred note present or no overclaim');
  }

  const bankingNote = panel.locator('[data-tax-banking-note]');
  if (await bankingNote.isVisible().catch(() => false)) {
    finding('OBSERVED_PASS', 'E10-A-BANKING-DEFERRED', 'explicit banking deferred note');
  } else {
    finding('P1', 'E10-A-BANKING-DEFERRED', 'missing banking deferred note');
    hardFail = true;
  }

  const ctaA = panel.locator('[data-tax-cta]').first();
  if (await ctaA.isVisible().catch(() => false)) {
    finding('OBSERVED_PASS', 'E10-A-CTA', await ctaA.getAttribute('data-tax-cta'));
  } else {
    finding('P1', 'E10-A-CTA', 'Missing recovery CTA');
    hardFail = true;
  }
  await page.screenshot({ path: path.join(OUT, '01-not-added.png') });

  // Phase B — enrichment via work-income mutation
  const saved = await setTaxClass(page, '3');
  if (!saved) {
    finding('P0', 'E10-B-MUTATION', 'Could not set taxClass on work-income edit');
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E10-B-MUTATION', 'taxClass=3 saved');
  }

  // Phase C — recalculation on ER
  await openEr(page);
  const stateC = await taxPanel(page).getAttribute('data-tax-state');
  note(`Phase C state=${stateC}`);
  if (stateC === 'READY') {
    finding('OBSERVED_PASS', 'E10-C-READY', stateC);
  } else {
    finding('P1', 'E10-C-READY', `expected READY after taxClass, got ${stateC}`);
    hardFail = true;
  }

  const factClass = taxPanel(page).locator('[data-tax-fact="taxClass"]');
  const presence = await factClass.getAttribute('data-tax-fact-presence').catch(() => null);
  const factText = (await factClass.innerText().catch(() => '')) || '';
  if (presence === 'KNOWN' && /3/.test(factText)) {
    finding('OBSERVED_PASS', 'E10-C-FACT', factText.trim());
  } else {
    finding('P1', 'E10-C-FACT', `presence=${presence} text=${factText}`);
    hardFail = true;
  }

  const ctaC = await taxPanel(page).locator('[data-tax-cta]').first().getAttribute('data-tax-cta');
  if (ctaC === 'review_tax_details') {
    finding('OBSERVED_PASS', 'E10-C-NEXT', ctaC);
  } else {
    finding('P2', 'E10-C-NEXT', `got ${ctaC}`);
  }

  // Phase T — churchTax tri-state semantic hardening
  note('=== churchTax tri-state hardening ===');

  // A — taxClass known + churchTax unknown
  const churchPresenceA = await taxPanel(page)
    .locator('[data-tax-fact="churchTax"]')
    .getAttribute('data-tax-fact-presence');
  if (churchPresenceA === 'UNKNOWN' && (await taxPanel(page).getAttribute('data-tax-state')) === 'READY') {
    finding('OBSERVED_PASS', 'E10-T-A-UNKNOWN', 'taxClass READY; churchTax UNKNOWN');
  } else {
    finding('P1', 'E10-T-A-UNKNOWN', `church=${churchPresenceA} state=${await taxPanel(page).getAttribute('data-tax-state')}`);
    hardFail = true;
  }

  await openWorkIncomeEdit(page);
  const editorTag = await page.locator('#profile-field-churchTax').evaluate((el) => el.tagName).catch(() => null);
  const editorValue = await readChurchTaxSelect(page);
  if (editorTag === 'SELECT' && (editorValue === '' || editorValue === null)) {
    finding('OBSERVED_PASS', 'E10-T-A-EDITOR', `select value="${editorValue}"`);
  } else {
    finding('P1', 'E10-T-A-EDITOR', `tag=${editorTag} value=${editorValue}`);
    hardFail = true;
  }

  // B/C — unrelated income save must preserve churchTax unknown
  const incomeOk = await setIncomeOnly(page, '2100');
  if (!incomeOk) {
    finding('P0', 'E10-T-B-INCOME', 'Could not save unrelated income');
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E10-T-B-INCOME', 'unrelated income saved');
  }
  await openEr(page);
  const churchPresenceC = await taxPanel(page)
    .locator('[data-tax-fact="churchTax"]')
    .getAttribute('data-tax-fact-presence');
  const stateC2 = await taxPanel(page).getAttribute('data-tax-state');
  if (churchPresenceC === 'UNKNOWN' && stateC2 === 'READY') {
    finding('OBSERVED_PASS', 'E10-T-C-PRESERVED', 'churchTax still UNKNOWN after unrelated save');
  } else {
    finding('P1', 'E10-T-C-PRESERVED', `church=${churchPresenceC} state=${stateC2}`);
    hardFail = true;
  }
  await openWorkIncomeEdit(page);
  const afterUnrelated = await readChurchTaxSelect(page);
  if (afterUnrelated === '') {
    finding('OBSERVED_PASS', 'E10-T-C-EDITOR', 'editor still Not specified');
  } else {
    finding('P1', 'E10-T-C-EDITOR', `editor value=${afterUnrelated}`);
    hardFail = true;
  }

  // D/E — explicit true + reload
  if (!(await setChurchTaxSelect(page, 'true'))) {
    finding('P0', 'E10-T-D-TRUE', 'Could not set churchTax=true');
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E10-T-D-TRUE', 'churchTax=true saved');
  }
  await openEr(page);
  const churchTrue = await taxPanel(page)
    .locator('[data-tax-fact="churchTax"]')
    .getAttribute('data-tax-fact-presence');
  if (churchTrue === 'KNOWN' && (await taxPanel(page).getAttribute('data-tax-state')) === 'READY') {
    finding('OBSERVED_PASS', 'E10-T-D-PANEL', 'KNOWN + READY');
  } else {
    finding('P1', 'E10-T-D-PANEL', `presence=${churchTrue}`);
    hardFail = true;
  }
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page, 2800);
  await taxPanel(page).waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  const churchTrueReload = await taxPanel(page)
    .locator('[data-tax-fact="churchTax"]')
    .getAttribute('data-tax-fact-presence');
  await openWorkIncomeEdit(page);
  const editorTrue = await readChurchTaxSelect(page);
  if (churchTrueReload === 'KNOWN' && editorTrue === 'true') {
    finding('OBSERVED_PASS', 'E10-T-E-RELOAD-TRUE', editorTrue);
  } else {
    finding('P1', 'E10-T-E-RELOAD-TRUE', `panel=${churchTrueReload} editor=${editorTrue}`);
    hardFail = true;
  }

  // F/G — explicit false + reload
  if (!(await setChurchTaxSelect(page, 'false'))) {
    finding('P0', 'E10-T-F-FALSE', 'Could not set churchTax=false');
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E10-T-F-FALSE', 'churchTax=false saved');
  }
  await openEr(page);
  const churchFalse = await taxPanel(page)
    .locator('[data-tax-fact="churchTax"]')
    .getAttribute('data-tax-fact-presence');
  if (churchFalse === 'KNOWN' && (await taxPanel(page).getAttribute('data-tax-state')) === 'READY') {
    finding('OBSERVED_PASS', 'E10-T-F-PANEL', 'KNOWN + READY');
  } else {
    finding('P1', 'E10-T-F-PANEL', `presence=${churchFalse}`);
    hardFail = true;
  }
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page, 2800);
  await taxPanel(page).waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  await openWorkIncomeEdit(page);
  const editorFalse = await readChurchTaxSelect(page);
  if (editorFalse === 'false') {
    finding('OBSERVED_PASS', 'E10-T-G-RELOAD-FALSE', editorFalse);
  } else {
    finding('P1', 'E10-T-G-RELOAD-FALSE', `editor=${editorFalse}`);
    hardFail = true;
  }

  // H/I — Tax Admin + sibling panels
  await openEr(page);
  if ((await taxPanel(page).getAttribute('data-tax-state')) === 'READY') {
    finding('OBSERVED_PASS', 'E10-T-H-STATE', 'READY after false');
  } else {
    finding('P1', 'E10-T-H-STATE', await taxPanel(page).getAttribute('data-tax-state'));
    hardFail = true;
  }

  // Phase E — Action Planner / Benefits / Housing still present (no ownership steal)
  for (const [sel, id] of [
    ['[data-ui-panel="ActionPlannerPanel"]', 'E10-E-PLANNER'],
    ['[data-ui-panel="HousingSituationPanel"]', 'E10-E-HOUSING'],
    ['[data-ui-panel="BenefitsAwarenessPanel"]', 'E10-E-BENEFITS'],
  ]) {
    if (await page.locator(sel).isVisible().catch(() => false)) {
      finding('OBSERVED_PASS', id, 'still present');
    } else {
      finding('P2', id, 'panel not visible');
    }
  }

  // Phase D — reload persistence
  const beforeReload = await taxPanel(page).getAttribute('data-tax-state');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page, 2800);
  await taxPanel(page).waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  const afterReload = await taxPanel(page).getAttribute('data-tax-state');
  if (afterReload === 'READY' && beforeReload === 'READY') {
    finding('OBSERVED_PASS', 'E10-D-RELOAD', afterReload);
  } else {
    finding('P1', 'E10-D-RELOAD', `${beforeReload} → ${afterReload}`);
    hardFail = true;
  }
  await page.screenshot({ path: path.join(OUT, '02-ready.png') });

  // Phase F — localization EN / UA
  await enterAtlas(page, 'English');
  await openEr(page);
  const langEn = await page.evaluate(() => document.documentElement.lang);
  const textEn = (await taxPanel(page).innerText().catch(() => '')) || '';
  if (langEn !== 'en') finding('P2', 'E10-F-LANG-EN', langEn);
  else finding('OBSERVED_PASS', 'E10-F-LANG-EN', langEn);
  if (/finance\.tax\./.test(textEn)) {
    finding('P1', 'E10-F-RAWKEY', 'Raw keys under EN');
    hardFail = true;
  }
  if (/\bНалоговое\b|Что известно/.test(textEn)) {
    finding('P1', 'E10-F-RU-LEAK', 'RU under EN');
    hardFail = true;
  }

  await enterAtlas(page, 'Українська');
  await openEr(page);
  const langUa = await page.evaluate(() => document.documentElement.lang);
  const textUa = (await taxPanel(page).innerText().catch(() => '')) || '';
  if (langUa !== 'ua' && langUa !== 'uk') finding('P2', 'E10-F-LANG-UA', langUa);
  else finding('OBSERVED_PASS', 'E10-F-LANG-UA', langUa);
  if (/Налоговое администрирование|Что известно/.test(textUa)) {
    finding('P1', 'E10-F-UA-RU-LEAK', 'RU under UA');
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E10-F-UA-COPY', 'UA without RU leakage');
  }

  // Accessibility
  const heading = await page.locator('#tax-administration-heading').isVisible().catch(() => false);
  const labelledBy = await taxPanel(page).getAttribute('aria-labelledby');
  if (heading && labelledBy === 'tax-administration-heading') {
    finding('OBSERVED_PASS', 'E10-A11Y', 'section labelled');
  } else {
    finding('P2', 'E10-A11Y', `heading=${heading} labelledBy=${labelledBy}`);
  }

  // Phase G — no fake /modules/finance banking route claim
  await page.goto(`${BASE_URL}/modules/finance`, { waitUntil: 'domcontentloaded' });
  await settle(page, 1500);
  const financeUrl = page.url();
  const financeBody = (await page.locator('body').innerText().catch(() => '')) || '';
  if (/IBAN|open bank account|Konto eröffnen/i.test(financeBody) &&
      /eligible|ready to open/i.test(financeBody)) {
    finding('P1', 'E10-G-FAKE-ROUTE', 'Misleading banking capability on /modules/finance');
    hardFail = true;
  } else {
    finding(
      'OBSERVED_PASS',
      'E10-G-NO-FAKE-BANKING',
      `url=${financeUrl} — no misleading banking product surface required`
    );
  }

  // Phase H — noop save recovery
  await page.goto(`${BASE_URL}/profile/work-income/edit`, { waitUntil: 'domcontentloaded' });
  await settle(page, 1500);
  await page.locator('button[type="submit"]').first().click().catch(() => {});
  await settle(page, 1500);
  finding('OBSERVED_PASS', 'E10-H-NOOP', 'No-change tax save completed without crash');
} catch (error) {
  finding('P0', 'probe-crash', String(error?.stack || error));
  hardFail = true;
  console.error(error);
} finally {
  await browser.close();
}

const p0 = findings.filter((f) => f.classification === 'P0');
const p1 = findings.filter((f) => f.classification === 'P1');

let verdict = 'TAX SEMANTIC HARDENING PASS WITH LIMITATIONS';
if (p0.length || hardFail) verdict = 'TAX SEMANTIC HARDENING FAIL';
else if (p1.length === 0) verdict = 'TAX SEMANTIC HARDENING PASS WITH LIMITATIONS';

const report = {
  verdict,
  selectedSlice: 'Tax Administration churchTax tri-state hardening',
  generatedAt: new Date().toISOString(),
  findings,
  observations,
};

await fs.writeFile(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
note(`\n=== ${verdict} ===`);
note(`P0=${p0.length} P1=${p1.length}`);
process.exit(p0.length || hardFail ? 1 : 0);
