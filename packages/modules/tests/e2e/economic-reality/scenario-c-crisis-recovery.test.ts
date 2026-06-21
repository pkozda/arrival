import { describe, expect, it } from 'vitest';
import {
  assertPlanActionsSubsetOfActionSet,
  buildJourneyEconomicPlan,
  economicFixture,
  stabilizeCrisisContext,
} from './helpers.js';

describe('E2E Scenario C — crisis recovery progression (modules)', () => {
  it('transitions from CRISIS_FIRST to institution path after profile stabilization', () => {
    const crisisFixture = economicFixture('EF07');
    const before = buildJourneyEconomicPlan(crisisFixture.userContext);
    const after = buildJourneyEconomicPlan(stabilizeCrisisContext(crisisFixture.userContext));

    expect(before.plan.orderingStrategy).toBe('CRISIS_FIRST');
    expect(before.presentation.uiStrategy).toBe('CRISIS_UI');
    expect(before.evaluation.economicState).toBe('financial_crisis');

    expect(after.meta.deterministicHash).not.toEqual(before.meta.deterministicHash);
    expect(after.plan.orderingStrategy).toBe('INSTITUTION_FIRST');
    expect(['benefits_jobcenter', 'employment_active', 'self_sustained']).toContain(
      after.evaluation.economicState
    );
    expect(after.presentation.uiStrategy).not.toBe('CRISIS_UI');

    assertPlanActionsSubsetOfActionSet(before.plan, before.actionSet);
    assertPlanActionsSubsetOfActionSet(after.plan, after.actionSet);
  });
});
