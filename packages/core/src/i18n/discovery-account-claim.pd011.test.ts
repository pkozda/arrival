import { describe, expect, it } from 'vitest';
import { DISCOVERY_I18N, DISCOVERY_I18N_KEYS } from './discovery-translations.js';
import { t, getSupportedLanguages } from './index.js';

const CONTINUITY_KEYS = DISCOVERY_I18N_KEYS.filter(
  (key) => key.startsWith('discovery.continuity.') || key.startsWith('discovery.persistence.')
);

describe('PD-011 Discovery account claim i18n', () => {
  it('W — continuity/persistence localization keys exist for EN / DE / RU / UA', () => {
    expect(CONTINUITY_KEYS.length).toBeGreaterThan(8);
    for (const key of CONTINUITY_KEYS) {
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
