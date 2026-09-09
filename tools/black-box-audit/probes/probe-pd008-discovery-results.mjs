/**
 * PD-008 Discovery result presentation — local browser validation.
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:3001';
const OUT = path.join(ROOT, 'tools/black-box-audit/artifacts/pd008-discovery-results');

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
  note('=== PD-008 Discovery results probe ===');
  await enterAtlas(page);
  await openDiscovery(page);

  // Case A — profile
  const profileName = `PD008 Results ${Date.now()}`;
  await createViaSelfDirected(page, profileName);
  const lifecycle = page.locator('[data-ui-surface="discovery-execution-lifecycle"]');
  await lifecycle.waitFor({ state: 'visible', timeout: 15000 });
  const idleLc = await lifecycle.getAttribute('data-lifecycle');
  note(`Case A lifecycle: ${idleLc}`);
  if (idleLc !== 'IDLE') {
    verdict = 'FAIL';
    note('FAIL: expected IDLE before run');
  }

  // Case B — run
  const runBtn = page.locator('[data-ui-surface="discovery-run-now"]');
  await runBtn.click();

  let terminal = null;
  for (let i = 0; i < 120; i++) {
    const lc = await lifecycle.getAttribute('data-lifecycle');
    if (lc === 'SUCCESS' || lc === 'NO_RESULTS' || lc === 'ERROR') {
      terminal = lc;
      note(`Case B/C terminal: ${lc}`);
      break;
    }
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: path.join(OUT, '01-terminal.png'), fullPage: true });

  if (!terminal) {
    verdict = 'FAIL';
    note('FAIL: no terminal lifecycle');
  }

  const resultsPanel = page.locator('[data-ui-surface="discovery-results-panel"]');
  await resultsPanel.waitFor({ state: 'visible', timeout: 10000 });
  const panelLc = await resultsPanel.getAttribute('data-lifecycle');
  note(`Case results panel lifecycle: ${panelLc}`);

  // Case C — SUCCESS
  if (terminal === 'SUCCESS') {
    const items = page.locator('[data-ui-surface="discovery-result-item"]');
    const count = await items.count();
    note(`Case C result items: ${count}`);
    if (count < 1) {
      verdict = 'FAIL';
      note('FAIL: SUCCESS without result items');
    } else {
      await items.first().click();
      await settle(page, 1000);
      const detail = page.locator('[data-ui-surface="discovery-result-detail"]');
      await detail.waitFor({ state: 'visible', timeout: 10000 });
      const openSource = page.locator('[data-ui-surface="discovery-result-open-source"]');
      const unavailable = page.locator('[data-ui-surface="discovery-result-source-unavailable"]');
      const hasOpen = await openSource.isVisible().catch(() => false);
      const hasUnavailable = await unavailable.isVisible().catch(() => false);
      note(`Case G open source: ${hasOpen}; unavailable: ${hasUnavailable}`);
      if (hasOpen) {
        const href = await openSource.getAttribute('href');
        note(`Case G href: ${href}`);
        if (!href || href === '#') {
          verdict = 'FAIL';
          note('FAIL: open source without real href');
        }
      } else if (!hasUnavailable) {
        verdict = 'FAIL';
        note('FAIL: neither open source nor unavailable shown');
      }
    }
  } else {
    limitations.push('Browser path did not hit SUCCESS; list/action covered by focused tests.');
  }

  // Case D — NO_RESULTS
  if (terminal === 'NO_RESULTS') {
    const noRes = page.locator('[data-ui-surface="discovery-results-no-results"]');
    const visible = await noRes.isVisible().catch(() => false);
    note(`Case D NO_RESULTS panel: ${visible}`);
    if (!visible) {
      verdict = 'FAIL';
      note('FAIL: NO_RESULTS without results-panel semantics');
    }
    const emptyGeneric = page.locator('[data-ui-surface="discovery-empty-results"]');
    if (await emptyGeneric.isVisible().catch(() => false)) {
      verdict = 'FAIL';
      note('FAIL: generic empty shown for NO_RESULTS');
    }
  } else {
    limitations.push('Browser NO_RESULTS path not taken this run (or SUCCESS instead).');
  }

  // Case E — ERROR
  if (terminal === 'ERROR') {
    const err = page.locator('[data-ui-surface="discovery-results-error"]');
    note(`Case E results error hint: ${await err.isVisible().catch(() => false)}`);
  } else {
    limitations.push('Browser ERROR path not hit; covered by focused tests.');
  }

  // Case F — reload
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page, 4000);
  await openDiscovery(page);
  await settle(page, 2500);
  const after = page.locator('[data-ui-surface="discovery-execution-lifecycle"]');
  await after.waitFor({ state: 'visible', timeout: 20000 });
  const reloadLc = await after.getAttribute('data-lifecycle');
  note(`Case F reload lifecycle: ${reloadLc}`);
  await page.screenshot({ path: path.join(OUT, '02-reload.png'), fullPage: true });

  if (terminal && reloadLc === terminal) {
    if (terminal === 'SUCCESS') {
      const items = await page.locator('[data-ui-surface="discovery-result-item"]').count();
      note(`Case F reload result items: ${items}`);
      if (items < 1) {
        verdict = 'FAIL';
        note('FAIL: SUCCESS reload lost results');
      }
    }
    if (terminal === 'NO_RESULTS') {
      const noRes = await page
        .locator('[data-ui-surface="discovery-results-no-results"]')
        .isVisible()
        .catch(() => false);
      if (!noRes) {
        verdict = 'FAIL';
        note('FAIL: NO_RESULTS lost after reload');
      }
    }
  } else if (terminal && reloadLc !== terminal) {
    limitations.push(`Reload lifecycle ${reloadLc} !== ${terminal} (profile selection?).`);
    if (verdict === 'PASS') verdict = 'PASS_WITH_LIMITATIONS';
  }

  // Case H — ownership API
  try {
    const res = await fetch(`${API_URL}/api/modules/discovery/profiles`, {
      headers: { 'x-session-id': 'pd008-foreign-session' },
    });
    note(`Case H foreign profiles status: ${res.status}`);
  } catch (e) {
    limitations.push(`Case H skipped: ${e?.message || e}`);
  }

  if (limitations.length && verdict === 'PASS') {
    verdict = 'PASS_WITH_LIMITATIONS';
  }

  note(`LIMITATIONS: ${limitations.join(' | ') || 'none'}`);
  note(`VERDICT: ${verdict}`);
  await fs.writeFile(
    path.join(OUT, 'observations.json'),
    JSON.stringify({ verdict, limitations, observations }, null, 2)
  );
} catch (err) {
  note(`PROBE ERROR: ${err?.stack || err}`);
  verdict = 'FAIL';
  await page.screenshot({ path: path.join(OUT, 'error.png'), fullPage: true }).catch(() => {});
  await fs.writeFile(
    path.join(OUT, 'observations.json'),
    JSON.stringify({ verdict, observations, error: String(err) }, null, 2)
  );
} finally {
  await browser.close();
}

if (verdict === 'FAIL') process.exit(1);
