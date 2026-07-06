import { describe, expect, it } from 'vitest';
import { GERMANY_SEED_BENEFITS } from '../ingestion/seeds/germany-seed-benefits.js';
import { MbdeUserProfileSchema } from '../types/user-profile.js';
import { buildImpactSummary, computeAllBenefits } from './opportunity-engine.js';

describe('opportunity-engine', () => {
  const lowIncomeFamily = MbdeUserProfileSchema.parse({
    location: { country: 'DE', state: 'BE', city: 'Berlin' },
    household: [
      { id: 'primary', role: 'primary' },
      { id: 'child-1', role: 'child', age: 6 },
    ],
    financial: {
      netMonthlyIncome: 900,
      grossMonthlyIncome: 1200,
      benefitsAlreadyReceiving: [],
    },
    housing: { type: 'rented', monthlyRent: 950, householdSize: 2 },
    employment: { status: 'unemployed' },
    education: { studentStatus: false },
    health: { insuranceType: 'public', mobilityLimitations: 'uses walker' },
  });

  it('mines multiple opportunities for a household', () => {
    const opportunities = computeAllBenefits(lowIncomeFamily, GERMANY_SEED_BENEFITS);
    expect(opportunities.length).toBeGreaterThan(3);
    expect(opportunities[0]!.totalScore).toBeGreaterThan(opportunities.at(-1)!.totalScore);
  });

  it('builds impact summary with category buckets', () => {
    const opportunities = computeAllBenefits(lowIncomeFamily, GERMANY_SEED_BENEFITS);
    const summary = buildImpactSummary(opportunities);

    expect(summary.totalOpportunities).toBe(opportunities.length);
    expect(summary.estimatedAnnualValueExpected).toBeGreaterThan(0);
    expect(Object.keys(summary.byCategory).length).toBeGreaterThan(0);
  });

  it('excludes already received benefits', () => {
    const profile = MbdeUserProfileSchema.parse({
      ...lowIncomeFamily,
      financial: {
        ...lowIncomeFamily.financial,
        benefitsAlreadyReceiving: ['de_federal_buergergeld'],
      },
    });

    const opportunities = computeAllBenefits(profile, GERMANY_SEED_BENEFITS);
    expect(opportunities.every((item) => item.benefit.id !== 'de_federal_buergergeld')).toBe(true);
  });
});
