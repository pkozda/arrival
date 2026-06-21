import { describe, expect, it } from 'vitest';
import type { EconomicPlanV1 } from '@arrival-atlas/product-contract';
import { evaluate } from './rule-engine/evaluate.js';
import { resolveGraphContext } from './graph/resolve-graph.js';
import { buildExecutionState } from './execution/build-execution-state.js';
import { buildActionSet } from './actions/build-action-set.js';
import { buildPlan } from './planner/build-plan.js';
import { buildPresentation } from './presentation/build-presentation.js';
import { SECTION_ORDER } from './presentation/types.js';
import { ECONOMIC_FIXTURES } from './fixtures.js';

function buildFullPresentation(fixtureId: string) {
  const fixture = ECONOMIC_FIXTURES.find((entry) => entry.id === fixtureId);
  if (!fixture) {
    throw new Error(`Missing fixture ${fixtureId}`);
  }
  const evaluation = evaluate(fixture.userContext);
  const graphContext = resolveGraphContext(evaluation);
  const execution = buildExecutionState(graphContext, fixture.userContext);
  const actionSet = buildActionSet(execution, fixture.userContext);
  const plan = buildPlan(execution, actionSet, fixture.userContext);
  const presentation = buildPresentation(plan, actionSet);
  return { fixture, plan, presentation, actionSet };
}

function allPlanActionIds(plan: EconomicPlanV1): string[] {
  return [
    ...plan.primaryTrack.actions,
    ...(plan.secondaryTrack?.actions ?? []),
    ...plan.systemTrack.actions,
  ].map((action) => action.id);
}

function allCardActionRefIds(presentation: ReturnType<typeof buildPresentation>): string[] {
  return presentation.sections.flatMap((section) =>
    section.cards.flatMap((card) => card.actionRefIds)
  );
}

function assertPresentationInvariants(
  presentation: ReturnType<typeof buildPresentation>,
  plan: EconomicPlanV1
) {
  expect(presentation.metadata.generatedFromPlanId).toBe(plan.planId);
  expect(presentation.graphId).toBe(plan.graphId);
  expect(presentation.presentationId).toBe(`${plan.planId}::presentation`);

  const planActionIds = allPlanActionIds(plan);
  const cardActionIds = allCardActionRefIds(presentation);

  expect(cardActionIds.sort()).toEqual(planActionIds.sort());
  expect(new Set(cardActionIds).size).toBe(cardActionIds.length);

  const sectionTypes = presentation.sections.map((section) => section.type);
  expect(sectionTypes[0]).toBe('PRIMARY');
  expect(sectionTypes[sectionTypes.length - 1]).toBe('SYSTEM');

  const ordered = sectionTypes.filter((type) => type !== 'SECONDARY');
  expect(ordered).toEqual(['PRIMARY', 'SYSTEM']);

  const primarySection = presentation.sections.find((section) => section.type === 'PRIMARY');
  expect(primarySection?.priority).toBe(plan.primaryTrack.priority);

  const systemSection = presentation.sections.find((section) => section.type === 'SYSTEM');
  expect(systemSection?.priority).toBe(plan.systemTrack.priority);

  for (const card of presentation.sections.flatMap((section) => section.cards)) {
    expect(card.actionRefIds.length).toBeGreaterThan(0);
    expect(card.cardId.length).toBeGreaterThan(0);
  }

  expect(presentation.primaryHighlight.dominantActionRefIds.length).toBeGreaterThan(0);
}

