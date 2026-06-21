import { describe, expect, it } from 'vitest';
import { evaluate } from './rule-engine/evaluate.js';
import { resolveGraphContext } from './graph/resolve-graph.js';
import { buildExecutionState } from './execution/build-execution-state.js';
import { ECONOMIC_FIXTURES } from './fixtures.js';

function buildForFixture(fixtureId: string) {
  const fixture = ECONOMIC_FIXTURES.find((entry) => entry.id === fixtureId);
  if (!fixture) {
    throw new Error(`Missing fixture ${fixtureId}`);
  }
  const evaluation = evaluate(fixture.userContext);
  const graphContext = resolveGraphContext(evaluation);
  const execution = buildExecutionState(graphContext, fixture.userContext);
  return { fixture, evaluation, graphContext, execution };
}

function assertExecutionInvariants(execution: ReturnType<typeof buildExecutionState>) {
  const nodeIds = Object.keys(execution.nodes);

  expect(execution.completedNodeIds.every((id) => nodeIds.includes(id))).toBe(true);
  expect(execution.activeNodeIds.every((id) => nodeIds.includes(id))).toBe(true);
  expect(execution.derivedState.blockedNodeIds.every((id) => nodeIds.includes(id))).toBe(true);
  expect(execution.derivedState.readyNodeIds.every((id) => nodeIds.includes(id))).toBe(true);

  const overlap = execution.activeNodeIds.filter((id) =>
    execution.completedNodeIds.includes(id)
  );
  expect(overlap).toHaveLength(0);

  const readyBlockedOverlap = execution.derivedState.readyNodeIds.filter((id) =>
    execution.derivedState.blockedNodeIds.includes(id)
  );
  expect(readyBlockedOverlap).toHaveLength(0);

  expect(execution.derivedState.progressRatio).toBeGreaterThanOrEqual(0);
  expect(execution.derivedState.progressRatio).toBeLessThanOrEqual(1);

  expect(execution.reasoning.appliedRules).toEqual(
    expect.arrayContaining([
      `NODE_INIT:${execution.graphId}`,
      expect.stringMatching(/^SAT_KEYS_APPLIED:\d+$/),
      'NODE_STATE_DERIVED:deterministic',
    ])
  );
  expect(execution.reasoning.initializedFrom.length).toBeGreaterThan(0);
}

describe('buildExecutionState EP-3 graph execution', () => {
  for (const fixture of ECONOMIC_FIXTURES) {
    it(`${fixture.id} produces deterministic execution invariants`, () => {
      const evaluation = evaluate(fixture.userContext);
      const graphContext = resolveGraphContext(evaluation);
      const first = buildExecutionState(graphContext, fixture.userContext);
      const second = buildExecutionState(graphContext, fixture.userContext);
      expect(second).toEqual(first);
      assertExecutionInvariants(first);
    });
  }

  it('EF03 → G2 registration path with active onboarding nodes', () => {
    const { execution } = buildForFixture('EF03');

    expect(execution.graphId).toBe('G2');
    expect(execution.nodes['g2-registration']?.status).toBe('completed');
    expect(execution.completedNodeIds).toContain('g2-registration');
    expect(execution.completedNodeIds).toContain('g2-termination-docs');
    expect(execution.activeNodeIds).toContain('g2-bank-account');
    expect(execution.activeNodeIds).toContain('g2-jobcenter-appointment');
    expect(execution.derivedState.blockedNodeIds).toContain('g2-first-payment');
    expect(execution.derivedState.progressRatio).toBeGreaterThan(0);
  });

  it('EF05 → G3 with active support-loop nodes', () => {
    const { execution } = buildForFixture('EF05');

    expect(execution.graphId).toBe('G3');
    expect(execution.completedNodeIds).toEqual(
      expect.arrayContaining(['g3-reporting', 'g3-job-search', 'g3-insurance', 'g3-transition-plan'])
    );
    expect(execution.activeNodeIds).toContain('g3-income-changes');
    expect(execution.derivedState.readyNodeIds).toContain('g3-income-changes');
    expect(execution.derivedState.progressRatio).toBeGreaterThan(0);
    expect(execution.derivedState.progressRatio).toBeLessThan(1);
  });

  it('EF07 → G5 crisis graph with blocked-heavy derived state', () => {
    const { execution } = buildForFixture('EF07');

    expect(execution.graphId).toBe('G5');
    expect(execution.activeNodeIds).toEqual(
      expect.arrayContaining(['g5-immediate-needs', 'g5-system-entry', 'g5-registration'])
    );
    expect(execution.derivedState.blockedNodeIds).toEqual(
      expect.arrayContaining(['g5-appointment', 'g5-bridge-income'])
    );
    expect(execution.derivedState.progressRatio).toBe(0);
  });

  it('EF08 → G6 Sozialamt progression model', () => {
    const { execution } = buildForFixture('EF08');

    expect(execution.graphId).toBe('G6');
    expect(execution.completedNodeIds).toEqual(
      expect.arrayContaining([
        'g6-status-confirm',
        'g6-sozialamt-contact',
        'g6-arrival-proof',
        'g6-transition-awareness',
      ])
    );
    expect(execution.activeNodeIds).toContain('g6-payment-setup');
    expect(execution.nodes['g6-payment-setup']?.satisfaction.keys).toContain('income_declared');
    expect(execution.derivedState.progressRatio).toBeGreaterThan(0.5);
  });

  it('EF13 → G3 with reporting completed while employed on Bürgergeld', () => {
    const { execution } = buildForFixture('EF13');

    expect(execution.graphId).toBe('G3');
    expect(execution.nodes['g3-reporting']?.satisfaction.met).toBe(true);
    expect(execution.completedNodeIds).toContain('g3-reporting');
    expect(execution.completedNodeIds).toContain('g3-income-changes');
    expect(execution.derivedState.progressRatio).toBe(1);
  });

  it('same GraphContextV1 + UserContextV1 always yields identical state', () => {
    const { graphContext, fixture } = buildForFixture('EF12');
    const a = buildExecutionState(graphContext, fixture.userContext);
    const b = buildExecutionState(graphContext, fixture.userContext);
    expect(b).toEqual(a);
  });
});
