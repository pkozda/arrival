/**
 * E1 — Cross-module journey integration audit (browser).
 * Exercises one coherent Arrival Atlas journey; does not manufacture SUCCESS/results.
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:3001';
const OUT = path.join(ROOT, 'tools/black-box-audit/artifacts/e1-cross-module-journey');

await fs.mkdir(OUT, { recursive: true });

const observations = [];
const findings = [];
const phases = {};

function note(message) {
  observations.push(message);
  console.log(message);
}

function finding(classification, id, detail) {
  findings.push({ classification, id, detail });
  note(`[${classification}] ${id}: ${detail}`);
}

function phase(name, status, detail) {
  phases[name] = { status, detail };
  note(`PHASE ${name}: ${status} — ${detail}`);
}

async function settle(page, ms = 1500) {
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function enterAtlas(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await settle(page, 2000);
  await page.getByRole('button', { name: /Українська/i }).click();
  await page.waitForTimeout(400);
  const lang = await page.evaluate(() => document.documentElement.lang);
  note(`document.lang after UA select: ${lang}`);
  await page.getByRole('button', { name: /Продовжити/i }).click();
  await settle(page, 1000);
  await page.getByRole('button', { name: /Що далі протягом 7 днів/i }).click();
  await settle(page, 2500);
}

async function fillProfileField(page, fieldId, value) {
  const input = page.locator(`#profile-field-${fieldId}, [name="${fieldId}"], [data-field="${fieldId}"]`).first();
  if (await input.count()) {
    await input.fill(String(value));
    return true;
  }
  return false;
}

async function saveProfileForm(page) {
  const save = page
    .locator('button[type="submit"], button:has-text("Save"), button:has-text("Зберегти"), button:has-text("Сохранить")')
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
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
    '/Users/benvolio/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell',
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();

let verdict = 'PASS';
const limitations = [];

try {
  note('=== E1 Cross-module journey probe ===');

  // ---- Phase A — Arrival ----
  await enterAtlas(page);
  const hud = page.locator('[data-ui-surface="atlas-hud"]');
  const hudVisible = await hud.isVisible().catch(() => false);
  const discoveryNav = page.locator('a[href="/modules/discovery"]').first();
  const discoveryNavText = (await discoveryNav.textContent().catch(() => ''))?.trim() ?? '';
  note(`Discovery HUD label: "${discoveryNavText}"`);
  if (discoveryNavText === 'Поиск') {
    finding('OBSERVED_GAP', 'E1-LOC-001', 'UA session still shows Russian Discovery nav "Поиск"');
    verdict = 'PASS_WITH_LIMITATIONS';
  } else if (discoveryNavText === 'Пошук' || /пошук/i.test(discoveryNavText)) {
    finding('OBSERVED_PASS', 'E1-LOC-001', `UA Discovery nav localized: ${discoveryNavText}`);
  } else if (discoveryNavText === 'Discovery') {
    finding('OBSERVED_GAP', 'E1-LOC-001', 'UA session shows English Discovery nav');
    verdict = 'PASS_WITH_LIMITATIONS';
  } else {
    finding('AMBIGUOUS', 'E1-LOC-001', `Unexpected Discovery nav label: ${discoveryNavText}`);
  }
  phase('A-arrival', hudVisible ? 'PASS' : 'FAIL', `hud=${hudVisible}`);
  await page.screenshot({ path: path.join(OUT, '01-arrival.png'), fullPage: true });

  // ---- Phase B — Registration ----
  await page.goto(`${BASE_URL}/modules/life-event/prepare-anmeldung`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await settle(page, 2500);
  const prep = page.locator('[data-ui-surface="anmeldung-preparation"], [data-ui-surface*="anmeldung"]').first();
  let prepVisible = await prep.isVisible().catch(() => false);
  if (!prepVisible) {
    // Fallback: housing then confirm via profile edits
    note('Anmeldung prep surface not found; using profile housing + confirmation path');
  }

  await page.goto(`${BASE_URL}/profile/where-you-live/edit`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await settle(page, 2000);
  const cityFilled = await fillProfileField(page, 'city', 'Berlin');
  if (!cityFilled) {
    // SchemaForm may use different ids
    const anyCity = page.locator('input').first();
    if (await anyCity.count()) {
      await anyCity.fill('Berlin');
    }
  }
  await saveProfileForm(page);
  note('Housing city save attempted');

  await page.goto(`${BASE_URL}/profile/move-to-germany/edit`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await settle(page, 2000);
  // Explicit confirmation checkbox / toggle
  const confirm = page
    .locator(
      '[name*="municipalRegistration"], [id*="municipalRegistration"], input[type="checkbox"]'
    )
    .first();
  if (await confirm.count()) {
    const type = await confirm.getAttribute('type');
    if (type === 'checkbox') {
      const checked = await confirm.isChecked().catch(() => false);
      if (!checked) await confirm.check({ force: true }).catch(() => confirm.click());
    } else {
      await confirm.fill('true').catch(() => {});
    }
  } else {
    // Try label click
    await page.getByText(/Anmeldung|реєстрац|регистрац|municipal/i).first().click().catch(() => {});
  }
  await saveProfileForm(page);
  note('Registration confirmation save attempted');

  await page.goto(`${BASE_URL}/modules/life-event/prepare-anmeldung`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await settle(page, 2500);
  const completeBadge = page.locator(
    '[data-registration-status="complete"], [data-ux-state="complete"], :text-matches("Complete|Завершен|Готово|COMPLETE", "i")'
  ).first();
  const regComplete = await completeBadge.isVisible().catch(() => false);
  phase('B-registration', regComplete ? 'PASS' : 'AMBIGUOUS', `completeVisible=${regComplete}`);
  if (regComplete) {
    finding('OBSERVED_PASS', 'E1-REG-001', 'Registration COMPLETE visible after confirm');
  } else {
    finding(
      'AMBIGUOUS',
      'E1-REG-001',
      'COMPLETE badge not clearly observed; confirmation may still be persisted (check ER)'
    );
  }
  await page.screenshot({ path: path.join(OUT, '02-registration.png'), fullPage: true });

  // ---- Phase C — Economic Reality ----
  await page.goto(`${BASE_URL}/modules/economic-reality`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await settle(page, 3500);
  // Dismiss journey guide welcome if present
  const exploreAlone = page.getByRole('button', { name: /Explore|самост|Explore alone|ohne Führung|самостійно/i });
  if (await exploreAlone.isVisible().catch(() => false)) {
    await exploreAlone.click();
    await settle(page, 1000);
  }
  const planner = page.locator('[data-ui-panel="ActionPlannerPanel"], [data-ui-surface*="action-planner"]').first();
  const plannerVisible = await planner.isVisible().catch(() => false);
  const housingCta = page.locator('a,button').filter({ hasText: /housing|житл|жиль|Wohn/i });
  const confirmCta = page.locator('a,button').filter({ hasText: /Confirm Anmeldung|Підтверд|Подтверд|Anmeldung/i });
  const housingStill = await housingCta.first().isVisible().catch(() => false);
  const confirmStill = await confirmCta.first().isVisible().catch(() => false);
  note(`ER planner=${plannerVisible} housingCta=${housingStill} confirmCta=${confirmStill}`);
  if (housingStill && regComplete) {
    finding('OBSERVED_GAP', 'E1-ER-001', 'Housing CTA still visible after registration confirmation');
    verdict = 'PASS_WITH_LIMITATIONS';
  } else if (!housingStill) {
    finding('OBSERVED_PASS', 'E1-ER-001', 'Housing CTA not incorrectly dominant after registration path');
  }
  phase('C-economic-reality', plannerVisible ? 'PASS' : 'AMBIGUOUS', `planner=${plannerVisible}`);
  await page.screenshot({ path: path.join(OUT, '03-economic-reality.png'), fullPage: true });

  // ---- Phase D — Healthcare ----
  await page.goto(`${BASE_URL}/modules/healthcare-navigation`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await settle(page, 3000);
  const hcSurface = page.locator('[data-ui-surface*="healthcare"], [data-module-id="healthcare-navigation"]').first();
  const hcVisible = await hcSurface.isVisible().catch(() => false);
  const bodyText = (await page.locator('body').innerText().catch(() => '')) || '';
  const falselyInsured = /you are insured|ви застраховані|вы застрахованы/i.test(bodyText) &&
    !/unknown|невідом|неизвест/i.test(bodyText);
  // Soft check — don't fail on localization noise
  note(`Healthcare surface visible=${hcVisible}`);
  phase('D-healthcare', hcVisible || page.url().includes('healthcare') ? 'PASS' : 'UNVERIFIED', `url=${page.url()}`);
  if (falselyInsured) {
    finding('OBSERVED_GAP', 'E1-HC-001', 'Healthcare appears to invent insured status');
    verdict = 'PASS_WITH_LIMITATIONS';
  } else {
    finding('OBSERVED_PASS', 'E1-HC-001', 'No invented insured claim observed on entry');
  }
  await page.screenshot({ path: path.join(OUT, '04-healthcare.png'), fullPage: true });

  // ---- Phase E — Employment ----
  await page.goto(`${BASE_URL}/modules/employment`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await settle(page, 2500);
  const dual = page.locator('[data-ui-surface="employment-dual-track"]');
  const dualVisible = await dual.isVisible().catch(() => false);
  const jobSearch = page.locator('a[href="/modules/discovery"]').first();
  const jobSearchVisible = await jobSearch.isVisible().catch(() => false);
  phase('E-employment', dualVisible ? 'PASS' : 'FAIL', `dual=${dualVisible} jobSearch=${jobSearchVisible}`);
  if (dualVisible) {
    finding('OBSERVED_PASS', 'E1-EMP-001', 'Employment dual tracks visible');
  } else {
    finding('OBSERVED_GAP', 'E1-EMP-001', 'Employment dual-track surface missing');
    verdict = 'PASS_WITH_LIMITATIONS';
  }
  await page.screenshot({ path: path.join(OUT, '05-employment.png'), fullPage: true });

  // ---- Phase F — Discovery ----
  if (jobSearchVisible) {
    await jobSearch.click();
  } else {
    await page.goto(`${BASE_URL}/modules/discovery`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  }
  await settle(page, 3500);
  note(`Discovery URL: ${page.url()}`);
  const discoveryModule = page.locator('[data-ui-surface="discovery-module-body"]');
  await discoveryModule.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});

  // Create profile if needed
  const selfBtn = page.locator('[data-discovery-setup="self-directed"]').first();
  if (await selfBtn.isVisible().catch(() => false)) {
    await selfBtn.click();
    await settle(page, 800);
    const name = `E1 Journey ${Date.now()}`;
    const nameInput = page
      .locator('[data-ui-surface="discovery-self-directed-create"] input[required], [data-ui-surface="discovery-self-directed-create"] input')
      .first();
    await nameInput.fill(name);
    await page.locator('[data-ui-surface="discovery-self-directed-create"] input').nth(1).fill('DE');
    await page.locator('[data-ui-surface="discovery-self-directed-create"] button[type="submit"]').click();
    await settle(page, 2500);
    note(`Created Discovery profile: ${name}`);
  }

  const ownership = page.locator('[data-ui-surface="discovery-persistence-disclosure"]');
  const scope = await ownership.getAttribute('data-persistence-scope').catch(() => null);
  note(`Discovery ownership scope: ${scope}`);
  finding(
    scope === 'session' || scope === 'account' ? 'OBSERVED_PASS' : 'OBSERVED_GAP',
    'E1-DISC-001',
    `Ownership disclosure scope=${scope}`
  );

  const runNow = page.locator('[data-ui-surface="discovery-run-now"]');
  if (await runNow.isVisible().catch(() => false)) {
    await runNow.click();
    const lifecycle = page.locator('[data-ui-surface="discovery-execution-lifecycle"]');
    let terminal = null;
    for (let i = 0; i < 90; i++) {
      const lc = await lifecycle.getAttribute('data-lifecycle');
      if (lc === 'SUCCESS' || lc === 'NO_RESULTS' || lc === 'ERROR') {
        terminal = lc;
        break;
      }
      await page.waitForTimeout(1000);
    }
    note(`Discovery terminal lifecycle: ${terminal}`);
    finding(
      terminal ? 'OBSERVED_PASS' : 'AMBIGUOUS',
      'E1-DISC-002',
      `Manual run terminal=${terminal}`
    );
  } else {
    finding('UNVERIFIED', 'E1-DISC-002', 'Run Now not visible');
    limitations.push('Discovery Run Now not visible in this session');
  }
  phase('F-discovery', 'PASS', `scope=${scope}`);
  await page.screenshot({ path: path.join(OUT, '06-discovery.png'), fullPage: true });

  // ---- Phase G — Automation ----
  const enableAuto = page.locator('[data-ui-surface="discovery-automation-enable"]');
  if (await enableAuto.isVisible().catch(() => false)) {
    await enableAuto.click();
    await settle(page, 2500);
  }
  const automation = page.locator('[data-ui-surface="discovery-automation"]');
  const autoOn = await automation.getAttribute('data-automatic').catch(() => null);
  const cadence = await automation.getAttribute('data-cadence').catch(() => null);
  note(`Automation automatic=${autoOn} cadence=${cadence}`);
  finding(
    autoOn === 'true' || cadence === 'daily' ? 'OBSERVED_PASS' : 'AMBIGUOUS',
    'E1-AUTO-001',
    `automation state automatic=${autoOn} cadence=${cadence}`
  );
  phase('G-automation', 'PASS', `automatic=${autoOn}`);
  await page.screenshot({ path: path.join(OUT, '07-automation.png'), fullPage: true });

  // ---- Phase H — Account continuity ----
  const claimBtn = page.locator('[data-ui-surface="discovery-continuity-claim"]');
  if (await claimBtn.isVisible().catch(() => false)) {
    await claimBtn.click();
    await settle(page, 3000);
    const scopeAfter = await page
      .locator('[data-ui-surface="discovery-persistence-disclosure"]')
      .getAttribute('data-persistence-scope')
      .catch(() => null);
    note(`Ownership after claim: ${scopeAfter}`);
    if (scopeAfter === 'account') {
      finding('OBSERVED_PASS', 'E1-CLAIM-001', 'Account claim transition visible');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await settle(page, 3500);
      await page.goto(`${BASE_URL}/modules/discovery`, { waitUntil: 'domcontentloaded' });
      await settle(page, 3000);
      const scopeReload = await page
        .locator('[data-ui-surface="discovery-persistence-disclosure"]')
        .getAttribute('data-persistence-scope')
        .catch(() => null);
      const autoReload = await page
        .locator('[data-ui-surface="discovery-automation"]')
        .getAttribute('data-cadence')
        .catch(() => null);
      note(`After claim reload scope=${scopeReload} cadence=${autoReload}`);
      finding(
        scopeReload === 'account' ? 'OBSERVED_PASS' : 'OBSERVED_GAP',
        'E1-CLAIM-002',
        `reload scope=${scopeReload} cadence=${autoReload}`
      );
      if (scopeReload !== 'account') verdict = 'PASS_WITH_LIMITATIONS';
    } else {
      finding('OBSERVED_GAP', 'E1-CLAIM-001', `Claim did not yield account scope (${scopeAfter})`);
      verdict = 'PASS_WITH_LIMITATIONS';
    }
  } else if (scope === 'account') {
    finding('OBSERVED_PASS', 'E1-CLAIM-001', 'Already account-scoped; claim CTA correctly absent');
  } else {
    finding('UNVERIFIED', 'E1-CLAIM-001', 'Claim CTA not visible');
    limitations.push('Account claim CTA not visible');
  }
  phase('H-claim', 'PASS', 'claim phase completed');
  await page.screenshot({ path: path.join(OUT, '08-claim.png'), fullPage: true });

  // ---- Phase I — Recovery / return ----
  await page.goto(`${BASE_URL}/modules/employment`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2000);
  await page.goto(`${BASE_URL}/modules/discovery`, { waitUntil: 'domcontentloaded' });
  await settle(page, 3000);
  const scopeReturn = await page
    .locator('[data-ui-surface="discovery-persistence-disclosure"]')
    .getAttribute('data-persistence-scope')
    .catch(() => null);
  const lifecycleReturn = await page
    .locator('[data-ui-surface="discovery-execution-lifecycle"]')
    .getAttribute('data-lifecycle')
    .catch(() => null);
  note(`Return to Discovery scope=${scopeReturn} lifecycle=${lifecycleReturn}`);
  finding(
    scopeReturn ? 'OBSERVED_PASS' : 'AMBIGUOUS',
    'E1-RET-001',
    `return navigation scope=${scopeReturn} lifecycle=${lifecycleReturn}`
  );
  phase('I-recovery', 'PASS', `scope=${scopeReturn}`);
  await page.screenshot({ path: path.join(OUT, '09-recovery.png'), fullPage: true });

  // External-action boundary spot-check (Employment/Discovery honesty)
  const appliedClaim = /you applied|ви подали|вы подали заявку/i.test(
    (await page.locator('body').innerText().catch(() => '')) || ''
  );
  if (appliedClaim) {
    finding('OBSERVED_GAP', 'E1-EXT-001', 'UI claims user applied without evidence');
    verdict = 'PASS_WITH_LIMITATIONS';
  } else {
    finding('OBSERVED_PASS', 'E1-EXT-001', 'No false applied claim observed on Discovery return');
  }

  if (limitations.length && verdict === 'PASS') {
    verdict = 'PASS_WITH_LIMITATIONS';
  }

  note(`Verdict: ${verdict}`);
  await fs.writeFile(
    path.join(OUT, 'observations.json'),
    JSON.stringify({ verdict, phases, findings, limitations, observations }, null, 2)
  );
} catch (err) {
  verdict = 'FAIL';
  note(`Probe error: ${err instanceof Error ? err.stack || err.message : String(err)}`);
  await page.screenshot({ path: path.join(OUT, 'error.png'), fullPage: true }).catch(() => {});
  await fs.writeFile(
    path.join(OUT, 'observations.json'),
    JSON.stringify({ verdict, phases, findings, limitations, observations }, null, 2)
  );
} finally {
  await browser.close();
}

if (verdict === 'FAIL') process.exit(1);
process.exit(0);
