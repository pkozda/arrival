import { test, expect } from '@playwright/test';
import {
  HOME_LE_SURFACE,
  SURFACES,
  assertHomeLeSurfaceVisible,
  assertNoBlankMain,
  createApiSession,
  loadDemoPreset,
  primeSession,
  waitForAppShell,
} from './helpers.js';

/** E2E-03 — profile edit refreshes Home LE + ER without full reload (REL-R1). */
test.describe('E2E-03 profile update flow', () => {
  test('profile edit updates Home surfaces without document reload', async ({ page, request }) => {
    const sessionId = await createApiSession(request);
    await loadDemoPreset(request, sessionId, 'stable-resident');

    await primeSession(page, sessionId);
    await page.goto('/');
    await waitForAppShell(page);
    await assertNoBlankMain(page);
    await assertHomeLeSurfaceVisible(page);

    const homeMain = page.locator('main');
    await expect(homeMain).toContainText(/Frankfurt/i, { timeout: 30_000 });

    const homeTextBefore = await homeMain.innerText();

    await page.goto('/profile/where-you-live/edit');
    await waitForAppShell(page);

    const cityInput = page.locator('input[type="text"]').first();
    await expect(cityInput).toBeVisible();
    const previousCity = await cityInput.inputValue();
    const nextCity = previousCity === 'Hamburg' ? 'Munich' : 'Hamburg';
    await cityInput.fill(nextCity);

    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page).toHaveURL(/\/profile\/where-you-live/);

    await page.goto('/');
    await waitForAppShell(page);
    await assertHomeLeSurfaceVisible(page);

    const homeMainAfter = page.locator('main');
    await expect(homeMainAfter).toContainText(nextCity, { timeout: 30_000 });

    const homeTextAfter = await homeMainAfter.innerText();
    expect(homeTextAfter).toContain(nextCity);
    expect(homeTextBefore).not.toEqual(homeTextAfter);

    await page.goto('/modules/economic-reality');
    await waitForAppShell(page);
    await expect(page.locator(SURFACES.erModuleBody).first()).toBeVisible({ timeout: 30_000 });
  });
});
