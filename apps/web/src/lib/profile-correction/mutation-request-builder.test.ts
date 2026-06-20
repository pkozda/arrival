import { describe, expect, it } from 'vitest';
import { buildDomainCorrectionRequests } from './mutation-request-builder.js';
import { getDomainEditSection } from './domain-field-definitions.js';
import type { UserProfileViewV1 } from '@/lib/product-contract';

const baseProfile: UserProfileViewV1 = {
  schemaVersion: '1.0.0',
  preferences: { preferredLanguage: 'en' },
  completeness: { score: 10, missingDomains: [] },
  domains: {
    income: { grossMonthlyIncome: 2500 },
    employment: { employmentStatus: 'employed' },
  },
};

describe('buildDomainCorrectionRequests', () => {
  it('builds fact.correct for changed income field', () => {
    const section = getDomainEditSection('work-income');
    const requests = buildDomainCorrectionRequests(
      section,
      {
        employmentStatus: 'employed',
        grossMonthlyIncome: 3000,
        taxClass: '',
        churchTax: false,
      },
      baseProfile,
      1
    );

    expect(requests.some((request) => request.source.kind === 'profile_ui' && request.domain === 'income')).toBe(
      true
    );
  });

  it('builds pref.update for language changes', () => {
    const section = getDomainEditSection('language-display');
    const requests = buildDomainCorrectionRequests(
      section,
      { preferredLanguage: 'de', theme: '' },
      baseProfile,
      0
    );

    expect(requests).toHaveLength(1);
    expect(requests[0]?.type).toBe('pref.update');
    expect(requests[0]?.payload).toEqual({
      kind: 'pref',
      field: 'preferredLanguage',
      value: 'de',
    });
  });

  it('returns no requests when nothing changed', () => {
    const section = getDomainEditSection('work-income');
    const requests = buildDomainCorrectionRequests(
      section,
      {
        employmentStatus: 'employed',
        grossMonthlyIncome: 2500,
        taxClass: '',
        churchTax: false,
      },
      baseProfile,
      1
    );

    expect(requests).toHaveLength(0);
  });
});
