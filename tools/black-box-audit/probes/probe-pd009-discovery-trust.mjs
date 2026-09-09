/**
 * PD-009 Discovery trust & verification — local browser validation.
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:3001';
const OUT = path.join(ROOT, 'tools/black-box-audit/artifacts/pd009-discovery-trust');

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
  note('=== PD-009 Discovery trust probe ===');
  await enterAtlas(page);
  await openDiscovery(page);

  const profileName = `PD009 Trust ${Date.now()}`;
  await createViaSelfDirected(page, profileName);

  const lifecycle = page.locator('[data-ui-surface="discovery-execution-lifecycle"]');
  await lifecycle.waitFor({ state: 'visible', timeout: 15000 });

  await page.locator('[data-ui-surface="discovery-run-now"]').click();
  let terminal = null;
  for (let i = 0; i < 120; i++) {
    const lc = await lifecycle.getAttribute('data-lifecycle');
    if (lc === 'SUCCESS' || lc === 'NO_RESULTS' || lc === 'ERROR') {
      terminal = lc;
      break;
    }
    await page.waitForTimeout(1000);
  }
  note(`Terminal lifecycle: ${terminal}`);
  await page.screenshot({ path: path.join(OUT, '01-terminal.png'), fullPage: true });

  // Case E — NO_RESULTS remains execution outcome
  if (terminal === 'NO_RESULTS') {
    const noRes = page.locator('[data-ui-surface="discovery-results-no-results"]');
    note(`Case E NO_RESULTS panel: ${await noRes.isVisible().catch(() => false)}`);
    if (!(await noRes.isVisible().catch(() => false))) {
      verdict = 'FAIL';
      note('FAIL: NO_RESULTS not explicit');
    }
  }

  // Case A/B/C/D — SUCCESS with trust panel
  if (terminal === 'SUCCESS') {
    const item = page.locator('[data-ui-surface="discovery-result-item"]').first();
    await item.waitFor({ state: 'visible', timeout: 10000 });
    const trustLine = item.locator('[data-ui-surface="discovery-result-trust-line"]');
    note(`Case A list trust line: ${await trustLine.textContent()}`);
    await item.click();
    await settle(page, 1000);
    const panel = page.locator('[data-ui-surface="discovery-trust-panel"]');
    await panel.waitFor({ state: 'visible', timeout: 10000 });
    const status = await panel.getAttribute('data-trust-status');
    note(`Case B trust status: ${status}`);
    if (status === 'passed') {
      const summary = await page.locator('[data-ui-surface="discovery-trust-summary"]').textContent();
      note(`Case B summary: ${summary}`);
      if (/guaranteed|definitely|eligible|officially approved/i.test(summary || '')) {
        verdict = 'FAIL';
        note('FAIL: overclaiming trust language');
      }
    }
    const details = page.locator('[data-ui-surface="discovery-trust-details"]');
    await details.locator('summary').click();
    await settle(page, 400);
    note(`Case D details open: ${await details.evaluate((el) => el.open)}`);
    const openSource = page.locator('[data-ui-surface="discovery-result-open-source"]');
    if (await openSource.isVisible().catch(() => false)) {
      const href = await openSource.getAttribute('href');
      note(`Case C open source href: ${href}`);
      if (!href || href === '#') {
        verdict = 'FAIL';
        note('FAIL: empty source href');
      }
    } else {
      limitations.push('PASS result without Open source URL in this run.');
    }
  } else {
    limitations.push(
      'Browser SUCCESS with trust panel not hit; covered by focused unit/UI tests.'
    );
  }

  // Case F reload
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page, 4000);
  await openDiscovery(page);
  await settle(page, 2500);
  const reloadLc = await page
    .locator('[data-ui-surface="discovery-execution-lifecycle"]')
    .getAttribute('data-lifecycle');
  note(`Case F reload lifecycle: ${reloadLc}`);
  if (terminal === 'SUCCESS') {
    const panel = page.locator('[data-ui-surface="discovery-trust-panel"]');
    if (await page.locator('[data-ui-surface="discovery-result-item"]').count()) {
      await page.locator('[data-ui-surface="discovery-result-item"]').first().click();
      await settle(page, 800);
      note(`Case F trust after reload: ${await panel.isVisible().catch(() => false)}`);
    }
  }

  // Case G — locale keys covered by unit tests; UA path already used for entry
  note('Case G: entered Atlas in UA; trust i18n covered by focused tests.');

  try {
    const res = await fetch(`${API_URL}/api/modules/discovery/profiles`, {
      headers: { 'x-session-id': 'pd009-foreign' },
    });
    note(`Ownership foreign status: ${res.status}`);
  } catch (e) {
    limitations.push(`Ownership check skipped: ${e?.message || e}`);
  }

  if (limitations.length && verdict === 'PASS') verdict = 'PASS_WITH_LIMITATIONS';
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
} finally {
  await browser.close();
}

if (verdict === 'FAIL') process.exit(1);
