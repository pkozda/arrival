import { describe, expect, it } from 'vitest';
import { DISCOVERY_I18N, DISCOVERY_I18N_KEYS } from './discovery-translations.js';
import { t, getSupportedLanguages } from './index.js';

const AUTOMATION_KEYS = DISCOVERY_I18N_KEYS.filter((key) =>
  key.startsWith('discovery.automation.')
);

describe('PD-010 Discovery automation i18n', () => {
  it('T — automation localization keys exist for EN / DE / RU / UA', () => {
    expect(AUTOMATION_KEYS.length).toBeGreaterThan(15);
    for (const key of AUTOMATION_KEYS) {
      for (const language of getSupportedLanguages()) {
        const value = t(key, language);
        expect(value, `${language}:${key}`).toBeTruthy();
        expect(value).not.toBe(key);
        if (language !== 'en') {
          expect(DISCOVERY_I18N[language][key]).toBeTruthy();
          expect(DISCOVERY_I18N[language][key]).not.toBe(DISCOVERY_I18N.en[key]);
        }
      }
    }
  });
});
