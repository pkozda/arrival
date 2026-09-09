import { describe, expect, it } from 'vitest';
import { buildLifeEventGalaxyGraph } from './build-galaxy-graph.js';
import type { LifeEventPlanNode } from '@/lib/product-contract';

function node(partial: Partial<LifeEventPlanNode> & Pick<LifeEventPlanNode, 'id' | 'title'>): LifeEventPlanNode {
  return {
    category: 'legal',
    description: '',
    priority: 'critical',
    phase: 1,
    actions: [],
    satisfied: false,
    blocked: false,
    ...partial,
  };
}

describe('buildLifeEventGalaxyGraph PD-001 dependency edges', () => {
  it('does not make downstream blocked nodes prerequisites of the focus', () => {
    const focus = node({ id: 'g1-complete-anmeldung', title: 'Complete Anmeldung' });
    const banking = node({
      id: 'g1-banking-tax',
      title: 'Set up banking',
      blocked: true,
      category: 'stabilization',
    });
    const address = node({
      id: 'g1-secure-address',
      title: 'Secure address',
      satisfied: true,
    });

    const { graphEdges } = buildLifeEventGalaxyGraph({
      primaryAction: focus,
      blockedActions: [banking],
      completedNodes: [address],
      secondaryActions: [],
      contextualActions: [],
    });

    const deps = graphEdges.filter((edge) => edge.type === 'dependency');
    expect(deps).toContainEqual({
      id: 'dep-g1-secure-address-g1-complete-anmeldung',
      from: 'g1-secure-address',
      to: 'g1-complete-anmeldung',
      type: 'dependency',
    });
    expect(deps).toContainEqual({
      id: 'dep-g1-complete-anmeldung-g1-banking-tax',
      from: 'g1-complete-anmeldung',
      to: 'g1-banking-tax',
      type: 'dependency',
    });
    expect(
      deps.some(
        (edge) => edge.from === 'g1-banking-tax' && edge.to === 'g1-complete-anmeldung'
      )
    ).toBe(false);
  });
});
