import { describe, expect, it } from 'vitest';
import { DISCOVERY_I18N } from './discovery-translations.js';
import { t, getSupportedLanguages } from './index.js';

const PERSISTENCE_KEYS = [
  'discovery.persistence.account',
  'discovery.persistence.session',
] as const;

describe('PD-006 Discovery persistence i18n', () => {
  it('J — persistence disclosure keys exist for EN / DE / RU / UA', () => {
    for (const key of PERSISTENCE_KEYS) {
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
