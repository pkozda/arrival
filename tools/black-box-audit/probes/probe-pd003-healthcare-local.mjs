/**
 * PD-003 Healthcare progressive enrichment — local browser validation.
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUT = path.join(ROOT, 'tools/black-box-audit/artifacts/pd003-healthcare');

await fs.mkdir(OUT, { recursive: true });

const observations = [];
const executeResponses = [];

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
    response.url().includes('/api/modules/healthcare-navigation/execute') &&
    response.request().method() === 'POST'
  ) {
    try {
      const json = await response.json();
      executeResponses.push({
        status: response.status(),
        outcome: json?.projection?.outcome ?? null,
        insuranceAssumption: json?.projection?.insuranceAssumption ?? null,
        recommendationCount: json?.projection?.recommendations?.length ?? 0,
        missing: json?.projection?.missingContext ?? [],
      });
    } catch {
      executeResponses.push({ status: response.status(), parseError: true });
    }
  }
});

async function settle(ms = 1500) {
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

try {
  note(`PD-003 browser validation @ ${BASE_URL}`);

  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await settle(2000);

  await page.getByRole('button', { name: /Українська/i }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /Продовжити/i }).click();
  await settle(1000);
  await page.getByRole('button', { name: /Що далі протягом 7 днів/i }).click();
  await settle(2500);

  await page.goto(`${BASE_URL}/modules/healthcare-navigation`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await settle(3000);

  // Leave insurance unset (Not provided) — only set situation.
  await page.locator('#situation').selectOption('need-doctor');
  await page.locator('#insuranceType').selectOption('').catch(() => {});
  // Ensure hasInsurance checkbox remains unchecked (optional → omitted).

  await page.screenshot({ path: path.join(OUT, '01-before-more-info.png'), fullPage: true });
  await page.getByRole('button', { name: /Отримати|Get guidance|Beratung|рекомендац/i }).click();
  await settle(3000);
  await page.screenshot({ path: path.join(OUT, '02-after-more-info.png'), fullPage: true });

  const moreInfoVisible = await page
    .locator('[data-module-outcome="MORE_INFO_REQUIRED"]')
    .isVisible()
    .catch(() => false);
  note(`MORE_INFO_REQUIRED UI visible: ${moreInfoVisible}`);
  note(`execute after situation-only: ${JSON.stringify(executeResponses.slice(-1)[0] ?? null)}`);

  // Sufficient context → RECOMMENDATIONS
  await page.locator('#hasInsurance').check();
  await page.locator('#insuranceType').selectOption('public');
  await page.getByRole('button', { name: /Отримати|Get guidance|Beratung|рекомендац/i }).click();
  await settle(3000);
  await page.screenshot({ path: path.join(OUT, '03-after-recommendations.png'), fullPage: true });

  const recommendationsVisible = await page
    .locator('[data-module-outcome="RECOMMENDATIONS"]')
    .isVisible()
    .catch(() => false);
  note(`RECOMMENDATIONS UI visible: ${recommendationsVisible}`);
  note(`execute after insurance known: ${JSON.stringify(executeResponses.slice(-1)[0] ?? null)}`);

  // Persistence via profile
  await page.goto(`${BASE_URL}/profile/health-insurance/edit`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await settle(1500);
  const coverage = page.locator('#profile-field-hasCoverage').first();
  if (await coverage.isVisible().catch(() => false)) {
    if (!(await coverage.isChecked().catch(() => false))) {
      await coverage.check().catch(() => {});
    }
  }
  const typeField = page.locator('#profile-field-insuranceType').first();
  if (await typeField.isVisible().catch(() => false)) {
    await typeField.selectOption('public').catch(() => {});
  }
  const save = page.getByRole('button', { name: /Зберегти|Save|Speichern|Сохранить/i }).first();
  if (await save.isVisible().catch(() => false)) {
    await save.click();
    await settle(2500);
    note('profile insurance save attempted');
  }

  await page.goto(`${BASE_URL}/modules/healthcare-navigation`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await settle(2000);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(2500);
  await page.screenshot({ path: path.join(OUT, '04-after-reload.png'), fullPage: true });
  note('reload completed');

  const lastMoreInfo = executeResponses.find((entry) => entry.outcome === 'MORE_INFO_REQUIRED');
  const lastRecommendations = [...executeResponses]
    .reverse()
    .find((entry) => entry.outcome === 'RECOMMENDATIONS');

  const pass =
    Boolean(lastMoreInfo) &&
    lastMoreInfo.recommendationCount === 0 &&
    moreInfoVisible &&
    Boolean(lastRecommendations) &&
    lastRecommendations.recommendationCount > 0 &&
    recommendationsVisible;

  note(`observed outcomes: ${[...new Set(executeResponses.map((e) => e.outcome))].join(', ')}`);
  note(`VERDICT: ${pass ? 'BROWSER PASS' : 'BROWSER FAIL'}`);

  await fs.writeFile(
    path.join(OUT, 'observations.json'),
    JSON.stringify({ observations, pass, executeResponses }, null, 2)
  );
  if (!pass) process.exitCode = 1;
} catch (error) {
  note(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
  await page.screenshot({ path: path.join(OUT, 'error.png'), fullPage: true }).catch(() => {});
  await fs.writeFile(
    path.join(OUT, 'observations.json'),
    JSON.stringify({ observations, executeResponses, error: String(error) }, null, 2)
  );
  process.exitCode = 1;
} finally {
  await browser.close();
}
