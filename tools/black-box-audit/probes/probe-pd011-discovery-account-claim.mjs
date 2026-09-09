/**
 * PD-011 Discovery account claim & durable continuity — local browser validation.
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:3001';
const OUT = path.join(ROOT, 'tools/black-box-audit/artifacts/pd011-discovery-account-claim');

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
let branch = 'unknown';

try {
  note('=== PD-011 Discovery account claim probe ===');

  const apiHealth = await fetch(`${API_URL}/health`).catch(() => null);
  if (!apiHealth?.ok) {
    note(`API health failed at ${API_URL}/health`);
    limitations.push('API not reachable');
  }

  await enterAtlas(page);
  await openDiscovery(page);

  const profileName = `PD011 Claim ${Date.now()}`;
  await createViaSelfDirected(page, profileName);

  const disclosure = page.locator('[data-ui-surface="discovery-persistence-disclosure"]');
  await disclosure.waitFor({ state: 'visible', timeout: 15000 });
  const scopeBefore = await disclosure.getAttribute('data-persistence-scope');
  note(`Ownership scope before claim: ${scopeBefore}`);
  if (scopeBefore !== 'session') {
    branch = 'already-account';
    note('Session already account-scoped — verifying account disclosure only');
    const accountExplain = page.locator('[data-ui-surface="discovery-continuity-account"]');
    note(`Account continuity visible: ${await accountExplain.isVisible().catch(() => false)}`);
  } else {
    branch = 'session-claim';
    const claimBtn = page.locator('[data-ui-surface="discovery-continuity-claim"]');
    const claimVisible = await claimBtn.isVisible().catch(() => false);
    note(`Claim CTA visible: ${claimVisible}`);
    if (!claimVisible) {
      verdict = 'FAIL';
      note('FAIL: session scope without claim CTA');
    } else {
      // Enable automation first so post-claim schedule continuity is visible
      const enableAuto = page.locator('[data-ui-surface="discovery-automation-enable"]');
      if (await enableAuto.isVisible().catch(() => false)) {
        await enableAuto.click();
        await settle(page, 2000);
        note('Enabled daily automation before claim');
      }

      await page.reload({ waitUntil: 'domcontentloaded' });
      await settle(page, 3000);
      await openDiscovery(page);
      const scopeReload = await page
        .locator('[data-ui-surface="discovery-persistence-disclosure"]')
        .getAttribute('data-persistence-scope');
      note(`Scope after session reload (pre-claim): ${scopeReload}`);
      if (scopeReload !== 'session') {
        verdict = 'FAIL';
        note('FAIL: session ownership disclosure changed without claim');
      }

      await page.locator('[data-ui-surface="discovery-continuity-claim"]').click();
      await settle(page, 3000);
      await page.screenshot({ path: path.join(OUT, '01-after-claim.png'), fullPage: true });

      const scopeAfter = await page
        .locator('[data-ui-surface="discovery-persistence-disclosure"]')
        .getAttribute('data-persistence-scope');
      note(`Ownership scope after claim: ${scopeAfter}`);
      if (scopeAfter !== 'account') {
        const err = page.locator('[data-ui-surface="discovery-continuity-error"]');
        const errText = (await err.textContent().catch(() => null))?.trim();
        note(`Claim error text: ${errText ?? 'none'}`);
        verdict = 'FAIL';
        note('FAIL: claim did not transition to account ownership in UI');
      } else {
        note('Claim branch: visible ownership transition to account');
        const success = page.locator('[data-ui-surface="discovery-continuity-account"]');
        note(`Account continuity panel: ${await success.isVisible().catch(() => false)}`);

        await page.reload({ waitUntil: 'domcontentloaded' });
        await settle(page, 3500);
        await openDiscovery(page);
        const scopePersist = await page
          .locator('[data-ui-surface="discovery-persistence-disclosure"]')
          .getAttribute('data-persistence-scope');
        note(`Scope after reload: ${scopePersist}`);
        if (scopePersist !== 'account') {
          verdict = 'FAIL';
          note('FAIL: account ownership did not survive reload');
        }

        const auto = page.locator('[data-ui-surface="discovery-automation"]');
        if (await auto.isVisible().catch(() => false)) {
          note(
            `Automation after claim data-automatic=${await auto.getAttribute('data-automatic')} data-cadence=${await auto.getAttribute('data-cadence')}`
          );
        }

        const profileCount = await page.locator('[data-ui-surface="discovery-profile-item"]').count().catch(() => 0);
        note(`Profile items after claim: ${profileCount}`);
        // Ensure we did not explode into duplicates of the created profile name
        const nameMatches = await page.getByText(profileName, { exact: false }).count();
        note(`Profile name matches: ${nameMatches}`);
      }
    }
  }

  await page.screenshot({ path: path.join(OUT, '02-final.png'), fullPage: true });

  if (limitations.length && verdict === 'PASS') {
    verdict = 'PASS_WITH_LIMITATIONS';
  }

  note(`Branch exercised: ${branch}`);
  note(`Verdict: ${verdict}`);
  if (limitations.length) {
    note('Limitations:');
    for (const l of limitations) note(` - ${l}`);
  }

  await fs.writeFile(
    path.join(OUT, 'observations.json'),
    JSON.stringify({ verdict, branch, limitations, observations }, null, 2)
  );
} catch (err) {
  verdict = 'FAIL';
  note(`Probe error: ${err instanceof Error ? err.stack || err.message : String(err)}`);
  await page.screenshot({ path: path.join(OUT, 'error.png'), fullPage: true }).catch(() => {});
  await fs.writeFile(
    path.join(OUT, 'observations.json'),
    JSON.stringify({ verdict, branch, limitations, observations }, null, 2)
  );
} finally {
  await browser.close();
}

if (verdict === 'FAIL') process.exit(1);
process.exit(0);
