import { describe, expect, it } from 'vitest';
import { DISCOVERY_I18N, DISCOVERY_I18N_KEYS } from './discovery-translations.js';

const EXECUTION_KEYS = [
  'discovery.runNow.button',
  'discovery.runNow.queued',
  'discovery.runNow.running',
  'discovery.execution.idle',
  'discovery.execution.queued',
  'discovery.execution.running',
  'discovery.execution.success',
  'discovery.execution.noResults',
  'discovery.execution.noResultsDetail',
  'discovery.execution.error',
  'discovery.execution.errorDetail',
  'discovery.execution.retry',
  'discovery.execution.resultsAvailable',
  'discovery.runSummary.resultsForRun',
] as const;

describe('PD-007 discovery execution i18n', () => {
  it('M — lifecycle strings exist for EN/DE/RU/UA', () => {
    for (const lang of ['en', 'de', 'ru', 'ua'] as const) {
      const table = DISCOVERY_I18N[lang];
      for (const key of EXECUTION_KEYS) {
        expect(DISCOVERY_I18N_KEYS).toContain(key);
        expect(typeof table[key]).toBe('string');
        expect(table[key]!.length).toBeGreaterThan(0);
      }
    }
  });
});
