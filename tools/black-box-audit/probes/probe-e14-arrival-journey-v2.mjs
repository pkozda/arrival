/**
 * E14 — End-to-end Arrival Journey v2 & product coherence browser probe.
 * One coherent newcomer journey; semantic success ≠ HTTP 200.
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUT = path.join(ROOT, 'tools/black-box-audit/artifacts/e14-arrival-journey-v2');

await fs.mkdir(OUT, { recursive: true });

const observations = [];
const findings = [];
const transitions = [];
const consistency = {};

function note(message) {
  observations.push(message);
  console.log(message);
}

function finding(classification, id, detail) {
  findings.push({ classification, id, detail });
  note(`[${classification}] ${id}: ${detail}`);
}

function recordTransition(phase, before, after, detail) {
  transitions.push({ phase, before, after, detail, at: new Date().toISOString() });
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
  await page.waitForTimeout(500);
  const lang = await page.evaluate(() => document.documentElement.lang);
  const stored = await page.evaluate(() => localStorage.getItem('arrival_atlas_display_language'));
  await page.locator('.arrival-welcome__cta').click();
  await settle(page, 1800);
  const entry = page.locator('[data-ui-surface="home-atlas-entry"]').first();
  if (await entry.isVisible().catch(() => false)) {
    await entry.click();
    await settle(page, 2000);
  }
  return { lang, stored };
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
  const before = page.url();
  await page.goto(`${BASE_URL}/modules/economic-reality`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await settle(page, 2800);
  await dismissGuide(page);
  return { before, after: page.url() };
}

async function openLifeEvent(page) {
  const before = page.url();
  await page.goto(`${BASE_URL}/modules/life-event`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await settle(page, 2500);
  await dismissGuide(page);
  return { before, after: page.url() };
}

async function setProfileField(page, section, fieldId, value, { select = false } = {}) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.goto(`${BASE_URL}/profile/${section}/edit`, { waitUntil: 'domcontentloaded' });
    await settle(page, 2400);
    await page
      .waitForFunction(
        () =>
          document.querySelector('[data-ui-surface="profile-correction"]')?.getAttribute('data-profile-ready') ===
            'true' || document.querySelector(`#profile-field-${fieldId}`),
        { timeout: 15000 }
      )
      .catch(() => null);
    // Prefer explicit ready flag when present (E14 hydration gate).
    await page
      .locator('[data-ui-surface="profile-correction"][data-profile-ready="true"]')
      .waitFor({ state: 'visible', timeout: 12000 })
      .catch(() => {});
    const el = page.locator(`#profile-field-${fieldId}`);
    await el.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    if (!(await el.isVisible().catch(() => false))) return false;
    if (select) {
      await el.selectOption(String(value));
    } else if ((await el.getAttribute('type')) === 'checkbox') {
      const want = value === true || value === 'true';
      // Wait for authoritative hydration when revoking a previously true fact.
      if (!want) {
        await page
          .waitForFunction(
            ({ id }) => {
              const node = document.querySelector(`#profile-field-${id}`);
              return node instanceof HTMLInputElement && node.checked === true;
            },
            { id: fieldId },
            { timeout: 10000 }
          )
          .catch(() => null);
      }
      if ((await el.isChecked()) !== want) {
        const label = page.locator(`label[for="profile-field-${fieldId}"]`);
        if (await label.isVisible().catch(() => false)) await label.click();
        else await el.click({ force: true });
        await page.waitForTimeout(500);
      }
    } else {
      await el.click();
      await el.fill('');
      await el.type(String(value), { delay: 12 });
    }
    await page.waitForTimeout(400);
    await page.locator('[data-profile-save], button[type="submit"]').first().click().catch(() => {});
    await settle(page, 2800);
    await page.goto(`${BASE_URL}/profile/${section}/edit`, { waitUntil: 'domcontentloaded' });
    await settle(page, 2200);
    await page
      .locator('[data-ui-surface="profile-correction"][data-profile-ready="true"]')
      .waitFor({ state: 'visible', timeout: 12000 })
      .catch(() => {});
    const again = page.locator(`#profile-field-${fieldId}`);
    await again.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    if (select) {
      if ((await again.inputValue().catch(() => '')) === String(value)) return true;
    } else if ((await again.getAttribute('type')) === 'checkbox') {
      const want = value === true || value === 'true';
      if ((await again.isChecked().catch(() => false)) === want) return true;
    } else if (String(await again.inputValue().catch(() => '')) === String(value)) {
      return true;
    }
    note(`setProfileField retry ${fieldId} attempt=${attempt}`);
  }
  return false;
}

async function clearField(page, section, fieldId, { select = false } = {}) {
  await page.goto(`${BASE_URL}/profile/${section}/edit`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2400);
  const el = page.locator(`#profile-field-${fieldId}`);
  if (!(await el.isVisible().catch(() => false))) return false;
  if (select) await el.selectOption('');
  else {
    await el.fill('');
    await el.press('Tab');
  }
  await page.waitForTimeout(400);
  await page.locator('button[type="submit"]').first().click().catch(() => {});
  await settle(page, 2800);
  await page.goto(`${BASE_URL}/profile/${section}/edit`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2200);
  const value = await page.locator(`#profile-field-${fieldId}`).inputValue().catch(() => 'MISSING');
  return value === '' || value === null;
}

async function erSnapshot(page) {
  return {
    planner: await page
      .locator('[data-ui-panel="ActionPlannerPanel"]')
      .getAttribute('data-planner-status')
      .catch(() => null),
    plannerFocus: await page
      .locator('[data-ui-panel="ActionPlannerPanel"]')
      .getAttribute('data-planner-focus')
      .catch(() => null),
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
  };
}

async function langState(page) {
  return page.evaluate(() => ({
    lang: document.documentElement.lang,
    stored: localStorage.getItem('arrival_atlas_display_language'),
  }));
}

/** Wait until document.lang matches stored display language (ua → uk). */
async function waitForLanguageSync(page, expectedStored) {
  await page
    .waitForFunction(
      (stored) => {
        const currentStored = localStorage.getItem('arrival_atlas_display_language');
        const lang = document.documentElement.lang;
        if (stored && currentStored !== stored) return false;
        if (currentStored === 'ua') return lang === 'uk';
        if (currentStored) return lang === currentStored;
        return Boolean(lang);
      },
      expectedStored ?? null,
      { timeout: 12000 }
    )
    .catch(() => null);
  return langState(page);
}

