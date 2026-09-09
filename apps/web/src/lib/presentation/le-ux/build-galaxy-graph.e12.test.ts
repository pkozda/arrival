import { describe, expect, it } from 'vitest';
import { buildLifeEventGalaxyGraph } from './build-galaxy-graph';
import type { LifeEventPlanNode } from '@/lib/product-contract';

function node(partial: Partial<LifeEventPlanNode> & { id: string }): LifeEventPlanNode {
  return {
    title: partial.id,
    category: 'admin',
    description: partial.id,
    priority: 'high',
    phase: 1,
    actions: [],
    satisfied: false,
    blocked: false,
    ...partial,
  };
}

describe('E12 galaxy presentation edges', () => {
  it('Registration is never a dependency of Banking (banking must not block Anmeldung)', () => {
    const { graphEdges } = buildLifeEventGalaxyGraph({
      primaryAction: node({ id: 'g1-complete-anmeldung' }),
      blockedActions: [node({ id: 'g1-banking-tax', blocked: true })],
      completedNodes: [node({ id: 'g1-secure-address', satisfied: true })],
      secondaryActions: [],
      contextualActions: [],
    });

    expect(
      graphEdges.some((edge) => edge.from === 'g1-banking-tax' && edge.to === 'g1-complete-anmeldung')
    ).toBe(false);
    expect(
      graphEdges.some(
        (edge) =>
          edge.type === 'dependency' &&
          edge.from === 'g1-complete-anmeldung' &&
          edge.to === 'g1-banking-tax'
      )
    ).toBe(true);
    expect(
      graphEdges.some(
        (edge) =>
          edge.type === 'dependency' &&
          edge.from === 'g1-secure-address' &&
          edge.to === 'g1-complete-anmeldung'
      )
    ).toBe(true);
  });
});
