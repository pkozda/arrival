import { describe, expect, it } from 'vitest';
import { ECONOMIC_FIXTURES } from '@arrival-atlas/modules/economic-reality';
import { buildEconomicRealityPlanFromState } from './state/economic-reality-plan-projection.js';

describe('buildEconomicRealityPlanFromState smoke', () => {
  it('builds EF01 plan from fixture user context shape', () => {
    const response = buildEconomicRealityPlanFromState(
      {
        generatedAt: '2026-06-21T12:00:00.000Z',
        userContext: ECONOMIC_FIXTURES[0]!.userContext,
      } as never,
      'req-smoke'
    );

    expect(response.version).toBe('1.0');
    expect(response.evaluation.economicState).toBe('self_sustained');
    expect(response.graph.schemaVersion).toBe('1.0.0');
    expect(response.execution.schemaVersion).toBe('1.0.0');
    expect(response.actionSet.schemaVersion).toBe('1.0.0');
  });
});
