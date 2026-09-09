/**
 * PD-005 Guided Discovery — local browser validation.
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUT = path.join(ROOT, 'tools/black-box-audit/artifacts/pd005-guided-discovery');

await fs.mkdir(OUT, { recursive: true });

const observations = [];
const createPosts = [];
const runNowPosts = [];

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

page.on('request', (req) => {
  if (!req.url().includes('/api/modules/discovery')) return;
  if (req.method() !== 'POST') return;
  if (req.url().includes('/profiles') && !req.url().includes('/run')) {
    createPosts.push(req.url());
  }
  if (req.url().includes('run-now') || req.url().includes('/run')) {
    runNowPosts.push(req.url());
  }
});

async function settle(ms = 1500) {
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

try {
  note(`PD-005 browser validation @ ${BASE_URL}`);

  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await settle(2000);

  await page.getByRole('button', { name: /Українська/i }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /Продовжити/i }).click();
  await settle(1000);
  await page.getByRole('button', { name: /Що далі протягом 7 днів/i }).click();
  await settle(2500);

  // Case A — Discovery entry
  await page.goto(`${BASE_URL}/modules/discovery`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await settle(3500);
  await page
    .locator('[data-spatial-phase="landed"], [data-spatial-phase="idle"]')
    .first()
    .waitFor({ state: 'attached', timeout: 10000 })
    .catch(() => {});

  await page.screenshot({ path: path.join(OUT, '01-discovery-entry.png'), fullPage: true });

  const journeyWelcome = await page.locator('.journey-guide-welcome').isVisible().catch(() => false);
  const chooser = await page.locator('[data-ui-surface="discovery-setup-chooser"]').isVisible();
  const guidedBtn = await page.locator('[data-discovery-setup="guided"]').first().isVisible();
  const selfBtn = await page.locator('[data-discovery-setup="self-directed"]').first().isVisible();
  note(
    `Case A chooser=${chooser} guided=${guidedBtn} self=${selfBtn} journeyWelcome=${journeyWelcome}`
  );

  // Case B — Guided CTA opens Discovery wizard (not Journey Guide)
  await page.locator('[data-discovery-setup="guided"]').first().click();
  await settle(1500);
  await page.screenshot({ path: path.join(OUT, '02-guided-wizard.png'), fullPage: true });

  const wizard = await page.locator('[data-ui-surface="discovery-guided-wizard"]').isVisible();
  const stillJourneyWelcome = await page.locator('.journey-guide-welcome').isVisible().catch(() => false);
  note(`Case B wizard=${wizard} journeyWelcome=${stillJourneyWelcome}`);

  // Case C — Jobs path
  await page.locator('[data-guided-action="start"]').click();
  await settle(500);
  await page.locator('[data-guided-intent="jobs"]').click();
  await settle(300);
  await page.locator('[data-guided-action="next"]').click();
  await settle(500);

  const uniqueName = `PD005 Jobs ${Date.now()}`;
  await page.locator('[data-guided-field="name"]').fill(uniqueName);
  await page.locator('[data-guided-field="country"]').fill('DE');
  await page.locator('[data-guided-field="role"]').fill('Frontend Engineer');
  await page.locator('[data-guided-action="next"]').click();
  await settle(800);
  await page.screenshot({ path: path.join(OUT, '03-review.png'), fullPage: true });

  const reviewText = await page.locator('[data-guided-review]').innerText();
  const reviewOk =
    /Jobs|Робот|Arbeit|Вакан/i.test(reviewText) &&
    reviewText.includes(uniqueName) &&
    reviewText.includes('DE');
  note(`Case C/D reviewOk=${reviewOk} review="${reviewText.replace(/\s+/g, ' ').slice(0, 160)}"`);

  // Case E — Create
  const createsBefore = createPosts.length;
  const runsBefore = runNowPosts.length;
  await page.locator('[data-guided-action="create"]').click();
  await settle(3000);
  await page.screenshot({ path: path.join(OUT, '04-created.png'), fullPage: true });

  const createdStep = (await page.locator('[data-guided-step]').getAttribute('data-guided-step')) === 'created';
  const confirmation = await page.locator('[data-guided-confirmation]').isVisible();
  const confirmationText = confirmation
    ? await page.locator('[data-guided-confirmation]').innerText()
    : '';
  const claimsRun = await page
    .locator('[data-ui-surface="discovery-guided-wizard"]')
    .getAttribute('data-claims-discovery-run');
  const falselyClaimsRun = /run completed|пошук заверш|suche abgeschlossen|поиск заверш/i.test(
    confirmationText
  );
  note(
    `Case E createdStep=${createdStep} confirmation=${confirmation} createPosts=${createPosts.length - createsBefore} runPosts=${runNowPosts.length - runsBefore} claimsRun=${claimsRun} falselyClaimsRun=${falselyClaimsRun}`
  );

  // Case F — Continue
  await page.locator('[data-guided-action="continue"]').click();
  await settle(2000);
  await page.screenshot({ path: path.join(OUT, '05-continued.png'), fullPage: true });
  const profileVisible = await page.getByText(uniqueName).first().isVisible().catch(() => false);
  const wizardClosed = !(await page.locator('[data-ui-surface="discovery-guided-wizard"]').isVisible().catch(() => false));
  note(`Case F profileVisible=${profileVisible} wizardClosed=${wizardClosed}`);

  // Case G — Reload honesty
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(3500);
  await page.screenshot({ path: path.join(OUT, '06-reload.png'), fullPage: true });
  const profileAfterReload = await page.getByText(uniqueName).first().isVisible().catch(() => false);
  const fakeResultsClaim = await page
    .locator('text=/search completed|результатів готовы|Ergebnisse bereit/i')
    .first()
    .isVisible()
    .catch(() => false);
  const noRunsYet = await page
    .locator('text=/No runs yet|Ще не було|Noch keine|Пока не было/i')
    .first()
    .isVisible()
    .catch(() => false);
  note(
    `Case G profileAfterReload=${profileAfterReload} fakeResultsClaim=${fakeResultsClaim} noRunsYet=${noRunsYet}`
  );

  // Case H — Self-directed still available
  const selfDirectedAvailable = await page
    .locator('[data-discovery-setup="self-directed"]')
    .first()
    .isVisible();
  if (selfDirectedAvailable) {
    await page.locator('[data-discovery-setup="self-directed"]').first().click();
    await settle(1000);
  }
  const selfForm = await page
    .locator('[data-ui-surface="discovery-self-directed-create"]')
    .isVisible()
    .catch(() => false);
  note(`Case H selfDirectedAvailable=${selfDirectedAvailable} selfForm=${selfForm}`);
  await page.screenshot({ path: path.join(OUT, '07-self-directed.png'), fullPage: true });

  const pass =
    !journeyWelcome &&
    chooser &&
    guidedBtn &&
    selfBtn &&
    wizard &&
    !stillJourneyWelcome &&
    reviewOk &&
    createdStep &&
    confirmation &&
    !falselyClaimsRun &&
    claimsRun === 'false' &&
    createPosts.length > createsBefore &&
    runNowPosts.length === runsBefore &&
    profileVisible &&
    profileAfterReload &&
    !fakeResultsClaim &&
    selfDirectedAvailable &&
    selfForm;

  note(`VERDICT: ${pass ? 'BROWSER PASS' : 'BROWSER FAIL'}`);
  await fs.writeFile(
    path.join(OUT, 'observations.json'),
    JSON.stringify({ observations, pass, createPosts, runNowPosts }, null, 2)
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
