import { describe, expect, it } from 'vitest';
import { buildLifeEventPlan } from '../../../src/life-event/plan/build-life-event-plan.js';
import {
  resolveCrossModuleLink,
  suggestModulesForLifeContext,
} from '../../../src/module-orchestration/catalog-routing.js';
import {
  assertDeterministicReplay,
  assertPlanActionsSubsetOfActionSet,
  assertPresentationUsesKeysOnly,
  buildJourneyEconomicPlan,
  economicFixture,
  E2E_FIXED_META,
  lifeEventFixture,
  lifeEventNodeIds,
} from './helpers.js';

describe('E2E Scenario A — first-time user → economic assistance path (modules)', () => {
  it('Life Event classifies arrival state and catalog suggests economic-reality', () => {
    const fixture = lifeEventFixture('F01');
    const lifePlan = buildLifeEventPlan({
      userContext: fixture.userContext,
      generatedAt: E2E_FIXED_META.generatedAt,
    });

    expect(lifePlan.currentLifeState).toBe('arrival_unregistered');

    const suggestions = suggestModulesForLifeContext({
      lifeStateId: lifePlan.currentLifeState,
      nodeIds: lifeEventNodeIds(lifePlan),
    });

    expect(suggestions.some((entry) => entry.moduleId === 'economic-reality')).toBe(true);
    expect(suggestions.every((entry) => entry.route.includes('/modules/economic-reality'))).toBe(
      true
    );

    const nodeLink = resolveCrossModuleLink({
      type: 'life_event_node',
      nodeId: 'g2-economic-path',
    });
    expect(nodeLink?.moduleId).toBe('economic-reality');
    expect(nodeLink?.route).toContain('/modules/economic-reality');
  });

  it('crisis user receives CRISIS entry plan with PRIMARY + SYSTEM and benefit intent', () => {
    const response = assertDeterministicReplay(economicFixture('EF07').userContext);

    expect(response.plan.orderingStrategy).toBe('CRISIS_FIRST');
    expect(response.presentation.uiStrategy).toBe('CRISIS_UI');

    const sectionTypes = response.presentation.sections.map((section) => section.type);
    expect(sectionTypes).toContain('PRIMARY');
    expect(sectionTypes).toContain('SYSTEM');

    const hasBenefitIntent = response.actionSet.actions.some(
      (action) =>
        action.type === 'system_intent' &&
        (action.payload.systemIntent === 'initiate_benefit_application' ||
          action.payload.intentKey?.includes('BENEFIT'))
    );
    expect(hasBenefitIntent).toBe(true);

    const planOpenModule = [
      ...response.plan.primaryTrack.actions,
      ...(response.plan.secondaryTrack?.actions ?? []),
      ...response.plan.systemTrack.actions,
    ].find(
      (action) => action.type === 'open_module' && action.payload.moduleId === 'economic-reality'
    );
    if (planOpenModule?.payload.href) {
      expect(planOpenModule.payload.href).toContain('/modules/economic-reality');
      expect(planOpenModule.payload.href).toContain('entry=CRISIS');
    }

    const crisisCatalogEntry = resolveCrossModuleLink({
      type: 'life_event_type',
      eventType: 'job_loss',
    });
    expect(crisisCatalogEntry?.entrypoint).toBe('CRISIS');

    assertPlanActionsSubsetOfActionSet(response.plan, response.actionSet);
    assertPresentationUsesKeysOnly(response.presentation);
  });

  it('institution-path user receives progression plan with jobcenter intent', () => {
    const response = buildJourneyEconomicPlan(economicFixture('EF03').userContext);

    expect(response.plan.orderingStrategy).toBe('PROGRESSION_FIRST');
    expect(response.presentation.sections.some((section) => section.type === 'PRIMARY')).toBe(true);

    const hasInstitutionIntent = response.actionSet.actions.some(
      (action) =>
        action.type === 'system_intent' && action.payload.systemIntent === 'start_jobcenter_process'
    );
    expect(hasInstitutionIntent).toBe(true);
  });
});
