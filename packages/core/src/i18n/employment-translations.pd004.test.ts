import { describe, expect, it } from 'vitest';
import { EMPLOYMENT_I18N, EMPLOYMENT_I18N_KEYS } from './employment-translations.js';
import { t, getSupportedLanguages } from './index.js';

describe('PD-004 Employment i18n', () => {
  it('H — localization keys exist for EN / DE / RU / UA', () => {
    const languages = getSupportedLanguages();
    expect(languages).toEqual(['en', 'de', 'ru', 'ua']);

    for (const key of EMPLOYMENT_I18N_KEYS) {
      for (const language of languages) {
        const value = t(key, language);
        expect(value, `${language}:${key}`).toBeTruthy();
        expect(value).not.toBe(key);
        // No accidental English leftovers in localized bundles for these keys.
        if (language !== 'en') {
          expect(EMPLOYMENT_I18N[language][key]).toBeTruthy();
          expect(EMPLOYMENT_I18N[language][key]).not.toBe(EMPLOYMENT_I18N.en[key]);
        }
      }
    }
  });
});
