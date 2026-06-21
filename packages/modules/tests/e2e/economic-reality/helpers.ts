import { expect } from 'vitest';
import type {
  EconomicActionSetV1,
  EconomicPlanV1,
  EconomicPresentationV1,
  EconomicRealityPlanResponseV1,
  LifeEventPlanV1,
  UserContextV1,
} from '@arrival-atlas/product-contract';
import { EconomicRealityPlanResponseV1Schema } from '@arrival-atlas/product-contract';
import { buildEconomicRealityPlan } from '../../../src/api/economic-reality/pipeline.js';
import { ECONOMIC_FIXTURES, type EconomicFixture } from '../../../src/economic-reality/fixtures.js';
import { CLASSIFIER_FIXTURES, type ClassifierFixture } from '../../../src/life-event/plan/fixtures.js';

export const E2E_FIXED_META = {
  requestId: 'e2e_journey_request',
  generatedAt: '2026-06-21T12:00:00.000Z',
} as const;

export function economicFixture(id: string): EconomicFixture {
  const fixture = ECONOMIC_FIXTURES.find((entry) => entry.id === id);
  if (!fixture) {
    throw new Error(`Missing economic fixture: ${id}`);
  }
  return fixture;
}

export function lifeEventFixture(id: string): ClassifierFixture {
  const fixture = CLASSIFIER_FIXTURES.find((entry) => entry.id === id);
  if (!fixture) {
    throw new Error(`Missing life-event fixture: ${id}`);
  }
  return fixture;
}

export function buildJourneyEconomicPlan(userContext: UserContextV1): EconomicRealityPlanResponseV1 {
  const response = buildEconomicRealityPlan(userContext, E2E_FIXED_META);
  return EconomicRealityPlanResponseV1Schema.parse(response);
}

export function collectPlanActionIds(plan: EconomicPlanV1): string[] {
  return [
    ...plan.primaryTrack.actions,
    ...(plan.secondaryTrack?.actions ?? []),
    ...plan.systemTrack.actions,
  ].map((action) => action.id);
}

export function collectActionSetIds(actionSet: EconomicActionSetV1): Set<string> {
  return new Set(actionSet.actions.map((action) => action.id));
}

export function assertPlanActionsSubsetOfActionSet(
  plan: EconomicPlanV1,
  actionSet: EconomicActionSetV1
): void {
  const allowed = collectActionSetIds(actionSet);
  for (const actionId of collectPlanActionIds(plan)) {
    if (!allowed.has(actionId)) {
      throw new Error(`Plan action ${actionId} is not present in actionSet`);
    }
  }
}

export function assertPresentationUsesKeysOnly(presentation: EconomicPresentationV1): void {
  const serialized = JSON.stringify(presentation);
  if (serialized.includes('"title":') || serialized.includes('"label":')) {
    throw new Error('Presentation contains raw title/label strings');
  }
}

export function assertDeterministicReplay(
  userContext: UserContextV1
): EconomicRealityPlanResponseV1 {
  const first = buildJourneyEconomicPlan(userContext);
  const second = buildJourneyEconomicPlan(userContext);

  expect(second.meta.deterministicHash).toEqual(first.meta.deterministicHash);
  expect(second.plan).toEqual(first.plan);
  expect(second.presentation).toEqual(first.presentation);
  expect(second.actionSet).toEqual(first.actionSet);
  expect(second.graph).toEqual(first.graph);
  expect(second.execution).toEqual(first.execution);
  expect(second.evaluation).toEqual(first.evaluation);

  return first;
}

export function stabilizeCrisisContext(crisisContext: UserContextV1): UserContextV1 {
  const profile = crisisContext.profile;
  if (!profile) {
    throw new Error('Crisis context must include profile');
  }

  return {
    profile: {
      ...profile,
      domains: {
        ...profile.domains,
        migration: {
          residencyStatus: 'permanent-resident',
          arrivedAt: profile.domains.migration?.arrivedAt,
        },
        employment: { employmentStatus: 'employed' },
        income: { grossMonthlyIncome: 2800 },
        housing: { city: 'Berlin' },
        benefits: {
          receivingBuergergeld: true,
          receivingSozialamtSupport: false,
          daysInGermany: 120,
        },
      },
    },
  };
}

export function lifeEventNodeIds(plan: LifeEventPlanV1): string[] {
  return plan.nextBestActions.map((action) => action.id);
}
