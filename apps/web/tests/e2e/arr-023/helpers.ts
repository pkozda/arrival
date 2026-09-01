import type { APIRequestContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { DemoPersonaId } from '@arrival-atlas/life-event-demo/personas';

export const API_URL = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3001';
export const SESSION_STORAGE_KEY = 'arrival_atlas_session_id';
const JOURNEY_GUIDE_STORAGE_KEY = 'arrival-atlas-journey-guide-v1';

export const SURFACES = {
  bootstrapLoading: '[data-ui-surface="bootstrap-loading"]',
  bootstrapError: '[data-ui-surface="bootstrap-error"]',
  homeNextSteps: '[data-ui-surface="home-next-steps"]',
  homeAtlasEntry: '[data-ui-surface="home-atlas-entry"]',
  homeAtlasMap: '[data-ui-surface="home-atlas-map"]',
  atlasHud: '[data-ui-surface="atlas-hud"]',
  homeSnapshotError: '[data-ui-surface="home-snapshot-error"]',
  homeErCard: '[data-ui-surface="economic-reality-home-card"]',
  leModuleBody: '[data-ui-surface="life-event-module-body"]',
  erModuleBody: '[data-ui-surface="economic-reality-module-body"]',
  profileLoadError: '[data-ui-surface="profile-load-error"]',
  errorPanel: '[data-ui-surface="error-panel"]',
  coldStart: '.le-cold-start',
} as const;

export const HOME_LE_SURFACE = `${SURFACES.homeNextSteps}, ${SURFACES.coldStart}, ${SURFACES.homeAtlasEntry}, ${SURFACES.homeAtlasMap}`;

export async function resetBrowserSession(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

export async function createApiSession(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API_URL}/api/sessions`, {
    data: {
      context: {
        userProfile: {
          language: 'en',
          uiPreferences: { theme: 'light' },
        },
      },
    },
  });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { sessionId: string };
  return body.sessionId;
}

export async function loadDemoPreset(
  request: APIRequestContext,
  sessionId: string,
  presetId: DemoPersonaId
): Promise<void> {
  const res = await request.post(`${API_URL}/api/dev/demo/load-preset`, {
    headers: { 'x-session-id': sessionId },
    data: { presetId },
  });
  expect(res.ok()).toBeTruthy();
}

export async function primeSession(page: Page, sessionId: string): Promise<void> {
  await page.addInitScript(
    ({ storageKey, id }) => {
      localStorage.setItem(storageKey, id);
    },
    { storageKey: SESSION_STORAGE_KEY, id: sessionId }
  );
}

/** Skips Journey Guide welcome overlay on galaxy surfaces (Discovery E9 e2e). */
export async function primeDiscoverySession(page: Page, sessionId: string): Promise<void> {
  await page.addInitScript(
    ({ storageKey, id, guideKey }) => {
      localStorage.setItem(storageKey, id);
      localStorage.setItem(
        guideKey,
        JSON.stringify({
          version: 1,
          hasChosenMode: true,
          mode: 'independent',
          assistanceStage: 1,
          completedMissionIds: [],
          lockedClickCount: 0,
          lastActiveAt: null,
          dismissedWelcomeSurfaces: ['discovery-galaxy'],
          lastUnlockEvent: null,
        })
      );
    },
    { storageKey: SESSION_STORAGE_KEY, id: sessionId, guideKey: JOURNEY_GUIDE_STORAGE_KEY }
  );
}

export async function waitForAppShell(page: Page): Promise<void> {
  await expect(page.locator(SURFACES.bootstrapLoading)).toHaveCount(0, { timeout: 30_000 });
  await expect(page.locator('header.header, header.atlas-hud').first()).toBeVisible();
}

/** Dismiss Arrival Welcome language gate when it blocks module routes. */
export async function dismissArrivalWelcomeIfPresent(page: Page): Promise<void> {
  const english = page.getByRole('button', { name: /English/ });
  if (!(await english.isVisible({ timeout: 5000 }).catch(() => false))) {
    return;
  }
  await english.click();
  const cta = page.locator('.arrival-welcome__cta');
  if (await cta.isEnabled({ timeout: 5000 }).catch(() => false)) {
    await cta.click();
    await expect(page.locator('[data-ui-surface="arrival-welcome"]')).toHaveCount(0, {
      timeout: 15_000,
    });
  }
}

export async function enterAtlasHud(page: Page): Promise<void> {
  await page.goto('/');
  await waitForAppShell(page);
  await dismissArrivalWelcomeIfPresent(page);

  const atlasEntry = page.locator('[data-ui-surface="home-atlas-entry"]');
  if (await atlasEntry.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await atlasEntry.click();
  } else {
    await page.getByRole('button', { name: 'Enter Atlas' }).click();
  }
  await expect(page.locator('[data-ui-surface="atlas-hud"]')).toBeVisible({ timeout: 20_000 });
}

export async function assertNoBlankMain(page: Page): Promise<void> {
  const main = page.locator('main').first();
  await expect(main).toBeVisible();
  const text = (await main.innerText()).trim();
  expect(text.length).toBeGreaterThan(0);
}

export async function assertHomeLeSurfaceVisible(page: Page): Promise<void> {
  await expect(page.locator(HOME_LE_SURFACE).first()).toBeVisible({ timeout: 30_000 });
}

export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('favicon')) {
        errors.push(text);
      }
    }
  });
  page.on('pageerror', (error) => {
    errors.push(error.message);
  });
  return errors;
}

export async function assertNoHydrationErrors(consoleErrors: string[]): Promise<void> {
  const hydration = consoleErrors.filter(
    (entry) =>
      /hydration/i.test(entry) ||
      /did not match/i.test(entry) ||
      /Text content does not match/i.test(entry)
  );
  expect(hydration, `Hydration errors: ${hydration.join('; ')}`).toEqual([]);
}

export async function clickRetryIn(surface: ReturnType<Page['locator']>): Promise<void> {
  const retry = surface.locator('button', { hasText: /retry/i }).first();
  await expect(retry).toBeEnabled();
  await retry.click();
}

export async function completeColdStartIntake(page: Page): Promise<void> {
  await page.goto('/modules/life-event');
  await waitForAppShell(page);

  const intake = page.locator('.le-plan-intake');
  await expect(intake).toBeVisible({ timeout: 30_000 });

  await page.locator('.le-plan-intake select').nth(0).selectOption({ index: 1 });
  await page.locator('.le-plan-intake input[type="text"]').fill('Berlin');
  await page.locator('.le-plan-intake select').nth(1).selectOption({ index: 1 });
  await page.locator('.le-plan-intake select').nth(2).selectOption({ index: 1 });

  await page.locator('.le-plan-intake button[type="submit"]').click();
  await expect(page.locator('.le-module-page .le-plan-card').first()).toBeVisible({
    timeout: 30_000,
  });
}

export function blockFirstPostToSessions(page: Page): { getCount: () => number } {
  let posts = 0;
  void page.route('**/api/sessions', async (route) => {
    if (route.request().method() === 'POST') {
      posts += 1;
      if (posts === 1) {
        await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
        return;
      }
    }
    await route.continue();
  });
  return { getCount: () => posts };
}
