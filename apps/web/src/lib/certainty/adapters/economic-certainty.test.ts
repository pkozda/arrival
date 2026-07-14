import { describe, expect, it } from 'vitest';
import {
  buildEconomicCertaintyBundle,
  buildEconomicCertaintyState,
} from '@/lib/certainty/adapters/economic-certainty';
import { validateCertaintyState } from '@/lib/certainty/validate-certainty-state';
import type { EconomicEvaluationV1, GraphExecutionStateV1 } from '@/lib/product-contract';

const titleForCard = (cardId: string) => `Card:${cardId}`;

function baseEvaluation(overrides: Partial<EconomicEvaluationV1> = {}): EconomicEvaluationV1 {
  return {
    schemaVersion: '1.0.0',
    economicState: 'employment_active',
    supportSystem: 'none',
    axes: {
      incomeAxis: 'stable',
      employmentAxis: 'employed',
      institutionAxis: 'none',
    },
    planConfidence: 'high',
    blockers: [],
    confidenceScore: 0.9,
    ...overrides,
  } as EconomicEvaluationV1;
}

function executionWith(statuses: Record<string, 'completed' | 'active' | 'locked'>): GraphExecutionStateV1 {
  const nodes = Object.fromEntries(
    Object.entries(statuses).map(([nodeId, status]) => [
      nodeId,
      {
        nodeId,
        status,
        progress: status === 'completed' ? 1 : 0,
        satisfaction: { met: status === 'completed', keys: [] },
        blockedBy: [],
      },
    ])
  );

  const completed = Object.values(nodes).filter((node) => node.status === 'completed').length;
  const total = Object.keys(nodes).length;

  return {
    schemaVersion: '1.0.0',
    graphId: 'test-graph',
    graphVariant: 'default',
    nodes,
    derivedState: {
      progressRatio: total > 0 ? completed / total : 0,
      blockedNodeIds: Object.values(nodes)
        .filter((node) => node.status === 'locked')
        .map((node) => node.nodeId),
      readyNodeIds: Object.values(nodes)
        .filter((node) => node.status === 'active')
        .map((node) => node.nodeId),
    },
    reasoning: {
      initializedFrom: 'test',
      appliedRules: ['test'],
    },
  } as GraphExecutionStateV1;
}

describe('economic certainty adapter', () => {
  it('maps completed assessment to clear certainty', () => {
    const state = buildEconomicCertaintyState({
      evaluation: baseEvaluation(),
      execution: executionWith({ income: 'completed', housing: 'completed' }),
      primaryFocusCardId: 'income',
      titleForCard,
      primaryHighlightLabel: 'Your economic plan',
    });

    expect(state.location).toBe('Economic Reality');
    expect(state.confidence).toBe('clear');
    expect(state.nextAction).toBeUndefined();
    expect(validateCertaintyState(state)).toBe(true);
  });

  it('maps missing income data to progress reason and needs_attention', () => {
    const bundle = buildEconomicCertaintyBundle({
      evaluation: baseEvaluation({
        planConfidence: 'medium',
        axes: {
          incomeAxis: 'none',
          employmentAxis: 'employed',
          institutionAxis: 'none',
        },
      }),
      primaryFocusCardId: 'income-entry',
      titleForCard,
      primaryHighlightLabel: 'Your economic plan',
    });

    expect(bundle.recommendedFocusId).toBe('income-entry');
    expect(bundle.state.confidence).toBe('needs_attention');
    expect(bundle.state.nextAction?.reason).toEqual({ type: 'progress', target: 'Income' });
    expect(validateCertaintyState(bundle.state)).toBe(true);
  });

  it('maps housing prerequisite to dependency reason and blocked confidence', () => {
    const state = buildEconomicCertaintyState({
      evaluation: baseEvaluation({
        planConfidence: 'low',
        blockers: ['SC-ADDR'],
      }),
      primaryFocusCardId: 'income-entry',
      dependencySourceCardIds: ['housing-entry'],
      titleForCard,
      primaryHighlightLabel: 'Your economic plan',
    });

    expect(state.confidence).toBe('blocked');
    expect(state.nextAction?.reason).toEqual({
      type: 'dependency',
      prerequisite: 'Card:housing-entry',
      target: 'Card:income-entry',
    });
    expect(state.nextAction?.expectedOutcome).toEqual({
      type: 'unlock',
      target: 'Card:income-entry',
    });
    expect(validateCertaintyState(state)).toBe(true);
  });

  it('maps loading state to unknown confidence', () => {
    const state = buildEconomicCertaintyState({
      loading: true,
      primaryFocusCardId: null,
      titleForCard,
      primaryHighlightLabel: 'Your economic plan',
    });

    expect(state.confidence).toBe('unknown');
    expect(validateCertaintyState(state)).toBe(true);
  });
});
