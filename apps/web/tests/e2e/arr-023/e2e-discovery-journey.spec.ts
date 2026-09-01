import { test, expect } from '@playwright/test';
import {
  API_URL,
  createApiSession,
  primeSession,
  waitForAppShell,
} from './helpers';

const SURFACES = {
  discoveryModule: '[data-ui-surface="discovery-module-body"]',
  resultDetail: '[data-ui-surface="discovery-result-detail"]',
} as const;

test.describe('E9 Discovery journey', () => {
  test('open discovery, inspect result, update state, refresh persists', async ({
    page,
    request,
  }) => {
    const sessionId = await createApiSession(request);

    const seedRes = await request.post(`${API_URL}/api/dev/discovery/seed-fixture`, {
      headers: { 'x-session-id': sessionId },
    });
    expect(seedRes.ok()).toBeTruthy();
    const seed = (await seedRes.json()) as { profileId: string; resultIds: string[] };

    await primeSession(page, sessionId);
    await page.goto('/modules/discovery');
    await waitForAppShell(page);

    await expect(page.locator(SURFACES.discoveryModule)).toBeVisible();
    await expect(page.getByText('E2E Jobs')).toBeVisible();
    await expect(page.getByText('Enabled')).toBeVisible();

    await page.getByRole('button', { name: 'Frontend Engineer' }).click();
    await expect(page.locator(SURFACES.resultDetail)).toBeVisible();
    await expect(page.getByText('Hiring now')).toBeVisible();

    await page.getByRole('button', { name: 'Mark opened' }).click();
    await expect(page.getByText('OPENED')).toBeVisible();

    await page.reload();
    await waitForAppShell(page);
    await expect(page.locator(SURFACES.discoveryModule)).toBeVisible();
    await page.getByRole('button', { name: 'Frontend Engineer' }).click();
    await expect(page.getByText('OPENED')).toBeVisible();

    expect(seed.profileId).toBe('profile-e2e-jobs');
    expect(seed.resultIds.length).toBeGreaterThan(0);
  });
});
