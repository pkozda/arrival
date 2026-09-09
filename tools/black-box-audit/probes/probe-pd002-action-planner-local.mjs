/**
 * PD-002 Action Planner local browser validation.
 * Uses the proven UA first-contact path from PD-001 probes.
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUT = path.join(ROOT, 'tools/black-box-audit/artifacts/pd002-action-planner');

await fs.mkdir(OUT, { recursive: true });

const observations = [];
const planResponses = [];

function note(message) {
  observations.push(message);
  console.log(message);
}

const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
    '/Users/benvolio/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell',
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();

page.on('response', async (response) => {
  if (
    response.url().includes('/api/modules/economic-reality/plan') &&
    response.request().method() === 'GET'
  ) {
    try {
      const json = await response.json();
      const actions = json?.actionSet?.actions ?? [];
      planResponses.push({
        status: response.status(),
        hash: json?.meta?.deterministicHash,
        housing: actions.some((a) => String(a.id).endsWith(':profile-housing')),
        confirm: actions.some((a) => String(a.id).endsWith(':profile-confirm-registration')),
        primaryLabel: json?.plan?.primaryTrack?.actions?.[0]?.labelKey ?? null,
      });
    } catch {
      planResponses.push({ status: response.status(), parseError: true });
    }
  }
});

async function settle(ms = 1500) {
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

try {
  note(`PD-002 browser validation @ ${BASE_URL}`);

  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await settle(2000);

  await page.getByRole('button', { name: /Українська/i }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /Продовжити/i }).click();
  await settle(1000);
  await page.getByRole('button', { name: /Що далі протягом 7 днів/i }).click();
  await settle(2500);

  // Enter Life Events first so PROFILE + LE sync, then ECONOMIC can load.
  await page.goto(`${BASE_URL}/modules/life-event`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await settle(2500);

  const welcome = page.getByRole('dialog').filter({
    hasText: /Welcome to Arrival Atlas|Ласкаво просимо до Arrival Atlas/i,
  });
  if (await welcome.isVisible().catch(() => false)) {
    const startGuided = welcome.getByRole('button', {
      name: /Почати супроводжуваний шлях|Start guided|Begin|Continue/i,
    });
    if (await startGuided.isVisible().catch(() => false)) {
      await startGuided.click();
      await settle(2000);
    }
  }

  await page.goto(`${BASE_URL}/modules/economic-reality`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page
    .waitForResponse(
      (response) =>
        response.url().includes('/api/modules/economic-reality/plan') && response.status() === 200,
      { timeout: 45000 }
    )
    .catch(() => note('initial ER plan wait timed out'));
  await settle(2500);
  await page.screenshot({ path: path.join(OUT, '01-er-entry.png'), fullPage: true });

  const planner = page.locator('[data-ui-panel="ActionPlannerPanel"]');
  await planner.waitFor({ state: 'visible', timeout: 20000 });
  note(`planner visible status=${await planner.getAttribute('data-planner-status')}`);

  const nextLabel = await planner.locator('button').first().innerText().catch(() => '');
  note(`next CTA before housing: ${nextLabel || '(none)'}`);
  note(`plans: ${JSON.stringify(planResponses)}`);

  // Housing update via existing profile mutation path
  await page.goto(`${BASE_URL}/profile/where-you-live/edit`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await settle(1500);
  await page.locator('#profile-field-city').waitFor({ state: 'visible', timeout: 20000 });
  await page.locator('#profile-field-city').fill('Bremen');
  await page.getByRole('button', { name: /Зберегти|Save|Speichern|Сохранить/i }).first().click();
  await page.waitForURL(/\/profile\/where-you-live/, { timeout: 20000 }).catch(() => {});
  await settle(2500);
  note('housing city saved as Bremen');

  await page.goto(`${BASE_URL}/modules/economic-reality`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page
    .waitForResponse(
      (response) =>
        response.url().includes('/api/modules/economic-reality/plan') && response.status() === 200,
      { timeout: 45000 }
    )
    .catch(() => note('post-housing ER plan wait timed out'));
  await settle(2500);
  await page.screenshot({ path: path.join(OUT, '02-er-after-housing.png'), fullPage: true });

  const plannerAfter = page.locator('[data-ui-panel="ActionPlannerPanel"]');
  await plannerAfter.waitFor({ state: 'visible', timeout: 20000 });
  const afterLabel = await plannerAfter.locator('button').first().innerText().catch(() => '');
  note(`next CTA after housing: ${afterLabel || '(none)'}`);

  const lastPlan = planResponses[planResponses.length - 1];
  const stillHousingUnresolved = lastPlan?.housing === true;
  const confirmPresent = lastPlan?.confirm === true || /confirm|Anmeldung|bestätig|підтверд|подтверд/i.test(afterLabel);
  note(`ER-LOOP-001 housing still in action set: ${stillHousingUnresolved}`);
  note(`confirm action present: ${confirmPresent}`);
  note(`plans after housing: ${JSON.stringify(planResponses.slice(-2))}`);

  const recalculated = await page.locator('[data-planner-recalculated]').isVisible().catch(() => false);
  note(`recalculation confirmation visible: ${recalculated}`);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page
    .waitForResponse(
      (response) =>
        response.url().includes('/api/modules/economic-reality/plan') && response.status() === 200,
      { timeout: 45000 }
    )
    .catch(() => {});
  await settle(2500);
  await page.screenshot({ path: path.join(OUT, '03-er-after-reload.png'), fullPage: true });

  const reloadPlan = planResponses[planResponses.length - 1];
  note(`after reload housing=${reloadPlan?.housing} confirm=${reloadPlan?.confirm}`);

  const pass =
    Boolean(lastPlan) &&
    lastPlan.housing === false &&
    lastPlan.confirm === true &&
    reloadPlan?.housing === false &&
    reloadPlan?.confirm === true;

  note(`VERDICT: ${pass ? 'BROWSER PASS' : 'BROWSER FAIL'}`);
  await fs.writeFile(
    path.join(OUT, 'observations.json'),
    JSON.stringify({ observations, pass, planResponses, nextLabel, afterLabel }, null, 2)
  );
  if (!pass) process.exitCode = 1;
} catch (error) {
  note(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
  await page.screenshot({ path: path.join(OUT, 'error.png'), fullPage: true }).catch(() => {});
  await fs.writeFile(
    path.join(OUT, 'observations.json'),
    JSON.stringify({ observations, planResponses, error: String(error) }, null, 2)
  );
  process.exitCode = 1;
} finally {
  await browser.close();
}
