import { describe, expect, it } from 'vitest';
import type { LifeEventPlanV1, UserContextV1, UserProfileViewV1 } from '@/lib/product-contract';
import { resolveScenario } from './resolve-scenario';

function profile(overrides: Partial<UserProfileViewV1> = {}): UserContextV1 {
  return {
    profile: {
      schemaVersion: '1.0.0',
      preferences: { preferredLanguage: 'en' },
      completeness: { score: 40, missingDomains: [] },
      domains: {},
      ...overrides,
    },
  };
}

function plan(
  currentLifeState: LifeEventPlanV1['currentLifeState'],
  secondaryConditions: LifeEventPlanV1['secondaryConditions'] = []
): Pick<LifeEventPlanV1, 'currentLifeState' | 'secondaryConditions'> {
  return { currentLifeState, secondaryConditions };
}

describe('resolveScenario (LE-7)', () => {
  it('job loss resolves to economic_setup_pending transition', () => {
    const match = resolveScenario({
      userContext: profile({
        domains: {
          employment: { employmentStatus: 'unemployed' },
          benefits: { daysInGermany: 400 },
        },
      }),
      currentPlan: plan('arrival_stabilizing', ['economic_setup_pending', 'employment_data_missing']),
    });

    expect(match).not.toBeNull();
    expect(match?.scenarioId).toBe('job_loss');
    expect(match?.toState).toBe('economic_setup_pending');
  });

  it('new arrival resolves to arrival_unregistered', () => {
    const match = resolveScenario({
      userContext: profile({
        domains: {
          migration: { residencyStatus: 'work-visa' },
          benefits: { daysInGermany: 30 },
        },
        completeness: { score: 20, missingDomains: ['migration'] },
      }),
      currentPlan: plan('arrival_unregistered', ['registration_incomplete']),
    });

    expect(match).not.toBeNull();
    expect(match?.scenarioId).toBe('new_arrival');
    expect(match?.toState).toBe('arrival_unregistered');
  });

  it('insurance loss resolves to insurance_gap', () => {
    const match = resolveScenario({
      userContext: profile({
        domains: {
          healthInsurance: { insuranceType: 'none', hasCoverage: false },
          employment: { employmentStatus: 'employed' },
        },
      }),
      currentPlan: plan('arrival_stabilizing', ['insurance_gap']),
    });

    expect(match).not.toBeNull();
    expect(match?.scenarioId).toBe('insurance_loss');
    expect(match?.toState).toBe('insurance_gap');
  });

  it('housing change resolves to housing_instability', () => {
    const match = resolveScenario({
      userContext: profile({
        domains: {
          housing: { city: 'Berlin' },
          employment: { employmentStatus: 'employed' },
        },
      }),
      currentPlan: plan('arrival_stabilizing', ['housing_search_active']),
    });

    expect(match).not.toBeNull();
    expect(match?.scenarioId).toBe('housing_change');
    expect(match?.toState).toBe('housing_instability');
  });

  it('stable state with no disruption signals returns null', () => {
    const match = resolveScenario({
      userContext: profile({
        domains: {
          housing: { city: 'Munich', bundesland: 'BY' },
          employment: { employmentStatus: 'employed' },
          healthInsurance: { insuranceType: 'public', hasCoverage: true },
          income: { grossMonthlyIncome: 3500 },
        },
      }),
      currentPlan: plan('situation_stable', []),
    });

    expect(match).toBeNull();
  });

  it('is deterministic for identical inputs', () => {
    const input = {
      userContext: profile({
        domains: {
          employment: { employmentStatus: 'unemployed' },
        },
      }),
      currentPlan: plan('economic_setup_pending', ['economic_setup_pending']),
    };

    expect(resolveScenario(input)).toEqual(resolveScenario(input));
  });
});
