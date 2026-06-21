import { describe, expect, it } from 'vitest';
import type { EconomicActionV1 } from '@arrival-atlas/product-contract';
import { ACTION_TYPE_ORDER } from './actions/types.js';
import { evaluate } from './rule-engine/evaluate.js';
import { resolveGraphContext } from './graph/resolve-graph.js';
import { buildExecutionState } from './execution/build-execution-state.js';
import { buildActionSet } from './actions/build-action-set.js';
import { buildPlan } from './planner/build-plan.js';
import { RULE_IDS } from './planner/types.js';
import { ECONOMIC_FIXTURES } from './fixtures.js';

function buildFullPlan(fixtureId: string) {
  const fixture = ECONOMIC_FIXTURES.find((entry) => entry.id === fixtureId);
  if (!fixture) {
    throw new Error(`Missing fixture ${fixtureId}`);
  }
  const evaluation = evaluate(fixture.userContext);
  const graphContext = resolveGraphContext(evaluation);
  const execution = buildExecutionState(graphContext, fixture.userContext);
  const actionSet = buildActionSet(execution, fixture.userContext);
  const plan = buildPlan(execution, actionSet, fixture.userContext);
  return { fixture, execution, actionSet, plan };
}

function allPlanActions(plan: ReturnType<typeof buildPlan>) {
  return [
    ...plan.primaryTrack.actions,
    ...(plan.secondaryTrack?.actions ?? []),
    ...plan.systemTrack.actions,
  ];
}

function assertPlanInvariants(
  plan: ReturnType<typeof buildPlan>,
  actionSet: ReturnType<typeof buildActionSet>
) {
  const actionIds = new Set(actionSet.actions.map((action) => action.id));
  const emitted = allPlanActions(plan);

  expect(emitted.length).toBeLessThanOrEqual(actionSet.actions.length);
  for (const action of emitted) {
    expect(actionIds.has(action.id)).toBe(true);
    expect(action.sourceNodeId.length).toBeGreaterThan(0);
  }

  const unique = new Set(emitted.map((action) => action.id));
  expect(unique.size).toBe(emitted.length);

  for (const action of plan.primaryTrack.actions) {
    if (plan.orderingStrategy === 'CRISIS_FIRST') {
      expect(action.type).not.toBe('external_resource');
    }
  }

  for (const action of [...(plan.secondaryTrack?.actions ?? [])]) {
    expect(action.type).not.toBe('external_resource');
  }

  expect(plan.reasoning.appliedRules).toContain(RULE_IDS.P3);
  expect(plan.reasoning.appliedRules).toContain(RULE_IDS.P4);
  expect(plan.reasoning.appliedRules).toContain(RULE_IDS.P5);
}

function assertDependencyOrder(actions: EconomicActionV1[], prerequisite: string, dependent: string) {
  const prerequisiteIndex = actions.findIndex((action) => action.sourceNodeId === prerequisite);
  const dependentIndex = actions.findIndex((action) => action.sourceNodeId === dependent);
  if (prerequisiteIndex === -1 || dependentIndex === -1) {
    return;
  }
  expect(prerequisiteIndex).toBeLessThan(dependentIndex);
}

