import { describe, expect, it } from 'vitest';
import type { EconomicActionV1 } from '@arrival-atlas/product-contract';
import { ER_COPY_KEYS } from '@arrival-atlas/product-contract';
import { evaluate } from './rule-engine/evaluate.js';
import { resolveGraphContext } from './graph/resolve-graph.js';
import { buildExecutionState } from './execution/build-execution-state.js';
import { buildActionSet } from './actions/build-action-set.js';
import { ACTION_TYPE_ORDER } from './actions/types.js';
import { ECONOMIC_FIXTURES } from './fixtures.js';

function buildPipeline(fixtureId: string) {
  const fixture = ECONOMIC_FIXTURES.find((entry) => entry.id === fixtureId);
  if (!fixture) {
    throw new Error(`Missing fixture ${fixtureId}`);
  }
  const evaluation = evaluate(fixture.userContext);
  const graphContext = resolveGraphContext(evaluation);
  const execution = buildExecutionState(graphContext, fixture.userContext);
  const actionSet = buildActionSet(execution, fixture.userContext);
  return { fixture, execution, actionSet };
}

function actionsForNode(actions: EconomicActionV1[], nodeId: string) {
  return actions.filter((action) => action.sourceNodeId === nodeId);
}

function assertActionSetInvariants(
  actionSet: ReturnType<typeof buildActionSet>,
  execution: ReturnType<typeof buildExecutionState>
) {
  expect(actionSet.actions.length).toBeGreaterThanOrEqual(0);
  expect(actionSet.metadata.sourceExecutionId).toBe(execution.reasoning.initializedFrom);
  expect(actionSet.metadata.derivedFromNodes.sort()).toEqual(
    [...new Set(actionSet.actions.map((action) => action.sourceNodeId))].sort()
  );

  for (const action of actionSet.actions) {
    expect(action.sourceNodeId.length).toBeGreaterThan(0);
    expect(action.origin.nodeId).toBe(action.sourceNodeId);
    expect(action.origin.graphId).toBe(actionSet.graphId);
  }

  const ids = actionSet.actions.map((action) => action.id);
  expect(new Set(ids).size).toBe(ids.length);

  for (let index = 1; index < actionSet.actions.length; index += 1) {
    const previous = actionSet.actions[index - 1]!;
    const current = actionSet.actions[index]!;
    const typeDiff = ACTION_TYPE_ORDER[previous.type] - ACTION_TYPE_ORDER[current.type];
    expect(typeDiff).toBeLessThanOrEqual(0);
  }

  for (const action of actionSet.actions) {
    const node = execution.nodes[action.sourceNodeId];
    expect(node).toBeDefined();

    if (node?.status === 'completed') {
      expect(action.type).not.toBe('external_resource');
    }

    if (node?.status === 'locked') {
      expect(action.type).toBe('system_intent');
    }

    if (node?.status === 'active' && node.blockedBy.length > 0) {
      expect(action.type).toBe('system_intent');
    }
  }
}

