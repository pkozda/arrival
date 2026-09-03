import { test, expect } from '@playwright/test';
import {
  API_URL,
  createApiSession,
  enterAtlasHud,
  primeDiscoverySession,
  waitForAppShell,
} from './helpers';

const SURFACES = {
  discoveryModule: '[data-ui-surface="discovery-module-body"]',
  resultDetail: '[data-ui-surface="discovery-result-detail"]',
  runNow: '[data-ui-surface="discovery-run-now"]',
  runNowSuccess: '[data-ui-surface="discovery-run-now-success"]',
  editProfile: '[data-ui-surface="discovery-edit-profile"]',
  notificationPrefs: '[data-ui-surface="discovery-notification-prefs"]',
  notificationSave: '[data-ui-surface="discovery-notification-save"]',
  notificationSaved: '[data-ui-surface="discovery-notification-saved"]',
} as const;

test.describe('E9.3 Discovery canonical journey', () => {
  test('create, edit, run now, inspect result, persist user state', async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000);
    const sessionId = await createApiSession(request);
    await primeDiscoverySession(page, sessionId);
    await enterAtlasHud(page);
    await page.getByRole('link', { name: 'Discovery' }).click();
    await waitForAppShell(page);

    await expect(page.locator(SURFACES.discoveryModule)).toBeVisible();

    await page.getByRole('button', { name: 'New profile' }).click();
    await page.getByLabel('Profile name').fill('Canonical Jobs');
    await page.getByLabel('Country code').fill('DE');
    await page.getByLabel('Preferred role (optional)').fill('Frontend Engineer');
    await page.getByRole('button', { name: 'Create profile' }).click();

    await expect(page.getByRole('heading', { name: 'Canonical Jobs' })).toBeVisible();

    await page.getByRole('button', { name: 'Edit criteria' }).click();
    await expect(page.locator(SURFACES.editProfile)).toBeVisible();
    await page.getByLabel('Preferred role (optional)').fill('Senior Frontend Engineer');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Senior Frontend Engineer')).toBeVisible();

    await expect(page.locator(SURFACES.notificationPrefs)).toBeVisible();
    await page.getByRole('checkbox', { name: /Skip empty digest/i }).uncheck();
    await page.locator(SURFACES.notificationSave).click();
    await expect(page.locator(SURFACES.notificationSaved)).toBeVisible();

    await page.reload();
    await waitForAppShell(page);
    await expect(page.getByRole('heading', { name: 'Canonical Jobs' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /Skip empty digest/i })).not.toBeChecked();

    await page.locator(SURFACES.runNow).click();
    await expect(page.locator(SURFACES.runNowSuccess)).toBeVisible({ timeout: 60_000 });

    await expect
      .poll(
        async () => {
          const buttons = page.getByRole('button', { name: 'Frontend Engineer' });
          return buttons.count();
        },
        { timeout: 60_000 }
      )
      .toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Frontend Engineer' }).first().click();
    await expect(page.locator(SURFACES.resultDetail)).toBeVisible();
    await expect(page.getByText('Why it matched')).toBeVisible();
    await expect(page.getByText('Role fit')).toBeVisible();
    await expect(page.getByText('Verified', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Mark opened' }).click();
    await expect(page.getByText('OPENED')).toBeVisible();

    await page.reload();
    await waitForAppShell(page);
    await expect(page.getByRole('heading', { name: 'Canonical Jobs' })).toBeVisible();
    await expect(page.getByText('Senior Frontend Engineer')).toBeVisible();
    await page.getByRole('button', { name: 'Frontend Engineer' }).first().click();
    await expect(page.getByText('OPENED')).toBeVisible();

    const listRes = await request.get(`${API_URL}/api/modules/discovery/profiles`, {
      headers: { 'x-session-id': sessionId },
    });
    expect(listRes.ok()).toBeTruthy();
    const profiles = (await listRes.json()) as { profiles: Array<{ name: string }> };
    expect(profiles.profiles.some((p) => p.name === 'Canonical Jobs')).toBe(true);
  });
});
