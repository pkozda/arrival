import { test, expect } from '@playwright/test';
import {
  HOME_LE_SURFACE,
  assertHomeLeSurfaceVisible,
  assertNoBlankMain,
  assertNoHydrationErrors,
  collectConsoleErrors,
  completeColdStartIntake,
  resetBrowserSession,
  waitForAppShell,
} from './helpers.js';

/** E2E-01 — first visit journey (P0). */
test.describe('E2E-01 first visit journey', () => {
  test('bootstrap → Home → LE intake → plan visible without blank states', async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);
    await resetBrowserSession(page);
    await page.goto('/');
    await waitForAppShell(page);
    await assertNoBlankMain(page);
    await assertHomeLeSurfaceVisible(page);

    await completeColdStartIntake(page);
    await page.goto('/');
    await waitForAppShell(page);
    await assertHomeLeSurfaceVisible(page);

    await assertNoHydrationErrors(consoleErrors);
  });
});