describe('buildActionSet EP-4 action layer', () => {
  for (const fixture of ECONOMIC_FIXTURES) {
    it(`${fixture.id} produces deterministic action invariants`, () => {
      const evaluation = evaluate(fixture.userContext);
      const graphContext = resolveGraphContext(evaluation);
      const execution = buildExecutionState(graphContext, fixture.userContext);
      const first = buildActionSet(execution, fixture.userContext);
      const second = buildActionSet(execution, fixture.userContext);
      expect(second).toEqual(first);
      assertActionSetInvariants(first, execution);
    });
  }

  it('EF03 → G2 Jobcenter onboarding actions from active nodes', () => {
    const { actionSet } = buildPipeline('EF03');

    expect(actionSet.graphId).toBe('G2');
    expect(actionsForNode(actionSet.actions, 'g2-registration')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'update_profile', payload: expect.objectContaining({ profileKey: 'where-you-live' }) }),
      ])
    );
    expect(actionsForNode(actionSet.actions, 'g2-jobcenter-appointment')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'system_intent', payload: expect.objectContaining({ systemIntent: 'start_jobcenter_process' }) }),
        expect.objectContaining({ type: 'external_resource', payload: expect.objectContaining({ externalSystem: 'jobcenter' }) }),
      ])
    );
  });

  it('EF05 → G3 reporting intent from active income-change node', () => {
    const { actionSet } = buildPipeline('EF05');

    expect(actionSet.graphId).toBe('G3');
    expect(actionsForNode(actionSet.actions, 'g3-income-changes')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'system_intent', payload: expect.objectContaining({ systemIntent: 'report_income_change' }) }),
      ])
    );
    expect(actionsForNode(actionSet.actions, 'g3-reporting')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'update_profile', payload: expect.objectContaining({ profileKey: 'benefits-support' }) }),
      ])
    );
    expect(actionsForNode(actionSet.actions, 'g3-reporting').some((action) => action.type === 'system_intent')).toBe(false);
  });

  it('EF07 → G5 crisis external + system intent actions', () => {
    const { actionSet } = buildPipeline('EF07');

    expect(actionSet.graphId).toBe('G5');
    expect(actionsForNode(actionSet.actions, 'g5-immediate-needs')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'external_resource',
          labelKey: ER_COPY_KEYS.ACTION_CRISIS_RESOURCES,
        }),
      ])
    );
    expect(actionsForNode(actionSet.actions, 'g5-system-entry')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'system_intent',
          payload: expect.objectContaining({ systemIntent: 'initiate_benefit_application' }),
          constraints: expect.objectContaining({ requiresConfirmation: true }),
        }),
      ])
    );
  });

  it('EF08 → G6 Sozialamt contact profile action when node completed', () => {
    const { actionSet, execution } = buildPipeline('EF08');

    expect(actionSet.graphId).toBe('G6');
    expect(execution.nodes['g6-sozialamt-contact']?.status).toBe('completed');
    expect(actionsForNode(actionSet.actions, 'g6-sozialamt-contact')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'update_profile', payload: expect.objectContaining({ profileKey: 'benefits-support' }) }),
      ])
    );
    expect(actionsForNode(actionSet.actions, 'g6-sozialamt-contact').some((action) => action.type === 'external_resource')).toBe(false);
    expect(actionsForNode(actionSet.actions, 'g6-payment-setup')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'update_profile' }),
      ])
    );
  });

  it('EF13 → G3 completed nodes emit update_profile only', () => {
    const { actionSet, execution } = buildPipeline('EF13');

    expect(actionSet.graphId).toBe('G3');
    expect(execution.completedNodeIds).toContain('g3-reporting');
    expect(actionSet.actions.length).toBeGreaterThan(0);
    expect(actionSet.actions.every((action) => action.type === 'update_profile' || action.type === 'open_module')).toBe(true);
    expect(actionSet.actions.some((action) => action.type === 'external_resource')).toBe(false);
    expect(actionSet.actions.some((action) => action.type === 'system_intent')).toBe(false);
    expect(actionsForNode(actionSet.actions, 'g3-reporting')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'update_profile', payload: expect.objectContaining({ profileKey: 'benefits-support' }) }),
      ])
    );
    expect(actionsForNode(actionSet.actions, 'g3-income-changes')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'update_profile', payload: expect.objectContaining({ profileKey: 'work-income' }) }),
      ])
    );
  });

  it('locked nodes emit no actions', () => {
    const { execution, fixture } = buildPipeline('EF03');
    const lockedNodeId = execution.derivedState.blockedNodeIds[0];
    expect(lockedNodeId).toBeDefined();
    expect(execution.nodes[lockedNodeId!]?.status).toBe('locked');

    const actionSet = buildActionSet(execution, fixture.userContext);
    expect(actionSet.actions.some((action) => action.sourceNodeId === lockedNodeId)).toBe(false);
  });
});
