import { describe, expect, it } from 'vitest';
import { DISCOVERY_I18N, DISCOVERY_I18N_KEYS } from './discovery-translations.js';

const TRUST_KEYS = [
  'discovery.trust.status.passed',
  'discovery.trust.status.failed',
  'discovery.trust.status.unknown',
  'discovery.trust.summary.jobsOfficialSource',
  'discovery.trust.summary.giveawaysFreeAndDeadline',
  'discovery.trust.summary.checksPassed',
  'discovery.trust.whyChecked',
  'discovery.trust.boundary',
  'discovery.trust.check.officialSource',
  'discovery.trust.check.freeParticipation',
  'discovery.trust.check.deadlineValid',
  'discovery.trust.sourceTrust.official',
  'discovery.trust.freshness.current',
  'discovery.result.sourceNotVerified',
  'discovery.result.sourceMissingUrl',
] as const;

describe('PD-009 discovery trust i18n', () => {
  it('K — trust strings exist for EN/DE/RU/UA', () => {
    for (const lang of ['en', 'de', 'ru', 'ua'] as const) {
      const table = DISCOVERY_I18N[lang];
      for (const key of TRUST_KEYS) {
        expect(DISCOVERY_I18N_KEYS).toContain(key);
        expect(typeof table[key]).toBe('string');
        expect(table[key]!.length).toBeGreaterThan(0);
      }
    }
  });
});
