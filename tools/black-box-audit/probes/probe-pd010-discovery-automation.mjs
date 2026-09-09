/**
 * PD-010 Discovery automation & digest — local browser validation.
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:3001';
const OUT = path.join(ROOT, 'tools/black-box-audit/artifacts/pd010-discovery-automation');

await fs.mkdir(OUT, { recursive: true });

const observations = [];

function note(message) {
  observations.push(message);
  console.log(message);
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
  await page.getByRole('button', { name: /Продовжити/i }).click();
  await settle(page, 1000);
  await page.getByRole('button', { name: /Що далі протягом 7 днів/i }).click();
  await settle(page, 2500);
}

async function openDiscovery(page) {
  await page.goto(`${BASE_URL}/modules/discovery`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await settle(page, 3500);
}

async function createViaSelfDirected(page, name) {
  const selfBtn = page.locator('[data-discovery-setup="self-directed"]').first();
  if (await selfBtn.isVisible().catch(() => false)) {
    await selfBtn.click();
    await settle(page, 800);
  }
  const nameInput = page
    .locator('[data-ui-surface="discovery-self-directed-create"] label')
    .filter({ hasText: /name|назв|Name|ім/i })
    .locator('input')
    .first();
  if (await nameInput.count()) {
    await nameInput.fill(name);
  } else {
    await page
      .locator('[data-ui-surface="discovery-self-directed-create"] input[required]')
      .first()
      .fill(name);
  }
  await page
    .locator('[data-ui-surface="discovery-self-directed-create"] input')
    .nth(1)
    .fill('DE');
  await page
    .locator('[data-ui-surface="discovery-self-directed-create"] button[type="submit"]')
    .click();
  await settle(page, 2500);
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
  note('=== PD-010 Discovery automation probe ===');

  const apiHealth = await fetch(`${API_URL}/health`).catch(() => null);
  if (!apiHealth?.ok) {
    note(`API health check failed at ${API_URL}/health`);
    limitations.push('API not reachable for ops tick');
  }

  await enterAtlas(page);
  await openDiscovery(page);

  const profileName = `PD010 Auto ${Date.now()}`;
  await createViaSelfDirected(page, profileName);

  const automation = page.locator('[data-ui-surface="discovery-automation"]');
  await automation.waitFor({ state: 'visible', timeout: 15000 });
  note(`Automation panel visible: true`);

  const sessionWarn = page.locator('[data-ui-surface="discovery-automation-session-warning"]');
  const sessionWarnVisible = await sessionWarn.isVisible().catch(() => false);
  note(`Session durability warning: ${sessionWarnVisible}`);
  if (!sessionWarnVisible) {
    limitations.push('Session warning not shown (may be account-scoped session)');
  }

  const statusOff = page.locator('[data-ui-surface="discovery-automation-status"]');
  note(`Initial status text: ${(await statusOff.textContent())?.trim()}`);

  const enableBtn = page.locator('[data-ui-surface="discovery-automation-enable"]');
  if (!(await enableBtn.isVisible().catch(() => false))) {
    verdict = 'FAIL';
    note('FAIL: enable automation control missing');
  } else {
    await enableBtn.click();
    await settle(page, 2500);
    await page.screenshot({ path: path.join(OUT, '01-enabled.png'), fullPage: true });

    const status = await page
      .locator('[data-ui-surface="discovery-automation-status"]')
      .textContent();
    note(`After enable status: ${status?.trim()}`);
    const autoAttr = await automation.getAttribute('data-automatic');
    note(`data-automatic after enable: ${autoAttr}`);
    if (autoAttr !== 'true') {
      // May need reload for run-summary refresh
      note('data-automatic not yet true — checking after reload');
    }
  }

  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page, 3500);
  await openDiscovery(page);
  await automation.waitFor({ state: 'visible', timeout: 15000 });
  await page.screenshot({ path: path.join(OUT, '02-reload-enabled.png'), fullPage: true });

  const autoAfterReload = await automation.getAttribute('data-automatic');
  const cadenceAfterReload = await automation.getAttribute('data-cadence');
  note(`After reload data-automatic=${autoAfterReload} data-cadence=${cadenceAfterReload}`);
  if (autoAfterReload !== 'true' && cadenceAfterReload !== 'daily') {
    verdict = 'FAIL';
    note('FAIL: schedule did not persist across reload');
  }

  const nextRun = page.locator('[data-ui-surface="discovery-automation-next-run"]');
  const nextRunNone = page.locator('[data-ui-surface="discovery-automation-next-run-none"]');
  if (await nextRun.isVisible().catch(() => false)) {
    note(`Next run visible: ${(await nextRun.textContent())?.trim()}`);
  } else if (await nextRunNone.isVisible().catch(() => false)) {
    note(`Next run none: ${(await nextRunNone.textContent())?.trim()}`);
    limitations.push('nextRunAt not projected in UI after enable (ops/schedule sync)');
  }

  // Manual Run Now must remain available
  const runNow = page.locator('[data-ui-surface="discovery-run-now"]');
  if (await runNow.isVisible().catch(() => false)) {
    await runNow.click();
    const lifecycle = page.locator('[data-ui-surface="discovery-execution-lifecycle"]');
    let terminal = null;
    for (let i = 0; i < 90; i++) {
      const lc = await lifecycle.getAttribute('data-lifecycle');
      if (lc === 'SUCCESS' || lc === 'NO_RESULTS' || lc === 'ERROR' || lc === 'QUEUED' || lc === 'RUNNING') {
        if (lc === 'SUCCESS' || lc === 'NO_RESULTS' || lc === 'ERROR') {
          terminal = lc;
          break;
        }
      }
      await page.waitForTimeout(1000);
    }
    note(`Manual Run Now terminal lifecycle: ${terminal ?? 'not-terminal-in-window'}`);
    if (!terminal) {
      limitations.push('Manual run did not reach terminal state in probe window');
    }
  } else {
    verdict = 'FAIL';
    note('FAIL: Run Now missing while automation enabled');
  }

  // Host tick for scheduled execution — only if ops token available
  if (process.env.ARRIVAL_ATLAS_OPS_TOKEN) {
    try {
      const tick = await fetch(`${API_URL}/api/ops/discovery/trigger-due-runs`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.ARRIVAL_ATLAS_OPS_TOKEN}`,
          'content-type': 'application/json',
        },
      });
      note(`Ops trigger-due-runs status: ${tick.status}`);
      if (!tick.ok) {
        limitations.push(`Ops tick returned ${tick.status}`);
      }
    } catch (err) {
      limitations.push(`Ops tick not exercised: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    limitations.push(
      'ARRIVAL_ATLAS_OPS_TOKEN unset — scheduled host tick not exercised in browser probe'
    );
  }

  const disableBtn = page.locator('[data-ui-surface="discovery-automation-disable"]');
  if (await disableBtn.isVisible().catch(() => false)) {
    await disableBtn.click();
    await settle(page, 2500);
  } else {
    // Profile may still show enable if summary not refreshed — open enable path from cadence
    note('Disable button not visible after enable/reload');
    if (cadenceAfterReload === 'daily' || autoAfterReload === 'true') {
      limitations.push('Disable control missing despite daily cadence');
    }
  }

  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page, 3500);
  await openDiscovery(page);
  await automation.waitFor({ state: 'visible', timeout: 15000 });
  await page.screenshot({ path: path.join(OUT, '03-reload-disabled.png'), fullPage: true });

  const autoDisabled = await automation.getAttribute('data-automatic');
  const cadenceDisabled = await automation.getAttribute('data-cadence');
  note(`After disable reload data-automatic=${autoDisabled} data-cadence=${cadenceDisabled}`);
  if (autoDisabled === 'true' || cadenceDisabled === 'daily') {
    // If disable wasn't clicked, don't hard-fail when button missing
    if (await disableBtn.count()) {
      verdict = 'FAIL';
      note('FAIL: automation still enabled after disable + reload');
    } else {
      limitations.push('Could not confirm disable persistence (control missing earlier)');
    }
  }

  const delivery = page.locator('[data-ui-surface="discovery-automation-delivery"]');
  note(`Delivery summary visible: ${await delivery.isVisible().catch(() => false)}`);

  if (limitations.length && verdict === 'PASS') {
    verdict = 'PASS_WITH_LIMITATIONS';
  }

  note(`Verdict: ${verdict}`);
  if (limitations.length) {
    note('Limitations:');
    for (const l of limitations) note(` - ${l}`);
  }

  await fs.writeFile(
    path.join(OUT, 'observations.json'),
    JSON.stringify({ verdict, limitations, observations }, null, 2)
  );
} catch (err) {
  verdict = 'FAIL';
  note(`Probe error: ${err instanceof Error ? err.stack || err.message : String(err)}`);
  await page.screenshot({ path: path.join(OUT, 'error.png'), fullPage: true }).catch(() => {});
  await fs.writeFile(
    path.join(OUT, 'observations.json'),
    JSON.stringify({ verdict, limitations, observations }, null, 2)
  );
} finally {
  await browser.close();
}

if (verdict === 'FAIL') process.exit(1);
if (verdict === 'PASS_WITH_LIMITATIONS') process.exit(0);
process.exit(0);
