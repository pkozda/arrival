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
        churchTax: '',
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
        churchTax: '',
      },
      baseProfile,
      1
    );

    expect(requests).toHaveLength(0);
  });

  it('builds fact.correct for explicit Anmeldung confirmation (PD-001)', () => {
    const section = getDomainEditSection('move-to-germany');
    const requests = buildDomainCorrectionRequests(
      section,
      {
        countryOfOrigin: '',
        residencyStatus: '',
        arrivedAt: '',
        municipalRegistrationConfirmed: true,
      },
      baseProfile,
      3
    );

    expect(requests).toHaveLength(1);
    expect(requests[0]?.type).toBe('fact.correct');
    expect(requests[0]?.domain).toBe('migration');
    expect(requests[0]?.userConfirmationRequired).toBe(true);
    expect(requests[0]?.payload).toMatchObject({
      kind: 'domain_facts',
      domain: 'migration',
      fields: { municipalRegistrationConfirmed: true },
    });
  });

  it('builds fact.correct for dependentChildCount → children[]', () => {
    const section = getDomainEditSection('household-family');
    const requests = buildDomainCorrectionRequests(
      section,
      {
        householdSize: '',
        dependentChildCount: 2,
        maritalStatus: '',
      },
      baseProfile,
      1
    );

    const household = requests.find((request) => request.domain === 'household');
    expect(household).toBeDefined();
    expect(household?.payload).toMatchObject({
      kind: 'domain_facts',
      domain: 'household',
      fields: {
        children: [{ age: 0 }, { age: 0 }],
      },
    });
  });

  it('builds fact.correct for receivingKindergeld false (revoke completion)', () => {
    const section = getDomainEditSection('benefits-support');
    const profileWithKindergeld = {
      ...baseProfile,
      domains: {
        ...baseProfile.domains,
        benefits: { receivingKindergeld: true },
      },
    };
    const requests = buildDomainCorrectionRequests(
      section,
      {
        receivingBuergergeld: false,
        receivingAlg1: false,
        receivingWohngeld: false,
        receivingKindergeld: false,
        daysInGermany: '',
      },
      profileWithKindergeld,
      2
    );

    const benefits = requests.find((request) => request.domain === 'benefits');
    expect(benefits?.payload).toMatchObject({
      kind: 'domain_facts',
      domain: 'benefits',
      fields: { receivingKindergeld: false },
    });
  });
});
