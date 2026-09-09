import { describe, expect, it } from 'vitest';
import type { UserProfileViewV1 } from '@arrival-atlas/product-contract';
import {
  evaluateBenefitsAwareness,
  evaluateBenefitsAwarenessSummary,
  evaluateKindergeldAwareness,
  evaluateWohngeldAwareness,
  orderBenefitsAwarenessForPresentation,
  summarizeBenefitsAwareness,
} from './index.js';

function baseProfile(overrides: Partial<UserProfileViewV1['domains']> = {}): UserProfileViewV1 {
  return {
    schemaVersion: '1.0.0',
    preferences: {},
    completeness: { score: 0, missingDomains: [] },
    domains: {
      ...overrides,
    },
  } as UserProfileViewV1;
}

describe('E7 Benefits awareness aggregation', () => {
  it('A — both actionable: READY_TO_ACT cards ordered with seed tie-break', () => {
    const summary = evaluateBenefitsAwarenessSummary(
      baseProfile({
        housing: { monthlyColdRent: 650 },
        income: { grossMonthlyIncome: 1800 },
        household: { children: [{ age: 5 }] },
      })
    );
    expect(summary.counts.readyToAct).toBe(2);
    expect(summary.focusMode).toBe('ACTIONABLE');
    expect(summary.summaryKey).toBe('benefits.awareness.aggregate.multipleActionable');
    expect(summary.items.map((i) => i.benefitId)).toEqual([
      'de_federal_wohngeld',
      'de_federal_kindergeld',
    ]);
    expect(summary.primaryFocus?.benefitId).toBe('de_federal_wohngeld');
  });

  it('B — completed does not dominate actionable surface', () => {
    const summary = evaluateBenefitsAwarenessSummary(
      baseProfile({
        housing: { monthlyColdRent: 650 },
        income: { grossMonthlyIncome: 1800 },
        household: { children: [{ age: 5 }] },
        benefits: { receivingWohngeld: true },
      })
    );
    expect(summary.items[0]?.state).toBe('READY_TO_ACT');
    expect(summary.items[0]?.benefitId).toBe('de_federal_kindergeld');
    expect(summary.items[1]?.state).toBe('COMPLETED');
    expect(summary.items[1]?.benefitId).toBe('de_federal_wohngeld');
    expect(summary.primaryFocus?.benefitId).toBe('de_federal_kindergeld');
    expect(summary.focusMode).toBe('ACTIONABLE');
  });

  it('C — insufficient information remains visible and explainable', () => {
    const summary = evaluateBenefitsAwarenessSummary(baseProfile({}));
    expect(summary.counts.notEnoughInformation).toBe(2);
    expect(summary.focusMode).toBe('GATHER_INFORMATION');
    expect(summary.summaryKey).toBe('benefits.awareness.aggregate.needInformation');
    expect(summary.primaryFocus?.missingFieldKeys.length).toBeGreaterThan(0);
  });

  it('D — mixed actionable + insufficient', () => {
    const summary = evaluateBenefitsAwarenessSummary(
      baseProfile({
        household: { children: [{ age: 3 }] },
      })
    );
    expect(summary.items[0]?.state).toBe('READY_TO_ACT');
    expect(summary.items[0]?.benefitId).toBe('de_federal_kindergeld');
    expect(summary.items[1]?.state).toBe('NOT_ENOUGH_INFORMATION');
    expect(summary.primaryFocus?.benefitId).toBe('de_federal_kindergeld');
  });

  it('E — all completed: no false action', () => {
    const summary = evaluateBenefitsAwarenessSummary(
      baseProfile({
        housing: { monthlyColdRent: 500 },
        income: { grossMonthlyIncome: 1200 },
        household: { children: [{ age: 2 }] },
        benefits: { receivingWohngeld: true, receivingKindergeld: true },
      })
    );
    expect(summary.counts.completed).toBe(2);
    expect(summary.focusMode).toBe('REVIEW_COMPLETED');
    expect(summary.primaryFocus).toBeNull();
    expect(summary.summaryKey).toBe('benefits.awareness.aggregate.allCompleted');
  });

  it('F — recalculation: mutation changes derived aggregate', () => {
    const before = evaluateBenefitsAwarenessSummary(
      baseProfile({
        housing: { monthlyColdRent: 650 },
        income: { grossMonthlyIncome: 1800 },
        household: { children: [{ age: 5 }] },
      })
    );
    const after = evaluateBenefitsAwarenessSummary(
      baseProfile({
        housing: { monthlyColdRent: 650 },
        income: { grossMonthlyIncome: 1800 },
        household: { children: [{ age: 5 }] },
        benefits: { receivingKindergeld: true },
      })
    );
    expect(before.counts.readyToAct).toBe(2);
    expect(after.counts.readyToAct).toBe(1);
    expect(after.counts.completed).toBe(1);
    expect(after.primaryFocus?.benefitId).toBe('de_federal_wohngeld');
  });

  it('G — Wohngeld regression: individual evaluation unchanged', () => {
    const profile = baseProfile({
      housing: { monthlyColdRent: 650 },
      income: { grossMonthlyIncome: 1800 },
      benefits: { receivingWohngeld: true },
    });
    expect(evaluateWohngeldAwareness(profile).state).toBe('COMPLETED');
    const raw = evaluateBenefitsAwareness(profile);
    expect(raw[0]?.benefitId).toBe('de_federal_wohngeld');
  });

  it('H — Kindergeld regression: individual evaluation unchanged', () => {
    const profile = baseProfile({
      household: { children: [{ age: 4 }] },
      benefits: { receivingKindergeld: true },
    });
    expect(evaluateKindergeldAwareness(profile).state).toBe('COMPLETED');
  });

  it('ordering is deterministic and preserves seed order within a band', () => {
    const raw = evaluateBenefitsAwareness(
      baseProfile({
        housing: { monthlyColdRent: 400 },
        income: { grossMonthlyIncome: 1000 },
        household: { children: [{ age: 1 }] },
      })
    );
    const ordered = orderBenefitsAwarenessForPresentation(raw);
    const again = orderBenefitsAwarenessForPresentation(raw);
    expect(ordered).toEqual(again);
    expect(summarizeBenefitsAwareness(raw).items).toEqual(ordered);
  });
});
