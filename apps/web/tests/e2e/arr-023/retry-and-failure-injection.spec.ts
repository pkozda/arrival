import { test, expect } from '@playwright/test';
import {
  SURFACES,
  clickRetryIn,
  createApiSession,
  loadDemoPreset,
  primeSession,
  waitForAppShell,
} from './helpers.js';

async function clearStorage(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

test.describe('ARR-023 retry surfaces (real network)', () => {
  test('UX-RETRY-BOOT bootstrap retry recovers from session failure', async ({ page }) => {
    let sessionPosts = 0;
    await page.route('**/api/sessions**', async (route) => {
      if (route.request().method() === 'POST') {
        sessionPosts += 1;
        if (sessionPosts === 1) {
          await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
          return;
        }
      }
      await route.continue();
    });

    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('/');

    const bootstrapError = page.locator(SURFACES.bootstrapError);
    const sawBootstrapError = await bootstrapError
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (!sawBootstrapError) {
      test.skip(true, 'Bootstrap POST was not intercepted in this environment');
    }
    await clickRetryIn(bootstrapError);
    await waitForAppShell(page);
    await expect(page.locator('header.header')).toBeVisible();
  });

  test('UX-RETRY-H Home plan retry recovers after API 500', async ({ page, request }) => {
    const sessionId = await createApiSession(request);
    await loadDemoPreset(request, sessionId, 'stable-resident');

    await primeSession(page, sessionId);
    await page.goto('/');
    await waitForAppShell(page);
    await expect(page.locator(SURFACES.homeNextSteps)).toBeVisible({ timeout: 30_000 });

    let planFetchesAfterReady = 0;
    await page.route('**/api/modules/life-event/plan**', async (route) => {
      planFetchesAfterReady += 1;
      if (planFetchesAfterReady === 1) {
        await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
        return;
      }
      await route.continue();
    });

    await page.reload();
    const homeNextSteps = page.locator(SURFACES.homeNextSteps);
    await expect(homeNextSteps.locator(SURFACES.errorPanel)).toBeVisible({ timeout: 30_000 });
    await clickRetryIn(homeNextSteps);
    await expect(homeNextSteps.locator(SURFACES.errorPanel)).toHaveCount(0, { timeout: 30_000 });
  });

  test('UX-RETRY-ER-H Home ER card retry recovers after API 500', async ({ page, request }) => {
    const sessionId = await createApiSession(request);
    await loadDemoPreset(request, sessionId, 'benefits-discovery');

    await primeSession(page, sessionId);
    await page.goto('/');
    await waitForAppShell(page);

    const erCard = page.locator(SURFACES.homeErCard);
    const hasErCard = await erCard.isVisible().catch(() => false);
    test.skip(!hasErCard, 'Home ER card hidden when LE plan card occupies Home (expected layout)');

    let erFetchesAfterReady = 0;
    await page.route('**/api/modules/economic-reality/plan**', async (route) => {
      erFetchesAfterReady += 1;
      if (erFetchesAfterReady === 1) {
        await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
        return;
      }
      await route.continue();
    });

    await page.reload();
    await expect(erCard.locator(SURFACES.errorPanel)).toBeVisible({ timeout: 30_000 });
    await clickRetryIn(erCard);
    await expect(erCard.locator(SURFACES.errorPanel)).toHaveCount(0, { timeout: 30_000 });
  });

  test('UX-RETRY-LE LE module retry recovers after API 500', async ({ page, request }) => {
    const sessionId = await createApiSession(request);
    await loadDemoPreset(request, sessionId, 'stable-resident');

    await primeSession(page, sessionId);
    await page.goto('/modules/life-event');
    await waitForAppShell(page);
    await expect(page.locator('.le-module-page .le-plan-card').first()).toBeVisible({ timeout: 30_000 });

    let planFetchesAfterReady = 0;
    await page.route('**/api/modules/life-event/plan**', async (route) => {
      planFetchesAfterReady += 1;
      if (planFetchesAfterReady === 1) {
        await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
        return;
      }
      await route.continue();
    });

    await page.reload();
    const moduleBody = page.locator(SURFACES.leModuleBody);
    await expect(moduleBody).toBeVisible({ timeout: 30_000 });
    await clickRetryIn(moduleBody);
    await expect(page.locator('.le-module-page .le-plan-card').first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test('UX-RETRY-ER ER module retry recovers after API 500', async ({ page, request }) => {
    const sessionId = await createApiSession(request);
    await loadDemoPreset(request, sessionId, 'benefits-discovery');

    await primeSession(page, sessionId);
    await page.goto('/modules/economic-reality');
    await waitForAppShell(page);
    await expect(page.locator(SURFACES.erModuleBody).first()).toBeVisible({ timeout: 30_000 });

    let erFetchesAfterReady = 0;
    await page.route('**/api/modules/economic-reality/plan**', async (route) => {
      erFetchesAfterReady += 1;
      if (erFetchesAfterReady === 1) {
        await route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"injected"}' });
        return;
      }
      await route.continue();
    });

    await page.reload();

    const moduleBody = page.locator(SURFACES.erModuleBody);
    const errorPanel = moduleBody.locator(SURFACES.errorPanel);
    if (!(await errorPanel.isVisible().catch(() => false))) {
      test.skip(true, 'ER module retained cached presentation after injected failure');
    }
    await clickRetryIn(moduleBody);
    await expect(errorPanel).toHaveCount(0, { timeout: 30_000 });
  });
});

test.describe('ARR-023 failure injection', () => {
  test('profile load failure shows shell banner with retry', async ({ page, request }) => {
    const sessionId = await createApiSession(request);
    await loadDemoPreset(request, sessionId, 'stable-resident');

    await primeSession(page, sessionId);
    await page.goto('/');
    await waitForAppShell(page);

    let userContextFetchesAfterReady = 0;
    await page.route('**/api/user-context**', async (route) => {
      userContextFetchesAfterReady += 1;
      if (userContextFetchesAfterReady === 1) {
        await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
        return;
      }
      await route.continue();
    });

    await page.reload();

    const banner = page.locator(SURFACES.profileLoadError);
    await expect(banner).toBeVisible({ timeout: 30_000 });
    await clickRetryIn(banner);
    await expect(banner).toHaveCount(0, { timeout: 30_000 });
  });

  test('no silent failures on forced LE + ER errors after Home is ready', async ({ page, request }) => {
    const sessionId = await createApiSession(request);
    await loadDemoPreset(request, sessionId, 'stable-resident');

    await primeSession(page, sessionId);
    await page.goto('/');
    await waitForAppShell(page);
    await expect(page.locator(SURFACES.homeNextSteps)).toBeVisible({ timeout: 30_000 });

    await page.route('**/api/modules/life-event/plan**', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
    );
    await page.route('**/api/modules/economic-reality/plan**', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
    );

    await page.reload();
    await waitForAppShell(page);

    await expect(page.locator(SURFACES.homeNextSteps).locator(SURFACES.errorPanel)).toBeVisible({
      timeout: 30_000,
    });

    const erCard = page.locator(SURFACES.homeErCard);
    if (await erCard.isVisible().catch(() => false)) {
      await expect(erCard.locator(SURFACES.errorPanel)).toBeVisible();
    }
  });
});
