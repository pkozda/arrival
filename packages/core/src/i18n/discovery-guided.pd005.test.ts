import { describe, expect, it } from 'vitest';
import { DISCOVERY_I18N, DISCOVERY_I18N_KEYS } from './discovery-translations.js';
import { t, getSupportedLanguages } from './index.js';

const GUIDED_KEYS = DISCOVERY_I18N_KEYS.filter(
  (key) => key.startsWith('discovery.guided.') || key.startsWith('discovery.setup.')
);

describe('PD-005 Guided Discovery i18n', () => {
  it('J — guided/setup localization keys exist for EN / DE / RU / UA', () => {
    expect(GUIDED_KEYS.length).toBeGreaterThan(10);
    for (const key of GUIDED_KEYS) {
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
