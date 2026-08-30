import { expect, test } from '@playwright/test';
import {
  LOCALIZATION_LOCALES,
  assertDocumentLanguage,
  buildAuditDictionaries,
  openFreshWelcome,
  selectWelcomeLanguage,
  continueFromWelcome,
  readSurfaceText,
  collectAriaLabels,
} from './fixtures';
import { auditSurfaceText, formatLocalizationReport } from './localization-audit';

/**
 * Focused Profile Intake localization check.
 * Reaches the real edit form after Welcome language selection.
 */
test.describe('Localization — Profile Intake', () => {
  for (const locale of LOCALIZATION_LOCALES) {
    test(`profile intake localization: ${locale}`, async ({ page }) => {
      test.setTimeout(90_000);
      const dictionaries = await buildAuditDictionaries();
      const probes = (
        await import('./localization-audit')
      ).buildDifferingEnglishProbes(locale, dictionaries);

      await openFreshWelcome(page);
      await selectWelcomeLanguage(page, locale);
      const guestHeadline = dictionaries[locale]['home.guest.headline'] ?? 'Your new life.';
      await continueFromWelcome(page, locale, guestHeadline);

      // Enter Atlas so HUD/session are active, then open a real Profile Intake route.
      await page.locator('[data-ui-surface="home-atlas-entry"]').click();
      await expect(page.locator('[data-ui-surface="atlas-hud"]')).toBeVisible({ timeout: 20_000 });

      await page.goto('/profile/move-to-germany/edit');
      const intake = page.locator('[data-ui-surface="profile-intake"]');
      await expect(intake).toBeVisible({ timeout: 30_000 });
      await assertDocumentLanguage(page, locale);

      const expectedResidency = dictionaries[locale]['profile.fields.residencyStatus'];
      await expect(intake.getByText(expectedResidency, { exact: false }).first()).toBeVisible();

      const expectedSave = dictionaries[locale]['profile.save'];
      await expect(intake.getByRole('button', { name: expectedSave })).toBeVisible();

      const text = (await readSurfaceText(page, '[data-ui-surface="profile-intake"]')) ?? '';
      const aria = await collectAriaLabels(page, '[data-ui-surface="profile-intake"]').catch(
        () => ''
      );
      const audit = auditSurfaceText('Profile Intake', `${text}\n${aria}`, {
        locale,
        probes,
      });

      expect(audit.findings, formatLocalizationReport({
        locale,
        surfaces: [audit],
        findings: audit.findings,
      })).toEqual([]);
    });
  }
});
