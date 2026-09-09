import { describe, expect, it } from 'vitest';
import { DISCOVERY_I18N, DISCOVERY_I18N_KEYS } from './discovery-translations.js';

const RESULT_KEYS = [
  'discovery.results.count',
  'discovery.results.inProgress',
  'discovery.results.errorHint',
  'discovery.results.previousHeading',
  'discovery.results.currentRun',
  'discovery.result.openSource',
  'discovery.result.externalLink',
  'discovery.result.sourceUnavailable',
  'discovery.result.salary',
  'discovery.execution.adjustProfile',
  'discovery.execution.runAgain',
  'discovery.execution.noResults',
  'discovery.execution.noResultsDetail',
] as const;

describe('PD-008 discovery result presentation i18n', () => {
  it('K — result presentation strings exist for EN/DE/RU/UA', () => {
    for (const lang of ['en', 'de', 'ru', 'ua'] as const) {
      const table = DISCOVERY_I18N[lang];
      for (const key of RESULT_KEYS) {
        expect(DISCOVERY_I18N_KEYS).toContain(key);
        expect(typeof table[key]).toBe('string');
        expect(table[key]!.length).toBeGreaterThan(0);
      }
    }
  });
});