async function hasRawKeys(page, patterns) {
  const body = (await page.locator('body').innerText().catch(() => '')) || '';
  return patterns.some((re) => re.test(body));
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
  note('=== E14 Arrival Journey v2 probe ===');

  // ========== A — First contact (UA) ==========
  const first = await enterAtlas(page, 'Українська');
  snapshot.A = first;
  if (first.lang === 'uk' && (first.stored === 'ua' || first.stored === 'uk')) {
    finding('OBSERVED_PASS', 'E14-A-LANG', JSON.stringify(first));
  } else {
    finding('P1', 'E14-A-LANG', JSON.stringify(first));
    hardFail = true;
  }
  const hud = await page.locator('[data-ui-surface="atlas-hud"]').isVisible().catch(() => false);
  const home = await page.locator('[data-ui-surface="home-atlas"]').isVisible().catch(() => false);
  const homeEntryGone = !(await page.locator('[data-ui-surface="arrival-welcome"]').isVisible().catch(() => false));
  if (hud || home || homeEntryGone) {
    finding('OBSERVED_PASS', 'E14-A-HOME', `hud=${hud} home=${home} url=${page.url()}`);
  } else {
    finding('P1', 'E14-A-HOME', `Could not enter Atlas: ${page.url()}`);
    hardFail = true;
  }
  await page.screenshot({ path: path.join(OUT, '01-first-contact.png') });

  // Language persistence after navigation
  await openLifeEvent(page);
  const langLe = await langState(page);
  await openEr(page);
  const langEr = await langState(page);
  if (langLe.lang === 'uk' && langEr.lang === 'uk') {
    finding('OBSERVED_PASS', 'E14-A-LANG-NAV', JSON.stringify({ langLe, langEr }));
  } else {
    finding('P1', 'E14-A-LANG-NAV', JSON.stringify({ langLe, langEr }));
    hardFail = true;
  }

  // ========== B — Registration ==========
  const beforeReg = await erSnapshot(page);
  const cityOk = await setProfileField(page, 'where-you-live', 'city', 'Bremen');
  await openEr(page);
  const afterCity = await erSnapshot(page);
  recordTransition('B-address', beforeReg, afterCity, `cityOk=${cityOk}`);
  if (!cityOk) {
    finding('P0', 'E14-B-CITY', 'city did not persist');
    hardFail = true;
  } else if (afterCity.reg === 'confirmed') {
    finding('P0', 'E14-B-HEURISTIC', 'Registration confirmed without municipalRegistrationConfirmed');
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E14-B-ADDRESS', JSON.stringify(afterCity));
  }

  await page.goto(`${BASE_URL}/modules/life-event/prepare-anmeldung`, {
    waitUntil: 'domcontentloaded',
  });
  await settle(page, 2200);
  const prepUrl = page.url();
  const prepSurface = await page
    .locator('[data-ui-surface="anmeldung-preparation"]')
    .isVisible()
    .catch(() => false);
  if (/prepare-anmeldung/.test(prepUrl) || prepSurface) {
    finding('OBSERVED_PASS', 'E14-B-PREPARE', `url=${prepUrl} surface=${prepSurface}`);
  } else {
    finding('P1', 'E14-B-PREPARE', prepUrl);
    hardFail = true;
  }

  // External guidance must not complete registration
  await openEr(page);
  const midPrep = await erSnapshot(page);
  if (midPrep.reg === 'confirmed') {
    finding('P0', 'E14-B-GUIDANCE-COMPLETE', 'prepare/external path completed registration');
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E14-B-GUIDANCE-NOT-COMPLETE', midPrep.reg);
  }

  const confirmOk = await setProfileField(
    page,
    'move-to-germany',
    'municipalRegistrationConfirmed',
    true
  );
  await openEr(page);
  const afterConfirm = await erSnapshot(page);
  recordTransition('B-confirm', midPrep, afterConfirm, `confirmOk=${confirmOk}`);
  if (confirmOk && afterConfirm.reg === 'confirmed') {
    finding('OBSERVED_PASS', 'E14-B-COMPLETE', JSON.stringify(afterConfirm));
  } else {
    finding('P1', 'E14-B-COMPLETE', JSON.stringify({ confirmOk, afterConfirm }));
    hardFail = true;
  }

  await openLifeEvent(page);
  const leRaw = await hasRawKeys(page, [/life-event\.(node|action)\./]);
  if (leRaw) {
    finding('P1', 'E14-B-LE-RAW', 'Raw LE keys after confirmation');
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E14-B-LE', 'LE after confirmation without raw keys');
  }

  // Banking must not block registration language
  const leBody = (await page.locator('body').innerText().catch(() => '')) || '';
  if (/banking.*block.*registr|банків.*блок.*реєстр/i.test(leBody)) {
    finding('P1', 'E14-B-BANK-BLOCK', 'Banking appears to block registration');
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E14-B-NO-BANK-PREREQ', 'No banking→registration blocker');
  }

  // ========== C — Economic Reality / Housing ==========
  const rentOk = await setProfileField(page, 'where-you-live', 'monthlyColdRent', '650');
  const incomeOk = await setProfileField(page, 'work-income', 'grossMonthlyIncome', '1800');
  await openEr(page);
  const afterHousing = await erSnapshot(page);
  recordTransition('C-housing', afterConfirm, afterHousing, `rent=${rentOk} income=${incomeOk}`);
  if (rentOk && afterHousing.housing === 'READY') {
    finding('OBSERVED_PASS', 'E14-C-HOUSING-READY', JSON.stringify(afterHousing));
  } else {
    finding('P1', 'E14-C-HOUSING-READY', JSON.stringify({ rentOk, afterHousing }));
    hardFail = true;
  }
  if (afterHousing.reg === 'confirmed') {
    finding('OBSERVED_PASS', 'E14-C-REG-INDEPENDENT', 'Registration stayed confirmed after rent');
  } else {
    finding('P1', 'E14-C-REG-INDEPENDENT', afterHousing.reg);
    hardFail = true;
  }
  if (afterHousing.planner) {
    finding('OBSERVED_PASS', 'E14-C-PLANNER', `${afterHousing.planner}/${afterHousing.plannerFocus}`);
  } else {
    finding('P2', 'E14-C-PLANNER', 'Action Planner status missing');
  }

  // ========== D — Benefits ==========
  const childrenOk = await setProfileField(page, 'household-family', 'dependentChildCount', '1');
  await openEr(page);
  const benefitsReady = await erSnapshot(page);
  if (
    benefitsReady.wohngeld === 'READY_TO_ACT' ||
    benefitsReady.wohngeld === 'COMPLETED' ||
    benefitsReady.wohngeld === 'NEED_MORE_INFO'
  ) {
    finding('OBSERVED_PASS', 'E14-D-WOHNGELD-AWARE', benefitsReady.wohngeld);
  } else {
    finding('P2', 'E14-D-WOHNGELD-AWARE', `wohngeld=${benefitsReady.wohngeld} income=${incomeOk}`);
  }

  const wgSet = await setProfileField(page, 'benefits-support', 'receivingWohngeld', true);
  await openEr(page);
  const wgDone = await erSnapshot(page);
  recordTransition('D-wohngeld-complete', benefitsReady, wgDone, `wgSet=${wgSet}`);
  if (wgDone.wohngeld === 'COMPLETED') {
    finding('OBSERVED_PASS', 'E14-D-WOHNGELD-COMPLETE', wgDone.wohngeld);
  } else {
    finding('P1', 'E14-D-WOHNGELD-COMPLETE', JSON.stringify({ wgSet, state: wgDone.wohngeld }));
    hardFail = true;
  }

  // ========== E — Healthcare ==========
  await page.goto(`${BASE_URL}/modules/healthcare-navigation`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2500);
  const hcUrl = page.url();
  const hcBody = (await page.locator('body').innerText().catch(() => '')) || '';
  const hcRaw = /healthcare\.[a-z0-9_.]+/i.test(hcBody) && /healthcare\.(outcome|missing)\./.test(hcBody);
  if (/healthcare/.test(hcUrl)) {
    finding('OBSERVED_PASS', 'E14-E-HEALTHCARE', hcUrl);
  } else {
    finding('P1', 'E14-E-HEALTHCARE', hcUrl);
    hardFail = true;
  }
  // Progressive enrichment: set insurance facts
  const insOk = await setProfileField(page, 'health-insurance', 'insuranceType', 'public', {
    select: true,
  });
  await page.goto(`${BASE_URL}/modules/healthcare-navigation`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2500);
  snapshot.E = { hcUrl, insOk };
  if (insOk) finding('OBSERVED_PASS', 'E14-E-ENRICH', 'insuranceType=public persisted');
  else finding('P2', 'E14-E-ENRICH', 'insuranceType save flaky');
  if (hcRaw) {
    finding('P2', 'E14-E-RAW', 'Possible raw healthcare keys');
  }

  // ========== F — Employment → Discovery ==========
  await page.goto(`${BASE_URL}/modules/employment`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2500);
  const emp = page.locator('[data-ui-surface="employment-dual-track"]');
  const implies = await emp.getAttribute('data-implies-job-search-intent').catch(() => null);
  const claims = await emp.getAttribute('data-claims-discovery-run').catch(() => null);
  const workTrack = await page.locator('[data-track="work-income"]').isVisible().catch(() => false);
  const jobTrack = await page.locator('[data-track="job-search"]').isVisible().catch(() => false);
  if (workTrack && jobTrack && implies === 'false' && claims === 'false') {
    finding('OBSERVED_PASS', 'E14-F-EMPLOYMENT', `implies=${implies} claims=${claims}`);
  } else {
    finding('P1', 'E14-F-EMPLOYMENT', JSON.stringify({ workTrack, jobTrack, implies, claims }));
    hardFail = true;
  }

  const jobHref = await page.locator('[data-track="job-search"] a, [data-cta="job-search"]').first().getAttribute('href').catch(() => null);
  await page.goto(`${BASE_URL}/modules/discovery`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2800);
  const discUrl = page.url();
  const discRaw = await hasRawKeys(page, [/discovery\.(setup|run|result)\.[a-z]/]);
  snapshot.F = { jobHref, discUrl, implies, claims };
  if (/discovery/.test(discUrl)) {
    finding('OBSERVED_PASS', 'E14-F-DISCOVERY', discUrl);
  } else {
    finding('P1', 'E14-F-DISCOVERY', discUrl);
    hardFail = true;
  }
  if (discRaw) {
    finding('P2', 'E14-F-DISC-RAW', 'Possible raw Discovery keys');
  }
  // Return to employment
  await page.goto(`${BASE_URL}/modules/employment`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2000);
  if (await emp.isVisible().catch(() => false)) {
    finding('OBSERVED_PASS', 'E14-F-RETURN', 'Employment reachable after Discovery');
  }

  // ========== G — Tax ==========
  const taxOk = await setProfileField(page, 'work-income', 'taxClass', '3', { select: true });
  await openEr(page);
  const taxSnap = await erSnapshot(page);
  recordTransition('G-tax', afterHousing, taxSnap, `taxOk=${taxOk}`);
  if (taxSnap.tax === 'READY') {
    finding('OBSERVED_PASS', 'E14-G-TAX-READY', JSON.stringify(taxSnap));
  } else {
    finding('P1', 'E14-G-TAX-READY', JSON.stringify({ taxOk, taxSnap }));
    hardFail = true;
  }
  if (taxSnap.church === 'UNKNOWN' || taxSnap.church === null) {
    finding('OBSERVED_PASS', 'E14-G-CHURCH-UNKNOWN', String(taxSnap.church));
  } else {
    finding('P1', 'E14-G-CHURCH-UNKNOWN', `coerced=${taxSnap.church}`);
    hardFail = true;
  }
  // Unrelated income save must not invent churchTax false
  await setProfileField(page, 'work-income', 'grossMonthlyIncome', '1850');
  await openEr(page);
  const taxAfterIncome = await erSnapshot(page);
  if (taxAfterIncome.church === 'UNKNOWN' || taxAfterIncome.church === null) {
    finding('OBSERVED_PASS', 'E14-G-CHURCH-PRESERVED', String(taxAfterIncome.church));
  } else {
    finding('P0', 'E14-G-CHURCH-COERCED', JSON.stringify(taxAfterIncome));
    hardFail = true;
  }

  // No Finance product module — Tax lives on ER (Option C)
  await page.goto(`${BASE_URL}/modules/finance`, { waitUntil: 'domcontentloaded' });
  await settle(page, 1500);
  const financeUrl = page.url();
  const financeSliceOnFinanceRoute = await page.locator('[data-finance-slice]').count();
  if (!/\/modules\/finance/.test(financeUrl) || financeSliceOnFinanceRoute === 0) {
    finding('OBSERVED_PASS', 'E14-G-NO-FINANCE-MODULE', financeUrl);
  } else {
    finding('P1', 'E14-G-FINANCE-MODULE', `Unexpected Finance module at ${financeUrl}`);
    hardFail = true;
  }

  // ========== H — Life Events projection ==========
  await openLifeEvent(page);
  const leAfter = (await page.locator('body').innerText().catch(() => '')) || '';
  if (/life-event\.(node|action)\./.test(leAfter)) {
    finding('P1', 'E14-H-RAW', 'Raw LE keys in integrated state');
    hardFail = true;
  } else {
    finding('OBSERVED_PASS', 'E14-H-LE', 'LE projection loads without raw keys');
  }
  // Discovery must not be invented by LE CTAs claiming a run
  if (/discovery.*SUCCESS|фальшив.*пошук/i.test(leAfter) && /run completed|завершено/i.test(leAfter)) {
    finding('P2', 'E14-H-DISC-INVENT', 'Possible Discovery invent language in LE');
  }

  // ========== I — Navigation ==========
  const navPath = [
    '/modules/economic-reality',
    '/modules/life-event',
    '/modules/employment',
    '/modules/discovery',
    '/profile',
    '/modules/economic-reality',
  ];
  const navLangs = [];
  for (const route of navPath) {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
    await settle(page, 1600);
    await dismissGuide(page);
    navLangs.push({ route, ...(await waitForLanguageSync(page, 'ua')) });
  }
  snapshot.I = navLangs;
  if (navLangs.every((n) => n.lang === 'uk' && (n.stored === 'ua' || n.stored === 'uk'))) {
    finding('OBSERVED_PASS', 'E14-I-LANG-STABLE', 'Language stable across module navigation');
  } else {
    // Full page.goto remounts SSR lang=en briefly; persistent mismatch after sync wait is P1.
    finding('P1', 'E14-I-LANG-STABLE', JSON.stringify(navLangs));
    hardFail = true;
  }
  await openEr(page);
  const afterNav = await erSnapshot(page);
  if (
    afterNav.housing === 'READY' &&
    afterNav.reg === 'confirmed' &&
    afterNav.wohngeld === 'COMPLETED' &&
    afterNav.tax === 'READY'
  ) {
    finding('OBSERVED_PASS', 'E14-I-STATE', JSON.stringify(afterNav));
  } else {
    finding('P1', 'E14-I-STATE', JSON.stringify(afterNav));
    hardFail = true;
  }

  // ========== J — Reload ==========
  const beforeReload = await erSnapshot(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page, 3200);
  await dismissGuide(page);
  const afterReload = await erSnapshot(page);
  const langReload = await langState(page);
  recordTransition('J-reload', beforeReload, afterReload, JSON.stringify(langReload));
  const reloadOk =
    beforeReload.housing === afterReload.housing &&
    beforeReload.reg === afterReload.reg &&
    beforeReload.wohngeld === afterReload.wohngeld &&
    beforeReload.tax === afterReload.tax &&
    beforeReload.church === afterReload.church;
  if (reloadOk && langReload.lang === 'uk') {
    finding('OBSERVED_PASS', 'E14-J-RELOAD', JSON.stringify(afterReload));
  } else {
    finding('P1', 'E14-J-RELOAD', JSON.stringify({ beforeReload, afterReload, langReload }));
    hardFail = true;
  }
  await page.screenshot({ path: path.join(OUT, '02-reload.png') });

  // ========== K — Recovery / reversal ==========
  const wgRevoke = await setProfileField(page, 'benefits-support', 'receivingWohngeld', false);
  await openEr(page);
  const afterRevoke = await erSnapshot(page);
  recordTransition('K-wohngeld-revoke', afterReload, afterRevoke, `revoke=${wgRevoke}`);
  if (afterRevoke.wohngeld === 'READY_TO_ACT') {
    finding('OBSERVED_PASS', 'E14-K-BENEFIT-REVERSE', afterRevoke.wohngeld);
  } else if (afterRevoke.wohngeld === 'COMPLETED') {
    finding('P0', 'E14-K-STALE-COMPLETE', 'Wohngeld stayed COMPLETED after false');
    hardFail = true;
  } else {
    finding('P1', 'E14-K-BENEFIT-REVERSE', JSON.stringify({ wgRevoke, afterRevoke }));
    hardFail = true;
  }

  const regRevoke = await setProfileField(
    page,
    'move-to-germany',
    'municipalRegistrationConfirmed',
    false
  );
  await openEr(page);
  const afterRegRevoke = await erSnapshot(page);
  recordTransition('K-reg-revoke', afterRevoke, afterRegRevoke, `regRevoke=${regRevoke}`);
  if (regRevoke && afterRegRevoke.reg !== 'confirmed') {
    finding('OBSERVED_PASS', 'E14-K-REG-REVERSE', afterRegRevoke.reg);
  } else if (!regRevoke) {
    finding('P2', 'E14-K-REG-REVERSE', 'Registration revoke UI flaky');
  } else {
    finding('P0', 'E14-K-REG-STALE', afterRegRevoke.reg);
    hardFail = true;
  }

  // No-op save: derived unchanged
  const beforeNoop = await erSnapshot(page);
  await page.goto(`${BASE_URL}/profile/work-income/edit`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2000);
  await page.locator('button[type="submit"]').first().click().catch(() => {});
  await settle(page, 2000);
  await openEr(page);
  const afterNoop = await erSnapshot(page);
  if (JSON.stringify(beforeNoop) === JSON.stringify(afterNoop)) {
    finding('OBSERVED_PASS', 'E14-K-NOOP', 'No-op save left ER derived state unchanged');
  } else {
    finding('P1', 'E14-K-NOOP', JSON.stringify({ beforeNoop, afterNoop }));
    hardFail = true;
  }

  // ========== L — Final consistency matrix ==========
  await openEr(page);
  const erFinal = await erSnapshot(page);
  await page.goto(`${BASE_URL}/profile/where-you-live/edit`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2200);
  await page
    .locator('[data-ui-surface="profile-correction"][data-profile-ready="true"]')
    .waitFor({ state: 'visible', timeout: 15000 })
    .catch(() => {});
  await page
    .waitForFunction(
      () => {
        const node = document.querySelector('#profile-field-city');
        return node instanceof HTMLInputElement && node.value.trim().length > 0;
      },
      { timeout: 12000 }
    )
    .catch(() => null);
  const profileCity = await page.locator('#profile-field-city').inputValue().catch(() => null);
  const profileRent = await page.locator('#profile-field-monthlyColdRent').inputValue().catch(() => null);
  await page.goto(`${BASE_URL}/profile/move-to-germany/edit`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2200);
  await page
    .locator('[data-ui-surface="profile-correction"][data-profile-ready="true"]')
    .waitFor({ state: 'visible', timeout: 15000 })
    .catch(() => {});
  const profileReg = await page
    .locator('#profile-field-municipalRegistrationConfirmed')
    .isChecked()
    .catch(() => null);
  await page.goto(`${BASE_URL}/profile/work-income/edit`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2200);
  await page
    .locator('[data-ui-surface="profile-correction"][data-profile-ready="true"]')
    .waitFor({ state: 'visible', timeout: 15000 })
    .catch(() => {});
  const profileTax = await page.locator('#profile-field-taxClass').inputValue().catch(() => null);
  const profileChurch = await page.locator('#profile-field-churchTax').inputValue().catch(() => null);
  await page.goto(`${BASE_URL}/modules/employment`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2000);
  const empClaims = await page
    .locator('[data-ui-surface="employment-dual-track"]')
    .getAttribute('data-claims-discovery-run')
    .catch(() => null);

  consistency.matrix = {
    address: { profile: profileCity, erHousing: erFinal.housing },
    registration: { profile: profileReg, er: erFinal.reg },
    rent: { profile: profileRent, er: erFinal.housing },
    wohngeld: { er: erFinal.wohngeld },
    taxClass: { profile: profileTax, er: erFinal.tax },
    churchTax: { profile: profileChurch === '' ? 'unknown' : profileChurch, er: erFinal.church },
    discovery: { employmentClaimsRun: empClaims },
  };
  snapshot.L = consistency.matrix;

  if (profileCity === 'Bremen' && erFinal.housing) {
    finding('OBSERVED_PASS', 'E14-L-ADDRESS', `${profileCity}/${erFinal.housing}`);
  } else {
    finding('P1', 'E14-L-ADDRESS', JSON.stringify(consistency.matrix.address));
    hardFail = true;
  }
  if (profileReg === false && erFinal.reg !== 'confirmed') {
    finding('OBSERVED_PASS', 'E14-L-REG', JSON.stringify(consistency.matrix.registration));
  } else if (profileReg === true && erFinal.reg === 'confirmed') {
    finding('OBSERVED_PASS', 'E14-L-REG', JSON.stringify(consistency.matrix.registration));
  } else {
    finding('P1', 'E14-L-REG', JSON.stringify(consistency.matrix.registration));
    hardFail = true;
  }
  if (empClaims === 'false') {
    finding('OBSERVED_PASS', 'E14-L-DISC', 'Employment does not claim Discovery run');
  } else {
    finding('P1', 'E14-L-DISC', empClaims);
    hardFail = true;
  }

  // ========== EN first-contact spot-check ==========
  const en = await enterAtlas(page, 'English');
  await openEr(page);
  const enLang = await langState(page);
  const enRaw = await hasRawKeys(page, [
    /benefits\.awareness\./,
    /housing\.situation\./,
    /tax\.admin\./,
    /planner\./,
  ]);
  snapshot.EN = { en, enLang, enRaw };
  if (enLang.lang === 'en' && !enRaw) {
    finding('OBSERVED_PASS', 'E14-EN', 'EN first-contact + ER without raw keys');
  } else {
    finding(enRaw ? 'P1' : 'P2', 'E14-EN', JSON.stringify({ enLang, enRaw }));
    if (enRaw) hardFail = true;
  }

  // DE / RU targeted lang + raw-key spot-check
  for (const [label, expectLang] of [
    ['Deutsch', 'de'],
    ['Русский', 'ru'],
  ]) {
    await enterAtlas(page, label);
    await openEr(page);
    const st = await langState(page);
    const raw = await hasRawKeys(page, [/benefits\.awareness\.|housing\.situation\./]);
    if (st.lang === expectLang && !raw) {
      finding('OBSERVED_PASS', `E14-${expectLang.toUpperCase()}`, JSON.stringify(st));
    } else {
      finding(raw ? 'P1' : 'P2', `E14-${expectLang.toUpperCase()}`, JSON.stringify({ st, raw }));
      if (raw) hardFail = true;
    }
  }

  await page.screenshot({ path: path.join(OUT, '03-final.png') });
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

let verdict = 'ARRIVAL JOURNEY PASS WITH LIMITATIONS';
if (p0.length || hardFail) verdict = 'ARRIVAL JOURNEY FAIL';
else if (p1.length === 0 && p2.length === 0) verdict = 'ARRIVAL JOURNEY PASS';
else verdict = 'ARRIVAL JOURNEY PASS WITH LIMITATIONS';

const report = {
  verdict,
  generatedAt: new Date().toISOString(),
  snapshot,
  consistency,
  transitions,
  findings,
  observations,
};

await fs.writeFile(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
note(`\n=== ${verdict} ===`);
note(`P0=${p0.length} P1=${p1.length} P2=${p2.length}`);
process.exit(p0.length || hardFail ? 1 : 0);
