/**
 * PD-004 Employment dual track — local browser validation.
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUT = path.join(ROOT, 'tools/black-box-audit/artifacts/pd004-employment');

await fs.mkdir(OUT, { recursive: true });

const observations = [];

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

async function settle(ms = 1500) {
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

try {
  note(`PD-004 browser validation @ ${BASE_URL}`);

  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await settle(2000);

  await page.getByRole('button', { name: /Українська/i }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /Продовжити/i }).click();
  await settle(1000);
  await page.getByRole('button', { name: /Що далі протягом 7 днів/i }).click();
  await settle(2500);

  // Case A — Work & Growth → Employment
  // Prefer direct Employment entry after Atlas session start; also try Work slide CTA.
  const workNode = page.locator('[data-node-id="work"], button:has-text("Work"), [aria-label*="Work"]').first();
  if (await workNode.isVisible().catch(() => false)) {
    await workNode.click().catch(() => {});
    await settle(1000);
  }

  const employmentCta = page.locator('a[href="/modules/employment"]').first();
  if (await employmentCta.isVisible().catch(() => false)) {
    await employmentCta.click();
    await settle(2500);
  } else {
    await page.goto(`${BASE_URL}/modules/employment`, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    await settle(2500);
    note('Work & Growth CTA not visible in session; used direct /modules/employment entry');
  }

  await page.screenshot({ path: path.join(OUT, '01-employment-landing.png'), fullPage: true });

  const onEmployment = page.url().includes('/modules/employment');
  const employmentSurface = await page
    .locator('[data-ui-surface="employment-dual-track"]')
    .isVisible()
    .catch(() => false);
  const redirectedToLifeEvent = page.url().includes('/modules/life-event');
  note(`Case A on Employment: ${onEmployment}, surface: ${employmentSurface}, life-event redirect: ${redirectedToLifeEvent}`);

  // Case B — two tracks
  const workIncomeTrack = await page.locator('[data-track="work-income"]').isVisible();
  const jobSearchTrack = await page.locator('[data-track="job-search"]').isVisible();
  note(`Case B tracks visible workIncome=${workIncomeTrack} jobSearch=${jobSearchTrack}`);

  // Case C — current state (default: not provided / not unemployed)
  const situationKind = await page
    .locator('[data-ui-surface="employment-dual-track"]')
    .getAttribute('data-situation-kind');
  const summaryText = (await page.locator('[data-work-income-summary]').innerText()).trim();
  const falselyUnemployed =
    /unemployed|безробіт|безработ/i.test(summaryText) && situationKind === 'not_provided';
  note(`Case C situationKind=${situationKind}; summary="${summaryText}"; falselyUnemployed=${falselyUnemployed}`);

  // Case D — Job Search → Discovery
  const discoveryRequests = [];
  page.on('request', (req) => {
    if (req.url().includes('/api/modules/discovery') && req.method() === 'POST') {
      discoveryRequests.push({ method: req.method(), url: req.url() });
    }
  });

  // Wait for spatial arrival chrome to settle so navigation is reliable.
  await page
    .locator('[data-spatial-phase="landed"], [data-spatial-phase="idle"]')
    .first()
    .waitFor({ state: 'attached', timeout: 10000 })
    .catch(() => {});
  await page.waitForTimeout(800);

  const jobSearchHref = await page.locator('[data-cta="job-search"]').first().getAttribute('href').catch(() => null);
  const jobSearchTag = await page.locator('[data-cta="job-search"]').first().evaluate((el) => el.tagName).catch(() => 'missing');
  note(`Case D CTA tag=${jobSearchTag} href=${jobSearchHref}`);

  try {
    await Promise.all([
      page.waitForURL(/\/modules\/discovery/, { timeout: 20000 }),
      page.locator('[data-cta="job-search"]').first().click({ force: true }),
    ]);
    note('Case D CTA click navigated to Discovery');
  } catch (error) {
    note(`Case D CTA click failed: ${error instanceof Error ? error.message : String(error)}`);
    // Diagnostic only — do not count as product success.
    await page.screenshot({ path: path.join(OUT, '02-discovery-handoff-failed.png'), fullPage: true });
  }
  await settle(2500);
  await page.screenshot({ path: path.join(OUT, '02-discovery-handoff.png'), fullPage: true });

  const onDiscovery = page.url().includes('/modules/discovery');
  const discoverySurface = await page
    .locator('[data-ui-surface="discovery-module-body"], [data-ui-surface="discovery-galaxy"]')
    .first()
    .isVisible()
    .catch(() => false);
  const discoveryTitle = await page
    .locator('h1')
    .filter({ hasText: /Discovery|Відкриття|Entdeckung/i })
    .first()
    .isVisible()
    .catch(() => false);
  note(
    `Case D discovery url=${onDiscovery} surface=${discoverySurface || discoveryTitle} fakeRunPosts=${discoveryRequests.length} finalUrl=${page.url()}`
  );

  // Case E — return + reload honesty
  await page.goto(`${BASE_URL}/modules/employment`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await settle(2000);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(2500);
  await page.screenshot({ path: path.join(OUT, '03-employment-reload.png'), fullPage: true });

  const afterReload = await page.locator('[data-ui-surface="employment-dual-track"]').isVisible();
  const claimsRun = await page
    .locator('[data-ui-surface="employment-dual-track"]')
    .getAttribute('data-claims-discovery-run');
  note(`Case E after reload surface=${afterReload} claimsDiscoveryRun=${claimsRun}`);

  const pass =
    onEmployment &&
    employmentSurface &&
    !redirectedToLifeEvent &&
    workIncomeTrack &&
    jobSearchTrack &&
    situationKind === 'not_provided' &&
    !falselyUnemployed &&
    onDiscovery &&
    (discoverySurface || discoveryTitle) &&
    discoveryRequests.length === 0 &&
    afterReload &&
    claimsRun === 'false';

  note(`observed outcomes: entry, dual-tracks, not_provided, discovery-handoff, reload-honest`);
  note(`VERDICT: ${pass ? 'BROWSER PASS' : 'BROWSER FAIL'}`);

  await fs.writeFile(
    path.join(OUT, 'observations.json'),
    JSON.stringify({ observations, pass }, null, 2)
  );

  await browser.close();
  process.exit(pass ? 0 : 1);
} catch (error) {
  note(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
  await page.screenshot({ path: path.join(OUT, 'error.png'), fullPage: true }).catch(() => {});
  await fs.writeFile(
    path.join(OUT, 'observations.json'),
    JSON.stringify({ observations, pass: false }, null, 2)
  );
  await browser.close();
  process.exit(1);
}
