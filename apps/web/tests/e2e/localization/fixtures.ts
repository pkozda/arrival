import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { loadCoreI18nDictionaries } from './load-core-i18n';
import {
  ARRIVAL_LANGUAGE_LABELS,
  ARRIVAL_WELCOME_COPY,
  toDocumentLanguageTag,
  type WelcomeLocale,
} from './welcome-copy';
import {
  auditSurfaceText,
  buildDifferingEnglishProbes,
  formatLocalizationReport,
  mergeReportFindings,
  type LocalizationAuditReport,
  type SupportedAuditLocale,
} from './localization-audit';

export const LOCALIZATION_LOCALES: SupportedAuditLocale[] = ['en', 'de', 'ru', 'ua'];

export const SURFACES = {
  welcome: '[data-ui-surface="arrival-welcome"]',
  guestHome: '[data-ui-surface="home-atlas"]',
  guestEntry: '[data-ui-surface="home-atlas-entry"]',
  atlasHud: '[data-ui-surface="atlas-hud"]',
  journeyGuideWelcome: '.journey-guide-welcome',
  journeyGuideSpeech: '.journey-guide-speech',
  journeyGuideFab: '.journey-guide-fab',
  certaintyPanel: '[data-ui-surface="certainty-panel"]',
} as const;

/** Build merged EN + locale dictionaries used for English-leak detection. */
export async function buildAuditDictionaries(): Promise<
  Record<SupportedAuditLocale, Record<string, string>>
> {
  const core = await loadCoreI18nDictionaries();
  const result = {} as Record<SupportedAuditLocale, Record<string, string>>;

  for (const locale of LOCALIZATION_LOCALES) {
    const welcome = ARRIVAL_WELCOME_COPY[locale];
    result[locale] = {
      ...core.merged[locale],
      'arrival.welcome.title': welcome.title,
      'arrival.welcome.languagePrompt': welcome.languagePrompt,
      'arrival.welcome.trust': welcome.trust,
      'arrival.welcome.continue': welcome.continue,
      'arrival.welcome.suggestedLabel': welcome.suggestedLabel,
    };
  }

  return result;
}

