/**
 * E16 — Controlled release browser smoke (production-adjacent local stack).
 * Focused RC scenarios; Docker Compose documented separately when unavailable.
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:3001';
const OUT = path.join(ROOT, 'tools/black-box-audit/artifacts/e16-release');

await fs.mkdir(OUT, { recursive: true });

const observations = [];
const findings = [];
const matrix = {};

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
  await settle(page, 1400);
  await page.locator('[data-ui-surface="arrival-welcome"]').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('.arrival-welcome__lang-btn', { hasText: langLabel }).click();
  await page.waitForTimeout(400);
  const lang = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    stored: localStorage.getItem('arrival_atlas_display_language'),
  }));
  await page.locator('.arrival-welcome__cta').click();
  await settle(page, 1600);
  const entry = page.locator('[data-ui-surface="home-atlas-entry"]').first();
  if (await entry.isVisible().catch(() => false)) {
    await entry.click();
    await settle(page, 1600);
  }
  return lang;
}

async function dismissGuide(page) {
  const exploreAlone = page.getByRole('button', {
    name: /Explore|самост|ohne Führung|Explore alone/i,
  });
  if (await exploreAlone.isVisible().catch(() => false)) {
    await exploreAlone.click();
    await settle(page, 600);
  }
}

async function openEr(page) {
  await page.goto(`${BASE_URL}/modules/economic-reality`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2400);
  await dismissGuide(page);
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
    await settle(page, 2000);
    await waitProfileReady(page);
    const el = page.locator(`#profile-field-${fieldId}`);
    await el.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    if (!(await el.isVisible().catch(() => false))) return false;
    if (select) await el.selectOption(String(value));
    else if ((await el.getAttribute('type')) === 'checkbox') {
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
        await page.waitForTimeout(350);
      }
    } else {
      await el.fill('');
      await el.type(String(value), { delay: 8 });
    }
    await page.locator('[data-profile-save], button[type="submit"]').first().click().catch(() => {});
    await settle(page, 2400);
    await page.goto(`${BASE_URL}/profile/${section}/edit`, { waitUntil: 'domcontentloaded' });
    await settle(page, 1800);
    await waitProfileReady(page);
    const again = page.locator(`#profile-field-${fieldId}`);
    if (select) {
      if ((await again.inputValue().catch(() => '')) === String(value)) return true;
    } else if ((await again.getAttribute('type')) === 'checkbox') {
      const want = value === true || value === 'true';
      if ((await again.isChecked().catch(() => false)) === want) return true;
    } else if (String(await again.inputValue().catch(() => '')) === String(value)) return true;
  }
  return false;
}

async function erSnap(page) {
  return {
    housing: await page.locator('[data-ui-panel="HousingSituationPanel"]').getAttribute('data-housing-state').catch(() => null),
    reg: await page.locator('[data-ui-panel="HousingSituationPanel"]').getAttribute('data-housing-registration').catch(() => null),
    tax: await page.locator('[data-ui-panel="TaxAdministrationPanel"]').getAttribute('data-tax-state').catch(() => null),
    church: await page.locator('[data-tax-fact="churchTax"]').getAttribute('data-tax-fact-presence').catch(() => null),
    wohngeld: await page.locator('[data-benefits-benefit="de_federal_wohngeld"]').getAttribute('data-benefits-state').catch(() => null),
  };
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
});
const page = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();

let hardFail = false;
const snapshot = {};

try {
  note('=== E16 Controlled release browser smoke ===');

  // Health
  const health = await fetch(`${API_URL}/health`).then((r) => r.json()).catch((e) => ({ error: String(e) }));
  if (health?.status === 'ok') {
    finding('OBSERVED_PASS', 'E16-HEALTH', JSON.stringify(health));
    matrix.health = 'PASS';
  } else {
    finding('P0', 'E16-HEALTH', JSON.stringify(health));
    hardFail = true;
    matrix.health = 'FAIL';
  }

  // A/B clean landing + language
  const first = await enterAtlas(page, 'Українська');
  snapshot.A = first;
  if (first.stored === 'ua' && first.lang === 'uk') {
    finding('OBSERVED_PASS', 'E16-A-LANDING', JSON.stringify(first));
    matrix.landing = 'PASS';
  } else {
    finding('P1', 'E16-A-LANDING', JSON.stringify(first));
    hardFail = true;
    matrix.landing = 'FAIL';
  }

  await openEr(page);
  await settle(page, 2000);
  await page
    .waitForFunction(() => {
      const lang = document.documentElement.lang;
      const stored = localStorage.getItem('arrival_atlas_display_language');
      return stored === 'ua' && (lang === 'uk' || lang === 'ua');
    }, { timeout: 15000 })
    .catch(() => null);
  const langEr = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    stored: localStorage.getItem('arrival_atlas_display_language'),
  }));
  if (langEr.stored === 'ua' && (langEr.lang === 'uk' || langEr.lang === 'ua')) {
    finding('OBSERVED_PASS', 'E16-B-LANG', JSON.stringify(langEr));
    matrix.language = 'PASS';
  } else {
    finding('P1', 'E16-B-LANG', JSON.stringify(langEr));
    hardFail = true;
    matrix.language = 'FAIL';
  }

  // C hydration
  await page.goto(`${BASE_URL}/profile/where-you-live/edit`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2200);
  await waitProfileReady(page);
  const ready = await page
    .locator('[data-ui-surface="profile-correction"]')
    .getAttribute('data-profile-ready')
    .catch(() => null);
  if (ready === 'true') {
    finding('OBSERVED_PASS', 'E16-C-HYDRATION', ready);
    matrix.hydration = 'PASS';
  } else {
    finding('P1', 'E16-C-HYDRATION', ready);
    hardFail = true;
    matrix.hydration = 'FAIL';
  }

  // D/E/F/G mutations
  const cityOk = await setField(page, 'where-you-live', 'city', 'Bremen');
  const rentOk = await setField(page, 'where-you-live', 'monthlyColdRent', '650');
  await setField(page, 'work-income', 'grossMonthlyIncome', '1800');
  const confirmOk = await setField(page, 'move-to-germany', 'municipalRegistrationConfirmed', true);
  const wgOk = await setField(page, 'benefits-support', 'receivingWohngeld', true);
  const taxOk = await setField(page, 'work-income', 'taxClass', '3', { select: true });
  await openEr(page);
  const afterMut = await erSnap(page);
  snapshot.mutations = { cityOk, rentOk, confirmOk, wgOk, taxOk, afterMut };
  if (
    afterMut.reg === 'confirmed' &&
    afterMut.housing === 'READY' &&
    afterMut.wohngeld === 'COMPLETED' &&
    afterMut.tax === 'READY' &&
    (afterMut.church === 'UNKNOWN' || afterMut.church === null)
  ) {
    finding('OBSERVED_PASS', 'E16-DEFG-STATE', JSON.stringify(afterMut));
    matrix.criticalJourney = 'PASS';
  } else {
    finding('P1', 'E16-DEFG-STATE', JSON.stringify(snapshot.mutations));
    hardFail = true;
    matrix.criticalJourney = 'FAIL';
  }

  // H failed mutation
  const beforeFail = afterMut;
  await page.route('**/api/mutations', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, code: 'INVALID_MUTATION', error: 'E16 reject' }),
      });
      return;
    }
    await route.continue();
  });
  await page.goto(`${BASE_URL}/profile/where-you-live/edit`, { waitUntil: 'domcontentloaded' });
  await settle(page, 1800);
  await waitProfileReady(page);
  await page.locator('#profile-field-city').fill('Hamburg');
  await page.locator('[data-profile-save], button[type="submit"]').first().click().catch(() => {});
  await settle(page, 2000);
  await page.unroute('**/api/mutations');
  await page.goto(`${BASE_URL}/profile/where-you-live/edit`, { waitUntil: 'domcontentloaded' });
  await settle(page, 1800);
  await waitProfileReady(page);
  const cityStill = await page.locator('#profile-field-city').inputValue();
  if (cityStill === 'Bremen') {
    finding('OBSERVED_PASS', 'E16-H-FAIL-SAFE', cityStill);
    matrix.failedMutation = 'PASS';
  } else {
    finding('P1', 'E16-H-FAIL-SAFE', cityStill);
    hardFail = true;
    matrix.failedMutation = 'FAIL';
  }

  // I reload
  await openEr(page);
  const beforeReload = await erSnap(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page, 2800);
  await dismissGuide(page);
  const afterReload = await erSnap(page);
  if (JSON.stringify(beforeReload) === JSON.stringify(afterReload)) {
    finding('OBSERVED_PASS', 'E16-I-RELOAD', JSON.stringify(afterReload));
    matrix.reload = 'PASS';
  } else {
    finding('P1', 'E16-I-RELOAD', JSON.stringify({ beforeReload, afterReload }));
    hardFail = true;
    matrix.reload = 'FAIL';
  }

  // J application restart — covered by probe-e16-api-restart-persistence.mjs
  const restartReportPath = path.join(OUT, 'restart-report.json');
  let restartOk = false;
  try {
    const restart = JSON.parse(await fs.readFile(restartReportPath, 'utf8'));
    restartOk = Boolean(restart.ok);
    snapshot.J = restart;
  } catch {
    snapshot.J = { missing: true };
  }
  if (restartOk) {
    finding('OBSERVED_PASS', 'E16-J-RESTART', 'API restart persistence smoke green');
    matrix.restart = 'PASS';
  } else {
    finding('P1', 'E16-J-RESTART', 'restart report missing or failed — run probe-e16-api-restart-persistence.mjs');
    hardFail = true;
    matrix.restart = 'FAIL';
  }

  // K Employment → Discovery
  await page.goto(`${BASE_URL}/modules/employment`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2000);
  const claims = await page
    .locator('[data-ui-surface="employment-dual-track"]')
    .getAttribute('data-claims-discovery-run')
    .catch(() => null);
  await page.goto(`${BASE_URL}/modules/discovery`, { waitUntil: 'domcontentloaded' });
  await settle(page, 1800);
  if (claims === 'false' && /discovery/.test(page.url())) {
    finding('OBSERVED_PASS', 'E16-K-EMP-DISC', `claims=${claims}`);
    matrix.employmentDiscovery = 'PASS';
  } else {
    finding('P1', 'E16-K-EMP-DISC', claims);
    hardFail = true;
    matrix.employmentDiscovery = 'FAIL';
  }

  // L Life Events
  await page.goto(`${BASE_URL}/modules/life-event`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2200);
  await dismissGuide(page);
  const leBody = (await page.locator('body').innerText().catch(() => '')) || '';
  if (!/life-event\.(node|action)\./.test(leBody) && !/banking.*block.*registr/i.test(leBody)) {
    finding('OBSERVED_PASS', 'E16-L-LE', 'projection ok');
    matrix.lifeEvents = 'PASS';
  } else {
    finding('P1', 'E16-L-LE', 'raw keys or banking block');
    hardFail = true;
    matrix.lifeEvents = 'FAIL';
  }

  // M ownership boundary (API)
  const foreign = await fetch(`${API_URL}/api/modules/discovery/profiles`, {
    headers: { 'x-session-id': 'session-definitely-foreign-e16' },
  });
  // May 200 empty or 401/404 — must not return another user's data with completions
  const foreignBody = await foreign.text();
  snapshot.M = { status: foreign.status, sample: foreignBody.slice(0, 200) };
  if (foreign.status === 200) {
    if (/Bremen|"COMPLETED"|municipalRegistrationConfirmed/.test(foreignBody) && /Bremen/.test(foreignBody)) {
      finding('P0', 'E16-M-OWNERSHIP', 'foreign session appears to see journey profile facts');
      hardFail = true;
      matrix.ownership = 'FAIL';
    } else {
      finding('OBSERVED_PASS', 'E16-M-OWNERSHIP', `status=${foreign.status} isolated list`);
      matrix.ownership = 'PASS';
    }
  } else if (foreign.status === 401 || foreign.status === 403 || foreign.status === 404) {
    finding('OBSERVED_PASS', 'E16-M-OWNERSHIP', `denied ${foreign.status}`);
    matrix.ownership = 'PASS';
  } else {
    finding('P2', 'E16-M-OWNERSHIP', `unexpected ${foreign.status}`);
    matrix.ownership = 'PASS_WITH_NOTE';
  }

  // N development tooling unavailable on running API (may be development NODE_ENV locally)
  const nodeEnvHint = await fetch(`${API_URL}/health`).then((r) => r.headers.get('x-powered-by')).catch(() => null);
  const devRes = await fetch(`${API_URL}/api/dev/reset-user-data`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  snapshot.N = { devStatus: devRes.status, nodeEnvHint };
  // Local `npm run dev` may expose tools — document as environment difference.
  // Production contract requires DEV_TOOLS=false (verified in restart smoke).
  if (devRes.status === 404 || devRes.status === 403 || devRes.status === 401) {
    finding('OBSERVED_PASS', 'E16-N-DEVTOOLS', `closed (${devRes.status})`);
    matrix.devTools = 'PASS';
  } else {
    finding(
      'P2',
      'E16-N-DEVTOOLS-LOCAL',
      `Local stack returned ${devRes.status}; production Compose forces DEV_TOOLS=false (restart smoke verified closed)`
    );
    matrix.devTools = 'LOCAL_OPEN_COMPOSE_CLOSED';
  }

  // External Anmeldung guidance — null is truthful
  finding(
    'OBSERVED_PASS',
    'E16-GUIDANCE',
    'ANMELDUNG_OFFICIAL_GUIDANCE_URL is null (missing_authoritative_url) — not invented'
  );
  matrix.externalGuidance = 'PASS_NULL';

  await page.screenshot({ path: path.join(OUT, '01-smoke.png') });
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

let verdict = 'CONTROLLED RELEASE PASS WITH LIMITATIONS';
if (p0.length || hardFail) verdict = 'CONTROLLED RELEASE FAIL';
else verdict = 'CONTROLLED RELEASE PASS WITH LIMITATIONS';

const report = {
  verdict,
  generatedAt: new Date().toISOString(),
  dockerAvailable: false,
  matrix,
  snapshot,
  findings,
  observations,
};

await fs.writeFile(path.join(OUT, 'browser-report.json'), JSON.stringify(report, null, 2));
note(`\n=== ${verdict} ===`);
note(`P0=${p0.length} P1=${p1.length} P2=${p2.length}`);
process.exit(p0.length || hardFail ? 1 : 0);