describe('buildPlan EP-5 planner layer', () => {
  for (const fixture of ECONOMIC_FIXTURES) {
    it(`${fixture.id} produces deterministic plan invariants`, () => {
      const evaluation = evaluate(fixture.userContext);
      const graphContext = resolveGraphContext(evaluation);
      const execution = buildExecutionState(graphContext, fixture.userContext);
      const actionSet = buildActionSet(execution, fixture.userContext);
      const first = buildPlan(execution, actionSet, fixture.userContext);
      const second = buildPlan(execution, actionSet, fixture.userContext);
      expect(second).toEqual(first);
      assertPlanInvariants(first, actionSet);
    });
  }

  it('EF03 → PROGRESSION_FIRST with active actions in primary track', () => {
    const { plan } = buildFullPlan('EF03');

    expect(plan.orderingStrategy).toBe('PROGRESSION_FIRST');
    expect(plan.reasoning.appliedRules).toContain(RULE_IDS.P2);
    expect(plan.primaryTrack.actions.length).toBeGreaterThan(0);
    expect(plan.primaryTrack.actions.every((action) => action.type !== 'external_resource')).toBe(true);
    expect(plan.systemTrack.actions.some((action) => action.type === 'external_resource')).toBe(true);
  });

  it('EF05 → INSTITUTION_FIRST elevates system_intent to primary track', () => {
    const { plan } = buildFullPlan('EF05');

    expect(plan.orderingStrategy).toBe('INSTITUTION_FIRST');
    expect(plan.reasoning.appliedRules).toContain(RULE_IDS.P1);
    expect(plan.primaryTrack.actions[0]?.type).toBe('system_intent');
    expect(plan.primaryTrack.actions.some((action) => action.payload.systemIntent === 'report_income_change')).toBe(true);
    expect(plan.secondaryTrack?.actions.some((action) => action.type === 'update_profile')).toBe(true);
  });

  it('EF07 → CRISIS_FIRST with initiate_benefit_application first in primary', () => {
    const { plan } = buildFullPlan('EF07');

    expect(plan.orderingStrategy).toBe('CRISIS_FIRST');
    expect(plan.reasoning.appliedRules).toContain(RULE_IDS.P0);
    expect(plan.primaryTrack.actions[0]?.payload.systemIntent).toBe('initiate_benefit_application');
    expect(plan.systemTrack.actions.some((action) => action.type === 'external_resource')).toBe(true);
    expect(plan.primaryTrack.priority).toBeGreaterThan(plan.systemTrack.priority);
  });

  it('EF08 → INSTITUTION_FIRST for active Sozialamt support', () => {
    const { plan } = buildFullPlan('EF08');

    expect(plan.orderingStrategy).toBe('INSTITUTION_FIRST');
    expect(plan.primaryTrack.actions.some((action) => action.sourceNodeId === 'g6-payment-setup')).toBe(true);
    expect(plan.secondaryTrack?.actions.some((action) => action.type === 'update_profile')).toBe(true);
    expect(plan.systemTrack.actions.some((action) => action.type === 'external_resource')).toBe(false);
  });

  it('EF13 → INSTITUTION_FIRST with profile actions in secondary track', () => {
    const { plan } = buildFullPlan('EF13');

    expect(plan.orderingStrategy).toBe('INSTITUTION_FIRST');
    expect(plan.secondaryTrack?.actions.length).toBeGreaterThan(0);
    expect(plan.secondaryTrack?.actions.every((action) => action.type === 'update_profile' || action.type === 'open_module')).toBe(true);
    expect(allPlanActions(plan).some((action) => action.type === 'system_intent')).toBe(false);
  });

  it('preserves dependency order across tracks (P4)', () => {
    const { plan } = buildFullPlan('EF03');
    const ordered = [
      ...(plan.secondaryTrack?.actions ?? []),
      ...plan.primaryTrack.actions,
    ];
    assertDependencyOrder(ordered, 'g2-registration', 'g2-jobcenter-appointment');
  });

  it('orders actions by type priority within the same node (P3)', () => {
    const { plan } = buildFullPlan('EF05');
    const grouped = plan.primaryTrack.actions.filter(
      (action) => action.sourceNodeId === 'g3-income-changes'
    );
    if (grouped.length >= 2) {
      expect(ACTION_TYPE_ORDER[grouped[0]!.type]).toBeLessThanOrEqual(
        ACTION_TYPE_ORDER[grouped[1]!.type]
      );
    }
  });

  it('does not mutate execution or action set inputs', () => {
    const { execution, actionSet, fixture } = buildFullPlan('EF12');
    const executionSnapshot = structuredClone(execution);
    const actionSetSnapshot = structuredClone(actionSet);
    buildPlan(execution, actionSet, fixture.userContext);
    expect(execution).toEqual(executionSnapshot);
    expect(actionSet).toEqual(actionSetSnapshot);
  });
});
