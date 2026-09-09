import { describe, expect, it } from 'vitest';
import { evaluateWohngeldAwareness } from './wohngeld-awareness.js';
import type { UserProfileViewV1 } from '@arrival-atlas/product-contract';

function profile(domains: UserProfileViewV1['domains']): UserProfileViewV1 {
  return {
    schemaVersion: '1.0.0',
    preferences: {},
    completeness: { score: 40, missingDomains: [] },
    domains,
  } as UserProfileViewV1;
}

describe('E13 Wohngeld reversal', () => {
  it('COMPLETED → READY_TO_ACT when receivingWohngeld becomes false', () => {
    const facts = {
      housing: { city: 'Berlin', monthlyColdRent: 650 },
      income: { grossMonthlyIncome: 1800 },
    };
    expect(
      evaluateWohngeldAwareness(profile({ ...facts, benefits: { receivingWohngeld: true } })).state
    ).toBe('COMPLETED');
    expect(
      evaluateWohngeldAwareness(profile({ ...facts, benefits: { receivingWohngeld: false } })).state
    ).toBe('READY_TO_ACT');
  });
});
