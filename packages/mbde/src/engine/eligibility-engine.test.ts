import { describe, expect, it } from 'vitest';
import { evaluateEligibility } from './eligibility-engine.js';
import { and, condition, or } from '../types/rules.js';

describe('eligibility-engine', () => {
  it('evaluates AND rules', () => {
    const rules = and(
      condition('financial.netMonthlyIncome', 'lt', 1500),
      condition('hasChildren', 'eq', true)
    );

    const eligible = evaluateEligibility(rules, {
      'financial.netMonthlyIncome': 900,
      hasChildren: true,
    });

    expect(eligible.eligible).toBe(true);
    expect(eligible.confidence).toBeGreaterThan(0.5);
  });

  it('supports probabilistic partial match', () => {
    const rules = or(
      condition('health.disabilityDegree', 'gte', 50),
      condition('health.mobilityLimitations', 'exists')
    );

    const partial = evaluateEligibility(rules, {
      'health.mobilityLimitations': 'uses walker',
    });

    expect(partial.eligible).toBe(true);
    expect(partial.confidence).toBeGreaterThan(0.35);
  });

  it('reports missing fields', () => {
    const rules = condition('housing.monthlyRent', 'gt', 800);
    const result = evaluateEligibility(rules, {});

    expect(result.eligible).toBe(false);
    expect(result.missingFields).toContain('housing.monthlyRent');
  });
});