export async function resetNewcomerState(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

export async function openFreshWelcome(page: Page): Promise<void> {
  await resetNewcomerState(page);
  await page.goto('/');
  await expect(page.locator(SURFACES.welcome)).toBeVisible({ timeout: 30_000 });
}

export async function selectWelcomeLanguage(
  page: Page,
  locale: SupportedAuditLocale
): Promise<void> {
  const label = ARRIVAL_LANGUAGE_LABELS[locale as WelcomeLocale];
  const button = page.locator('.arrival-welcome__lang-btn', { hasText: label }).first();
  await expect(button).toBeVisible();
  await button.click();

  const expectedTitle = ARRIVAL_WELCOME_COPY[locale as WelcomeLocale].title;
  await expect(page.locator('#arrival-welcome-title')).toHaveText(expectedTitle, {
    timeout: 10_000,
  });

  const expectedContinue = ARRIVAL_WELCOME_COPY[locale as WelcomeLocale].continue;
  await expect(page.locator('.arrival-welcome__cta')).toHaveText(expectedContinue);

  // Wait for AppProvider persistence — Welcome copy updates locally before session language settles.
  await expect
    .poll(async () => page.evaluate(() => localStorage.getItem('arrival_atlas_display_language')), {
      timeout: 15_000,
    })
    .toBe(locale);

  await assertDocumentLanguage(page, locale);
}

export async function continueFromWelcome(
  page: Page,
  locale: SupportedAuditLocale,
  expectedGuestHeadline: string
): Promise<void> {
  const cta = page.locator('.arrival-welcome__cta');
  await expect(cta).toBeEnabled();
  await cta.click();
  await expect(page.locator(SURFACES.welcome)).toHaveCount(0, { timeout: 15_000 });
  await expect(page.locator(SURFACES.guestHome)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(expectedGuestHeadline, { exact: false }).first()).toBeVisible({
    timeout: 20_000,
  });
  await assertDocumentLanguage(page, locale);
}

export async function assertDocumentLanguage(
  page: Page,
  locale: SupportedAuditLocale
): Promise<void> {
  const expected = toDocumentLanguageTag(locale as WelcomeLocale);
  await expect
    .poll(async () => page.evaluate(() => document.documentElement.lang), { timeout: 10_000 })
    .toBe(expected);
}

export async function readSurfaceText(page: Page, selector: string): Promise<string | null> {
  const locator = page.locator(selector).first();
  if ((await locator.count()) === 0) {
    return null;
  }
  if (!(await locator.isVisible().catch(() => false))) {
    return null;
  }
  return locator.innerText();
}

export async function collectAriaLabels(page: Page, rootSelector: string): Promise<string> {
  return page.locator(rootSelector).first().evaluate((root) => {
    const labels: string[] = [];
    root.querySelectorAll('[aria-label], [title]').forEach((node) => {
      const el = node as HTMLElement;
      const aria = el.getAttribute('aria-label');
      const title = el.getAttribute('title');
      if (aria) labels.push(aria);
      if (title) labels.push(title);
    });
    return labels.join('\n');
  });
}

export function isGuideCertaintyEnabledInEnv(): boolean {
  return process.env.NEXT_PUBLIC_GUIDE_USE_CERTAINTY === 'true';
}

export async function runNewcomerLocalizationAudit(
  page: Page,
  locale: SupportedAuditLocale
): Promise<LocalizationAuditReport> {
  const dictionaries = await buildAuditDictionaries();
  const probes = buildDifferingEnglishProbes(locale, dictionaries);

  await openFreshWelcome(page);
  await selectWelcomeLanguage(page, locale);

  const welcomeText = (await readSurfaceText(page, SURFACES.welcome)) ?? '';
  const welcomeAria = await collectAriaLabels(page, SURFACES.welcome).catch(() => '');
  const welcomeAudit = auditSurfaceText(
    'Arrival Welcome',
    `${welcomeText}\n${welcomeAria}`,
    { locale, probes }
  );

  const guestHeadline = dictionaries[locale]['home.guest.headline'] ?? 'Your new life.';
  await continueFromWelcome(page, locale, guestHeadline);

  await expect(page.locator(SURFACES.guestEntry)).toBeVisible({ timeout: 30_000 });

  const guestText = (await readSurfaceText(page, SURFACES.guestHome)) ?? '';
  const guestAudit = auditSurfaceText('Guest Home', guestText, { locale, probes });

  const hudText = (await readSurfaceText(page, SURFACES.atlasHud)) ?? '';
  const hudAria = await collectAriaLabels(page, SURFACES.atlasHud).catch(() => '');
  const hudAudit = auditSurfaceText('Atlas HUD', `${hudText}\n${hudAria}`, {
    locale,
    probes,
  });

  await page.locator(SURFACES.guestEntry).click();
  await expect(
    page.locator(`${SURFACES.atlasHud} nav, ${SURFACES.atlasHud} button`).first()
  ).toBeVisible({
    timeout: 20_000,
  });

  const exploringHudText = (await readSurfaceText(page, SURFACES.atlasHud)) ?? '';
  const exploringHudAria = await collectAriaLabels(page, SURFACES.atlasHud).catch(() => '');
  const exploringHudAudit = auditSurfaceText(
    'Atlas HUD (exploring)',
    `${exploringHudText}\n${exploringHudAria}`,
    { locale, probes }
  );

  const onboardingLocator = page.getByText(
    /Getting oriented in Germany|Orientierung in Deutschland|Орієнтація в Німеччині|Ориентация в Германии/i
  );
  const onboardingPresent = (await onboardingLocator.count()) > 0;
  const onboardingText = onboardingPresent ? ((await page.locator('body').innerText()) ?? '') : '';
  const onboardingAudit = auditSurfaceText('Onboarding Checklist', onboardingText, {
    locale,
    probes,
    present: onboardingPresent,
  });

  await page.goto('/modules/life-event');
  await expect(page.locator(SURFACES.atlasHud)).toBeVisible({ timeout: 30_000 });
  // Re-assert language survived navigation (known risk surface).
  await expect
    .poll(async () => page.evaluate(() => localStorage.getItem('arrival_atlas_display_language')), {
      timeout: 10_000,
    })
    .toBe(locale);

  // Give Guide layer a beat to mount if present on this surface.
  await page
    .locator(SURFACES.journeyGuideWelcome)
    .or(page.locator(SURFACES.journeyGuideSpeech))
    .or(page.locator(SURFACES.journeyGuideFab))
    .first()
    .waitFor({ state: 'attached', timeout: 5_000 })
    .catch(() => undefined);

  const lifeEventBodyText = (await page.locator('body').innerText()) ?? '';
  const lifeEventAudit = auditSurfaceText('Life Events', lifeEventBodyText, {
    locale,
    probes,
    present: lifeEventBodyText.trim().length > 0,
  });

  const guideWelcomeText = await readSurfaceText(page, SURFACES.journeyGuideWelcome);
  const guideSpeechText = await readSurfaceText(page, SURFACES.journeyGuideSpeech);
  const guideFabVisible = await page
    .locator(SURFACES.journeyGuideFab)
    .isVisible()
    .catch(() => false);
  const guideFabAria = guideFabVisible
    ? ((await page.locator(SURFACES.journeyGuideFab).getAttribute('aria-label')) ?? '')
    : '';

  const guideChunks = [guideWelcomeText, guideSpeechText, guideFabAria].filter(Boolean).join('\n');
  const guidePresent = guideChunks.trim().length > 0;
  const guideAudit = auditSurfaceText('Journey Guide', guideChunks, {
    locale,
    probes,
    present: guidePresent,
  });

  const certaintyEnabled = isGuideCertaintyEnabledInEnv();
  const certaintyText = certaintyEnabled
    ? await readSurfaceText(page, SURFACES.certaintyPanel)
    : null;
  const certaintyAudit = auditSurfaceText('Certainty', certaintyText ?? '', {
    locale,
    probes,
    present: Boolean(certaintyEnabled && certaintyText),
  });

  // Profile Intake — real edit form after language selection (not the galaxy overview chrome).
  await page.goto('/profile/move-to-germany/edit');
  await expect(page.locator('[data-ui-surface="profile-intake"]')).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(async () => page.evaluate(() => localStorage.getItem('arrival_atlas_display_language')), {
      timeout: 10_000,
    })
    .toBe(locale);
  const profileText = (await readSurfaceText(page, '[data-ui-surface="profile-intake"]')) ?? '';
  const profileAria = await collectAriaLabels(page, '[data-ui-surface="profile-intake"]').catch(
    () => ''
  );
  const profileAudit = auditSurfaceText(
    'Profile Intake',
    `${profileText}\n${profileAria}`,
    { locale, probes }
  );

  const documentLang = await page.evaluate(() => document.documentElement.lang);
  const expectedLang = toDocumentLanguageTag(locale as WelcomeLocale);

  const report: LocalizationAuditReport = {
    locale,
    documentLang,
    surfaces: [
      welcomeAudit,
      guestAudit,
      hudAudit,
      exploringHudAudit,
      onboardingAudit,
      lifeEventAudit,
      guideAudit,
      certaintyAudit,
      profileAudit,
    ],
    findings: [],
  };
  report.findings = mergeReportFindings(report);

  if (documentLang !== expectedLang) {
    report.findings.push({
      kind: 'unexpected-english',
      surface: 'document.documentElement.lang',
      text: `lang="${documentLang}"`,
      reason: `Expected html lang="${expectedLang}" after Welcome language selection`,
    });
  }

  return report;
}

export function assertLocalizationClean(report: LocalizationAuditReport): void {
  const message = formatLocalizationReport(report);
  const blocking = report.findings.filter(
    (f) => f.kind === 'unexpected-english' || f.kind === 'raw-key'
  );
  expect(blocking, message).toEqual([]);
}

export { formatLocalizationReport };