describe('buildPresentation EP-6 presentation layer', () => {
  for (const fixture of ECONOMIC_FIXTURES) {
    it(`${fixture.id} produces deterministic presentation invariants`, () => {
      const evaluation = evaluate(fixture.userContext);
      const graphContext = resolveGraphContext(evaluation);
      const execution = buildExecutionState(graphContext, fixture.userContext);
      const actionSet = buildActionSet(execution, fixture.userContext);
      const plan = buildPlan(execution, actionSet, fixture.userContext);
      const first = buildPresentation(plan, actionSet);
      const second = buildPresentation(plan, actionSet);
      expect(second).toEqual(first);
      assertPresentationInvariants(first, plan);
    });
  }

  it('EF03 → PROGRESSION_UI with PRIMARY and SYSTEM sections', () => {
    const { presentation, plan } = buildFullPresentation('EF03');

    expect(presentation.uiStrategy).toBe('PROGRESSION_UI');
    expect(plan.orderingStrategy).toBe('PROGRESSION_FIRST');
    expect(presentation.sections.map((section) => section.type)).toEqual(
      expect.arrayContaining(['PRIMARY', 'SYSTEM'])
    );
    expect(presentation.sections[0]?.type).toBe('PRIMARY');
    expect(presentation.systemHighlights.length).toBeGreaterThan(0);
  });

  it('EF05 → INSTITUTION_UI with high-severity primary cards', () => {
    const { presentation } = buildFullPresentation('EF05');

    expect(presentation.uiStrategy).toBe('INSTITUTION_UI');
    const primaryCards = presentation.sections.find((section) => section.type === 'PRIMARY')?.cards ?? [];
    expect(primaryCards.some((card) => card.severity === 'high')).toBe(true);
    expect(primaryCards.some((card) => card.uiType === 'PROFILE_CARD')).toBe(true);
    expect(presentation.systemHighlights.length).toBeGreaterThan(0);
  });

  it('EF07 → CRISIS_UI elevates system highlights', () => {
    const { presentation } = buildFullPresentation('EF07');

    expect(presentation.uiStrategy).toBe('CRISIS_UI');
    expect(presentation.primaryHighlight.dominantActionRefIds[0]).toContain('g5-system-entry');
    expect(presentation.systemHighlights.length).toBeGreaterThan(0);
    const systemCards = presentation.sections.find((section) => section.type === 'SYSTEM')?.cards ?? [];
    expect(systemCards.some((card) => card.uiType === 'RESOURCE_CARD')).toBe(true);
  });

  it('EF08 → INSTITUTION_UI maps profile cards to secondary section', () => {
    const { presentation } = buildFullPresentation('EF08');

    expect(presentation.uiStrategy).toBe('INSTITUTION_UI');
    const secondaryCards =
      presentation.sections.find((section) => section.type === 'SECONDARY')?.cards ?? [];
    expect(secondaryCards.some((card) => card.uiType === 'PROFILE_CARD')).toBe(true);
  });

  it('EF13 → INSTITUTION_UI preserves 1:1 action mapping without system intents', () => {
    const { presentation, plan } = buildFullPresentation('EF13');

    expect(presentation.uiStrategy).toBe('INSTITUTION_UI');
    expect(allCardActionRefIds(presentation).sort()).toEqual(allPlanActionIds(plan).sort());
    expect(
      presentation.sections
        .flatMap((section) => section.cards)
        .some((card) => card.uiType === 'INTENT_CARD')
    ).toBe(false);
  });

  it('maps report_income_change system_intent to PROFILE_CARD', () => {
    const { presentation } = buildFullPresentation('EF05');
    const profileCards = presentation.sections
      .flatMap((section) => section.cards)
      .filter((card) => card.uiType === 'PROFILE_CARD');

    expect(profileCards.length).toBeGreaterThan(0);
    expect(
      profileCards.some((card) =>
        card.actionRefIds.some((actionId) => actionId.includes('report-income'))
      )
    ).toBe(true);
  });

  it('sections follow S1 ordering', () => {
    const { presentation } = buildFullPresentation('EF05');
    const types = presentation.sections.map((section) => section.type);
    const indices = types.map((type) => SECTION_ORDER.indexOf(type));
    for (let index = 1; index < indices.length; index += 1) {
      expect(indices[index]!).toBeGreaterThan(indices[index - 1]!);
    }
  });

  it('does not mutate plan input', () => {
    const { plan, actionSet } = buildFullPresentation('EF12');
    const snapshot = structuredClone(plan);
    buildPresentation(plan, actionSet);
    expect(plan).toEqual(snapshot);
  });
});
