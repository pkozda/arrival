import { describe, expect, it } from 'vitest';
import { buildEconomicRealityPlan } from './pipeline.js';
import { EconomicRealityPlanError } from './guards.js';
import { ECONOMIC_FIXTURES } from '../../economic-reality/fixtures.js';

const FIXED_META = {
  requestId: 'req_test_pipeline',
  generatedAt: '2026-06-21T12:00:00.000Z',
};

describe('buildEconomicRealityPlan EP-7 pipeline', () => {
  for (const fixture of ECONOMIC_FIXTURES) {
    it(`${fixture.id} runs full EP-1 → EP-6 chain`, () => {
      const first = buildEconomicRealityPlan(fixture.userContext, FIXED_META);
      const second = buildEconomicRealityPlan(fixture.userContext, FIXED_META);

      expect(second).toEqual(first);
      expect(first.version).toBe('1.0');
      expect(first.evaluation.economicState).toBe(fixture.expected.economicState);
      expect(first.graph.graphId).toBeDefined();
      expect(first.execution.graphId).toBe(first.graph.graphId);
      expect(first.actionSet.graphId).toBe(first.graph.graphId);
      expect(first.plan.graphId).toBe(first.graph.graphId);
      expect(first.presentation.graphId).toBe(first.graph.graphId);
      expect(first.actionSet.actions.length).toBeGreaterThan(0);
      expect(first.meta.pipelineVersion).toBe('ep1-ep6-v1');
      expect(first.meta.deterministicHash).toMatch(/^[a-f0-9]{64}$/);
    });
  }

  it('keeps deterministicHash stable when only requestId changes', () => {
    const fixture = ECONOMIC_FIXTURES[0]!;
    const first = buildEconomicRealityPlan(fixture.userContext, FIXED_META);
    const second = buildEconomicRealityPlan(fixture.userContext, {
      ...FIXED_META,
      requestId: 'req_other',
      generatedAt: '2026-06-21T13:00:00.000Z',
    });

    expect(second.meta.deterministicHash).toBe(first.meta.deterministicHash);
    expect(second.evaluation).toEqual(first.evaluation);
    expect(second.presentation).toEqual(first.presentation);
  });

  it('rejects missing profile with ECONOMIC_CONTEXT_INVALID', () => {
    expect(() =>
      buildEconomicRealityPlan({ profile: undefined as never }, FIXED_META)
    ).toThrow(EconomicRealityPlanError);

    try {
      buildEconomicRealityPlan({ profile: undefined as never }, FIXED_META);
    } catch (error) {
      expect(error).toBeInstanceOf(EconomicRealityPlanError);
      expect((error as EconomicRealityPlanError).code).toBe('ECONOMIC_CONTEXT_INVALID');
    }
  });
});
