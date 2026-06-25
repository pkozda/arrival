import { describe, expect, it } from 'vitest';
import {
  computeVisibleDependencyEdgeIds,
  getUnsatisfiedDependencySources,
  buildIncomingDependencyMap,
} from './galaxy-dependencies';
import { computeGravityField, resolveDependencyWeight } from './galaxy-gravity';
import type { SpatialGraphEdge, SpatialGraphNode } from './types';

function node(id: string, x: number, y: number, status: SpatialGraphNode['status']): SpatialGraphNode {
  return { id, x, y, status, payload: null };
}

describe('galaxy-gravity', () => {
  const edges: SpatialGraphEdge[] = [
    { id: 'dep-a-c', from: 'a', to: 'c', type: 'dependency', weight: 1 },
    { id: 'dep-b-c', from: 'b', to: 'c', type: 'dependency', weight: 0.3 },
  ];

  const nodes = [
    node('a', 20, 50, 'recommended'),
    node('b', 30, 70, 'recommended'),
    node('c', 60, 60, 'recommended'),
  ];

  const incoming = new Map([['c', ['a', 'b']]]);
  const nodeById = new Map(nodes.map((entry) => [entry.id, entry]));
  const locked = new Set(['c']);

  it('clamps dependency weight into 0.1–1.0', () => {
    expect(resolveDependencyWeight({ id: 'e', from: 'a', to: 'b', type: 'dependency' })).toBe(0.5);
    expect(resolveDependencyWeight({ id: 'e', from: 'a', to: 'b', type: 'dependency', weight: 2 })).toBe(1);
    expect(resolveDependencyWeight({ id: 'e', from: 'a', to: 'b', type: 'dependency', weight: 0.01 })).toBe(0.1);
  });

  it('does not apply gravity when nothing is hovered', () => {
    const { nodeGravity, edgeGravity } = computeGravityField({
      graphNodes: nodes,
      graphEdges: edges,
      nodeById,
      incomingDependencyMap: incoming,
      hoveredNodeId: null,
    });

    expect(nodeGravity.size).toBe(0);
    expect(edgeGravity.size).toBe(0);
  });

  it('applies small displacement and source activation on locked hover', () => {
    const { nodeGravity, edgeGravity } = computeGravityField({
      graphNodes: nodes,
      graphEdges: edges,
      nodeById,
      incomingDependencyMap: incoming,
      hoveredNodeId: 'c',
    });

    const pull = Math.hypot(nodeGravity.get('c')?.offsetX ?? 0, nodeGravity.get('c')?.offsetY ?? 0);
    expect(pull).toBeGreaterThan(0);
    expect(pull).toBeLessThanOrEqual(3.01);
    expect(nodeGravity.get('a')?.isSourceActive).toBe(true);
    expect(edgeGravity.get('dep-a-c')?.isActive).toBe(true);
  });
});

describe('computeVisibleDependencyEdgeIds', () => {
  const edges: SpatialGraphEdge[] = [
    { id: 'dep-a-b', from: 'a', to: 'b', type: 'dependency' },
    { id: 'dep-x-a', from: 'x', to: 'a', type: 'dependency' },
    { id: 'dep-a-c', from: 'a', to: 'c', type: 'dependency' },
  ];

  const nodes = [
    node('x', 10, 50, 'recommended'),
    node('a', 30, 50, 'recommended'),
    node('b', 50, 50, 'recommended'),
    node('c', 70, 50, 'recommended'),
  ];

  const nodeById = new Map(nodes.map((entry) => [entry.id, entry]));
  const incoming = buildIncomingDependencyMap(edges);
  const locked = new Set(['b', 'c']);

  it('shows all dependency edges by default', () => {
    const visible = computeVisibleDependencyEdgeIds(edges);
    expect(visible.has('dep-a-b')).toBe(true);
    expect(visible.has('dep-a-c')).toBe(true);
    expect(visible.has('dep-x-a')).toBe(true);
  });
});
