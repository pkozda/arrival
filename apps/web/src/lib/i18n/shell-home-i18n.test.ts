import { getTranslations, SHELL_HOME_I18N, SHELL_HOME_I18N_KEYS, t } from '@arrival-atlas/core';
import { describe, expect, it } from 'vitest';

const LOCALES = ['en', 'de', 'ru', 'ua'] as const;

describe('shell home Phase 1 i18n', () => {
  it('defines the same keys for every supported language', () => {
    for (const locale of LOCALES) {
      expect(Object.keys(SHELL_HOME_I18N[locale]).sort()).toEqual([...SHELL_HOME_I18N_KEYS].sort());
    }
  });

  it('provides real Ukrainian translations (not English duplicates)', () => {
    expect(t('home.guest.enterAtlas', 'ua')).toBe('Увійти в Atlas');
    expect(t('nav.lifeEvents', 'ua')).toBe('Життєві події');
    expect(t('home.onboarding.title', 'ua')).toBe('Орієнтація в Німеччині');
    expect(t('home.guest.enterAtlas', 'ua')).not.toBe(t('home.guest.enterAtlas', 'en'));
  });

  it('keeps Enter Atlas terminology consistent across guest and HUD keys', () => {
    for (const locale of LOCALES) {
      expect(t('home.guest.enterAtlas', locale)).toBe(t('nav.enterAtlas', locale));
    }
  });

  it('merges shell-home keys into getTranslations for all locales', () => {
    for (const locale of LOCALES) {
      const bundle = getTranslations(locale);
      expect(bundle['home.guest.eyebrow']).toBe(SHELL_HOME_I18N[locale]['home.guest.eyebrow']);
      expect(bundle['nav.economicReality']).toBe(SHELL_HOME_I18N[locale]['nav.economicReality']);
      expect(bundle['home.leaveDemo.title']).toBe(SHELL_HOME_I18N[locale]['home.leaveDemo.title']);
    }
  });
});
