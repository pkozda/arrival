import { describe, expect, it } from 'vitest';
import type { UserProfileViewV1 } from '@/lib/product-contract';
import { buildDomainCorrectionRequests } from './mutation-request-builder.js';
import { buildInitialDraft, getDomainEditSection } from './domain-field-definitions.js';
import { deriveRegistrationUxState } from '@/lib/life-event/registration-ux-state';
import { buildHousingSituationViewModel } from '@/lib/housing/build-housing-situation-view-model';
import { buildTaxAdministrationViewModel } from '@/lib/finance/build-tax-administration-view-model';
import {
  evaluateKindergeldAwareness,
  evaluateWohngeldAwareness,
  summarizeBenefitsAwareness,
  WOHNGELD_BENEFIT_ID,
  KINDERGELD_BENEFIT_ID,
} from '@arrival-atlas/mbde/awareness';

function profile(domains: UserProfileViewV1['domains']): UserProfileViewV1 {
  return {
    schemaVersion: '1.0.0',
    preferences: {},
    completeness: { score: 40, missingDomains: [] },
    domains,
  } as UserProfileViewV1;
}

describe('E13 state reversal & recovery', () => {
  it('1 — Registration COMPLETE only while confirmation is true', () => {
    const complete = deriveRegistrationUxState({
      schemaVersion: '1.0.0',
      profile: profile({
        housing: { city: 'Bremen' },
        migration: { municipalRegistrationConfirmed: true },
      }),
    });
    expect(complete.state).toBe('complete');

    const revoked = deriveRegistrationUxState({
      schemaVersion: '1.0.0',
      profile: profile({
        housing: { city: 'Bremen' },
        migration: { municipalRegistrationConfirmed: false },
      }),
    });
    expect(revoked.state).toBe('actionable');
  });

  it('2 — Registration revoke emits fact.correct false (not stale complete)', () => {
    const section = getDomainEditSection('move-to-germany');
    const base = profile({
      housing: { city: 'Bremen' },
      migration: { municipalRegistrationConfirmed: true },
    });
    const draft = buildInitialDraft(section, base);
    draft.municipalRegistrationConfirmed = false;
    const requests = buildDomainCorrectionRequests(section, draft, base, 2);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.type).toBe('fact.correct');
    expect(requests[0]?.payload).toMatchObject({
      fields: { municipalRegistrationConfirmed: false },
    });
  });

  it('3 — Wohngeld true → false recalculates COMPLETED → READY_TO_ACT', () => {
    const withReceipt = profile({
      housing: { city: 'Berlin', monthlyColdRent: 650 },
      income: { grossMonthlyIncome: 1800 },
      benefits: { receivingWohngeld: true },
    });
    expect(evaluateWohngeldAwareness(withReceipt).state).toBe('COMPLETED');

    const revoked = profile({
      housing: { city: 'Berlin', monthlyColdRent: 650 },
      income: { grossMonthlyIncome: 1800 },
      benefits: { receivingWohngeld: false },
    });
    expect(evaluateWohngeldAwareness(revoked).state).toBe('READY_TO_ACT');
  });

  it('4 — Kindergeld true → false recalculates; Wohngeld untouched', () => {
    const both = profile({
      housing: { city: 'Berlin', monthlyColdRent: 650 },
      income: { grossMonthlyIncome: 1800 },
      household: { children: [{ age: 5 }] },
      benefits: { receivingWohngeld: true, receivingKindergeld: true },
    });
    expect(evaluateKindergeldAwareness(both).state).toBe('COMPLETED');
    expect(evaluateWohngeldAwareness(both).state).toBe('COMPLETED');

    const kindergeldRevoked = profile({
      housing: { city: 'Berlin', monthlyColdRent: 650 },
      income: { grossMonthlyIncome: 1800 },
      household: { children: [{ age: 5 }] },
      benefits: { receivingWohngeld: true, receivingKindergeld: false },
    });
    expect(evaluateKindergeldAwareness(kindergeldRevoked).state).toBe('READY_TO_ACT');
    expect(evaluateWohngeldAwareness(kindergeldRevoked).state).toBe('COMPLETED');

    const summary = summarizeBenefitsAwareness([
      evaluateWohngeldAwareness(kindergeldRevoked),
      evaluateKindergeldAwareness(kindergeldRevoked),
    ]);
    expect(summary.items.find((i) => i.benefitId === KINDERGELD_BENEFIT_ID)?.state).toBe('READY_TO_ACT');
    expect(summary.items.find((i) => i.benefitId === WOHNGELD_BENEFIT_ID)?.state).toBe('COMPLETED');
  });

  it('5 — Housing clears rent via fact.invalidate and view model recalculates', () => {
    const section = getDomainEditSection('where-you-live');
    const base = profile({
      housing: { city: 'Berlin', monthlyColdRent: 650 },
    });
    expect(buildHousingSituationViewModel(base).state).toBe('READY');

    const draft = buildInitialDraft(section, base);
    draft.monthlyColdRent = '';
    const requests = buildDomainCorrectionRequests(section, draft, base, 3);
    const invalidate = requests.find((request) => request.type === 'fact.invalidate');
    expect(invalidate?.payload).toMatchObject({
      domain: 'housing',
      fields: { monthlyColdRent: null },
    });

    const after = profile({ housing: { city: 'Berlin' } });
    expect(buildHousingSituationViewModel(after).state).toBe('INCOMPLETE');
  });

  it('6 — taxClass clear via fact.invalidate returns Tax Admin to NOT_ADDED/INCOMPLETE', () => {
    const section = getDomainEditSection('work-income');
    const base = profile({
      employment: { taxClass: 3, churchTax: false },
    });
    expect(buildTaxAdministrationViewModel(base).state).toBe('READY');

    const draft = buildInitialDraft(section, base);
    draft.taxClass = '';
    const requests = buildDomainCorrectionRequests(section, draft, base, 4);
    expect(requests.some((request) => request.type === 'fact.invalidate')).toBe(true);
    expect(
      requests.find((request) => request.type === 'fact.invalidate')?.payload
    ).toMatchObject({ fields: { taxClass: null } });

    const after = profile({ employment: { churchTax: false } });
    expect(buildTaxAdministrationViewModel(after).state).toBe('INCOMPLETE');
  });

  it('7 — churchTax unknown survives unrelated income save; true→undefined invalidate supported', () => {
    const section = getDomainEditSection('work-income');
    const unknown = profile({
      employment: { taxClass: 1 },
      income: { grossMonthlyIncome: 2000 },
    });
    const draft = buildInitialDraft(section, unknown);
    draft.grossMonthlyIncome = 2200;
    const requests = buildDomainCorrectionRequests(section, draft, unknown, 1);
    expect(requests.every((request) => !('churchTax' in ((request.payload as { fields?: object }).fields ?? {})))).toBe(
      true
    );
    expect(buildTaxAdministrationViewModel(unknown).knownFacts.find((f) => f.factId === 'churchTax')?.presence).toBe(
      'UNKNOWN'
    );

    const known = profile({ employment: { taxClass: 1, churchTax: true } });
    const clearDraft = buildInitialDraft(section, known);
    clearDraft.churchTax = '';
    const clearRequests = buildDomainCorrectionRequests(section, clearDraft, known, 2);
    expect(clearRequests.find((request) => request.type === 'fact.invalidate')?.payload).toMatchObject({
      fields: { churchTax: null },
    });
  });

  it('8 — Healthcare insuranceType clear emits invalidate when previously known', () => {
    const section = getDomainEditSection('health-insurance');
    const base = profile({
      healthInsurance: { insuranceType: 'public', hasCoverage: true },
    });
    const draft = buildInitialDraft(section, base);
    draft.insuranceType = '';
    const requests = buildDomainCorrectionRequests(section, draft, base, 1);
    expect(requests.find((request) => request.type === 'fact.invalidate')?.payload).toMatchObject({
      fields: { insuranceType: null },
    });
  });

  it('9 — Employment status clear does not invent Discovery mutations', () => {
    const section = getDomainEditSection('work-income');
    const base = profile({ employment: { employmentStatus: 'employed', taxClass: 1 } });
    const draft = buildInitialDraft(section, base);
    draft.employmentStatus = '';
    const requests = buildDomainCorrectionRequests(section, draft, base, 1);
    expect(requests.every((request) => request.domain === 'employment')).toBe(true);
    expect(requests.some((request) => /discovery/i.test(JSON.stringify(request)))).toBe(false);
  });

  it('10 — failed mutation path: empty draft produces no requests (derived unchanged)', () => {
    const section = getDomainEditSection('work-income');
    const base = profile({
      employment: { taxClass: 2 },
      income: { grossMonthlyIncome: 1500 },
    });
    const draft = buildInitialDraft(section, base);
    expect(buildDomainCorrectionRequests(section, draft, base, 1)).toHaveLength(0);
    expect(buildTaxAdministrationViewModel(base).state).toBe('READY');
  });

  it('11 — revision conflict boundary: builder still emits expectedHeadRevision for invalidate', () => {
    const section = getDomainEditSection('where-you-live');
    const base = profile({ housing: { city: 'Berlin', monthlyColdRent: 700 } });
    const draft = buildInitialDraft(section, base);
    draft.city = '';
    const requests = buildDomainCorrectionRequests(section, draft, base, 9);
    expect(requests[0]?.expectedHeadRevision).toBe(9);
    expect(requests[0]?.type).toBe('fact.invalidate');
  });

  it('12 — reload reconstructs reversed registration from authoritative false', () => {
    const snapshot = profile({
      housing: { city: 'Berlin', monthlyColdRent: 650 },
      migration: { municipalRegistrationConfirmed: false },
      income: { grossMonthlyIncome: 1800 },
      benefits: { receivingWohngeld: false },
      employment: { taxClass: 3 },
    });
    expect(deriveRegistrationUxState({ schemaVersion: '1.0.0', profile: snapshot }).state).toBe(
      'actionable'
    );
    expect(buildHousingSituationViewModel(snapshot).state).toBe('READY');
    expect(evaluateWohngeldAwareness(snapshot).state).toBe('READY_TO_ACT');
    expect(buildTaxAdministrationViewModel(snapshot).state).toBe('READY');
    expect(buildTaxAdministrationViewModel(structuredClone(snapshot))).toEqual(
      buildTaxAdministrationViewModel(snapshot)
    );
  });

  it('14 — localization-facing benefit revoke keeps COMPLETED only for true', () => {
    const revoked = evaluateWohngeldAwareness(
      profile({
        housing: { city: 'Berlin', monthlyColdRent: 650 },
        income: { grossMonthlyIncome: 1800 },
        benefits: { receivingWohngeld: false },
      })
    );
    expect(revoked.state).not.toBe('COMPLETED');
    expect(revoked.explanationKey).not.toMatch(/completed/i);
  });
});
