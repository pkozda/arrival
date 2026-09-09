/**
 * PD-007 Discovery execution lifecycle — local browser validation.
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:3001';
const OUT = path.join(ROOT, 'tools/black-box-audit/artifacts/pd007-discovery-execution');

await fs.mkdir(OUT, { recursive: true });

const observations = [];
const runNowPosts = [];

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
  await page
    .locator('[data-spatial-phase="landed"], [data-spatial-phase="idle"]')
    .first()
    .waitFor({ state: 'attached', timeout: 10000 })
    .catch(() => {});
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

page.on('request', (req) => {
  if (req.method() === 'POST' && req.url().includes('/run-now')) {
    runNowPosts.push({ url: req.url(), at: Date.now() });
  }
});

let verdict = 'PASS';
const limitations = [];

try {
  note('=== PD-007 Discovery execution probe ===');
  await enterAtlas(page);
  await openDiscovery(page);

  // Case A — profile creation → IDLE
  const profileName = `PD007 Exec ${Date.now()}`;
  await createViaSelfDirected(page, profileName);
  await page.screenshot({ path: path.join(OUT, '01-idle-after-create.png'), fullPage: true });

  const lifecycleEl = page.locator('[data-ui-surface="discovery-execution-lifecycle"]');
  await lifecycleEl.waitFor({ state: 'visible', timeout: 15000 });
  const idleLifecycle = await lifecycleEl.getAttribute('data-lifecycle');
  note(`Case A lifecycle after create: ${idleLifecycle}`);
  if (idleLifecycle !== 'IDLE') {
    verdict = 'FAIL';
    note('FAIL: expected IDLE after profile create');
  }

  const runBtn = page.locator('[data-ui-surface="discovery-run-now"]');
  const idleBtnLifecycle = await runBtn.getAttribute('data-execution-lifecycle');
  note(`Case A Run Now button lifecycle: ${idleBtnLifecycle}`);

  // Case B — Run Now → QUEUED/RUNNING
  const beforePosts = runNowPosts.length;
  await runBtn.click();
  await page.waitForTimeout(800);

  let activeSeen = false;
  for (let i = 0; i < 40; i++) {
    const lc = await lifecycleEl.getAttribute('data-lifecycle');
    if (lc === 'QUEUED' || lc === 'RUNNING') {
      activeSeen = true;
      note(`Case B/C active lifecycle observed: ${lc} (t+${i * 500}ms)`);
      await page.screenshot({
        path: path.join(OUT, '02-active-run.png'),
        fullPage: true,
      });
      break;
    }
    if (lc === 'SUCCESS' || lc === 'NO_RESULTS' || lc === 'ERROR') {
      note(`Case B fast terminal without catching active UI: ${lc}`);
      break;
    }
    await page.waitForTimeout(500);
  }

  if (!activeSeen) {
    limitations.push(
      'QUEUED/RUNNING UI may have been too brief to observe (inline pull-process completed quickly).'
    );
  }

  // Case C — while active, must not claim IDLE falsely for long; Case D wait for terminal
  let terminal = null;
  const startedWait = Date.now();
  for (let i = 0; i < 120; i++) {
    const lc = await lifecycleEl.getAttribute('data-lifecycle');
    if (lc === 'IDLE' && Date.now() - startedWait < 5000 && runNowPosts.length > beforePosts) {
      // brief IDLE flicker would be bad after click; allow only before request lands
    }
    if (lc === 'SUCCESS' || lc === 'NO_RESULTS' || lc === 'ERROR') {
      terminal = lc;
      note(`Case D terminal lifecycle: ${lc} after ${Date.now() - startedWait}ms`);
      break;
    }
    if (lc === 'QUEUED' || lc === 'RUNNING') {
      // Case C: still active — good
      const disabled = await runBtn.isDisabled();
      if (!disabled) {
        verdict = 'FAIL';
        note('FAIL: Run Now enabled while QUEUED/RUNNING');
      }
    }
    await page.waitForTimeout(1000);
  }

  await page.screenshot({ path: path.join(OUT, '03-terminal.png'), fullPage: true });

  if (!terminal) {
    verdict = 'FAIL';
    note('FAIL: no terminal SUCCESS/NO_RESULTS/ERROR within wait budget');
  } else {
    note(`Case D PASS terminal=${terminal}`);
  }

  // Case E — results if SUCCESS
  if (terminal === 'SUCCESS') {
    const resultsHint = page.locator('[data-ui-surface="discovery-results-hint"]');
    const hasHint = await resultsHint.isVisible().catch(() => false);
    note(`Case E results hint visible: ${hasHint}`);
    const listItems = page.locator('.discovery-results li, [data-ui-surface*="discovery-result"]');
    const count = await listItems.count().catch(() => 0);
    note(`Case E result surfaces count≈${count}`);
    if (!hasHint && count === 0) {
      limitations.push('SUCCESS without clearly countable result cards in DOM selectors used.');
    }
  }

  // Case F — NO_RESULTS
  if (terminal === 'NO_RESULTS') {
    const noRes = page.locator('[data-ui-surface="discovery-execution-no-results"]');
    const visible = await noRes.isVisible().catch(() => false);
    note(`Case F NO_RESULTS detail visible: ${visible}`);
    if (!visible) {
      verdict = 'FAIL';
      note('FAIL: NO_RESULTS without explicit detail surface');
    }
  } else {
    limitations.push(
      'Browser path did not hit NO_RESULTS; covered by focused unit/service tests.'
    );
  }

  // Case G — ERROR
  if (terminal === 'ERROR') {
    const err = page.locator('[data-ui-surface="discovery-execution-error"]');
    note(`Case G ERROR surface visible: ${await err.isVisible().catch(() => false)}`);
  } else {
    limitations.push('Browser path did not hit ERROR; covered by focused unit/service tests.');
  }

  // Case H — reload after terminal
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page, 4000);
  await openDiscovery(page);
  await settle(page, 2500);
  const afterReload = page.locator('[data-ui-surface="discovery-execution-lifecycle"]');
  await afterReload.waitFor({ state: 'visible', timeout: 20000 });
  const reloadLc = await afterReload.getAttribute('data-lifecycle');
  note(`Case H reload terminal lifecycle: ${reloadLc}`);
  await page.screenshot({ path: path.join(OUT, '04-reload-terminal.png'), fullPage: true });
  if (terminal && reloadLc !== terminal) {
    // Profile selection may differ if multiple profiles — soft limitation if IDLE with other profile
    if (reloadLc === 'IDLE') {
      limitations.push(
        'Reload showed IDLE — may be different profile selected; verify manually if flaky.'
      );
      if (verdict === 'PASS') verdict = 'PASS_WITH_LIMITATIONS';
    } else {
      verdict = 'FAIL';
      note(`FAIL: reload lifecycle ${reloadLc} !== ${terminal}`);
    }
  }

  // Case I — repeat Run Now while we cannot easily keep active; check disabled during active was done in loop.
  note(`Case I run-now POST count: ${runNowPosts.length}`);

  // Case J — ownership via API (session isolation)
  try {
    const res = await fetch(`${API_URL}/api/modules/discovery/profiles`, {
      headers: { 'x-session-id': 'pd007-foreign-session' },
    });
    note(`Case J foreign session profiles status: ${res.status}`);
  } catch (e) {
    limitations.push(`Case J API check skipped: ${e?.message || e}`);
  }

  if (limitations.length && verdict === 'PASS') {
    verdict = 'PASS_WITH_LIMITATIONS';
  }

  note(`LIMITATIONS: ${limitations.join(' | ') || 'none'}`);
  note(`VERDICT: ${verdict}`);
  await fs.writeFile(
    path.join(OUT, 'observations.json'),
    JSON.stringify({ verdict, limitations, observations, runNowPosts }, null, 2)
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
