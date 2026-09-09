import { describe, expect, it } from 'vitest';
import type { UserProfileViewV1 } from '@arrival-atlas/product-contract';
import { evaluateWohngeldAwareness } from './wohngeld-awareness.js';

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

describe('E4 Wohngeld awareness', () => {
  it('NOT_ENOUGH_INFORMATION when rent and income are missing', () => {
    const result = evaluateWohngeldAwareness(baseProfile({ housing: { city: 'Berlin' } }));
    expect(result.state).toBe('NOT_ENOUGH_INFORMATION');
    expect(result.missingFieldKeys.length).toBeGreaterThan(0);
    expect(result.nextAction.kind).toBe('update_housing');
    expect(result.nextAction.href).toContain('where-you-live');
    expect(result.explanationKey).not.toMatch(/eligible/i);
  });

  it('NOT_ENOUGH_INFORMATION when rent known but income missing', () => {
    const result = evaluateWohngeldAwareness(
      baseProfile({
        housing: { city: 'Berlin', monthlyColdRent: 650 },
      })
    );
    expect(result.state).toBe('NOT_ENOUGH_INFORMATION');
    expect(result.engine.missingFields.some((f) => f.includes('grossMonthlyIncome'))).toBe(true);
    expect(result.nextAction.href).toContain('work-income');
  });

  it('READY_TO_ACT (potentially relevant) when rented + income under seed threshold', () => {
    const result = evaluateWohngeldAwareness(
      baseProfile({
        housing: { city: 'Berlin', monthlyColdRent: 650 },
        income: { grossMonthlyIncome: 1800 },
      })
    );
    expect(result.state).toBe('READY_TO_ACT');
    expect(result.engine.heuristicMatch).toBe(true);
    expect(result.nextAction.kind).toBe('open_official_source');
    expect(result.nextAction.href).toMatch(/^https:\/\//);
    expect(result.explanationKey).toBe('benefits.awareness.wohngeld.readyToAct');
  });

  it('NOT_APPLICABLE when income above seed heuristic threshold', () => {
    const result = evaluateWohngeldAwareness(
      baseProfile({
        housing: { city: 'Berlin', monthlyColdRent: 650 },
        income: { grossMonthlyIncome: 5000 },
      })
    );
    expect(result.state).toBe('NOT_APPLICABLE');
    expect(result.engine.heuristicMatch).toBe(false);
  });

  it('COMPLETED when receivingWohngeld is true', () => {
    const result = evaluateWohngeldAwareness(
      baseProfile({
        housing: { city: 'Berlin', monthlyColdRent: 650 },
        income: { grossMonthlyIncome: 1800 },
        benefits: { receivingWohngeld: true },
      })
    );
    expect(result.state).toBe('COMPLETED');
    expect(result.nextAction.href).toContain('benefits-support');
  });

  it('does not claim official eligibility in explanation keys', () => {
    const result = evaluateWohngeldAwareness(
      baseProfile({
        housing: { monthlyColdRent: 500 },
        income: { grossMonthlyIncome: 1200 },
      })
    );
    expect(result.disclaimerKey).toBe('benefits.awareness.disclaimer');
    expect(JSON.stringify(result)).not.toMatch(/You are eligible|you qualify|will receive/i);
  });
});
