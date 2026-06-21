import { describe, expect, it } from 'vitest';
import {
  assertDeterministicReplay,
  assertPlanActionsSubsetOfActionSet,
  assertPresentationUsesKeysOnly,
  buildJourneyEconomicPlan,
  economicFixture,
} from './helpers.js';

describe('E2E Scenario B — stabilized user with employment + benefits (modules)', () => {
  it('returns institution-first plan with profile and reporting actions, no crisis intents', () => {
    const response = assertDeterministicReplay(economicFixture('EF13').userContext);

    expect(['INSTITUTION_FIRST', 'PROGRESSION_FIRST']).toContain(response.plan.orderingStrategy);
    expect(response.evaluation.economicState).toBe('benefits_jobcenter');
    expect(response.presentation.uiStrategy).toBe('INSTITUTION_UI');

    const sectionTypes = response.presentation.sections.map((section) => section.type);
    expect(sectionTypes).toContain('PRIMARY');
    expect(sectionTypes).toContain('SECONDARY');

    const systemSection = response.presentation.sections.find((section) => section.type === 'SYSTEM');
    expect(systemSection?.cards.length ?? 0).toBeLessThanOrEqual(1);

    const crisisIntents = response.actionSet.actions.filter(
      (action) =>
        action.type === 'system_intent' &&
        action.payload.systemIntent === 'initiate_benefit_application'
    );
    expect(crisisIntents).toHaveLength(0);

    const hasProfileUpdate = response.actionSet.actions.some(
      (action) => action.type === 'update_profile'
    );
    const hasIncomeIntent = response.actionSet.actions.some(
      (action) =>
        action.type === 'system_intent' && action.payload.systemIntent === 'report_income_change'
    );
    expect(hasProfileUpdate || hasIncomeIntent).toBe(true);

    const profileCards = response.presentation.sections
      .flatMap((section) => section.cards)
      .filter((card) => card.uiType === 'PROFILE_CARD');
    expect(profileCards.length).toBeGreaterThan(0);

    assertPlanActionsSubsetOfActionSet(response.plan, response.actionSet);
    assertPresentationUsesKeysOnly(response.presentation);
  });

  it('self-sustained user has minimal system surface', () => {
    const response = buildJourneyEconomicPlan(economicFixture('EF01').userContext);

    expect(response.evaluation.economicState).toBe('self_sustained');
    expect(response.presentation.sections.find((section) => section.type === 'SYSTEM')?.cards ?? []).toHaveLength(0);
  });
});
