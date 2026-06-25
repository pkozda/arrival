import { describe, expect, it } from 'vitest';
import {
  assignDependencyEdgeCurvatureOffsets,
  computeLockedNodeIds,
  getUnsatisfiedDependencySources,
  isDependencyEdgeSatisfied,
  isNodeLockedByDependencies,
  buildIncomingDependencyMap,
} from './galaxy-dependencies';
import type { SpatialGraphEdge, SpatialGraphNode } from './types';

function node(id: string, status: SpatialGraphNode['status']): SpatialGraphNode {
  return { id, x: 0, y: 0, status, payload: null };
}

describe('galaxy-dependencies', () => {
  const edges: SpatialGraphEdge[] = [
    { id: 'dep-a-b', from: 'a', to: 'b', type: 'dependency' },
    { id: 'dep-c-b', from: 'c', to: 'b', type: 'dependency' },
    { id: 'unlock-j-b', from: '__journey__', to: 'b', type: 'unlock' },
  ];

  it('locks target when any prerequisite is incomplete', () => {
    const nodes = [node('a', 'completed'), node('c', 'recommended'), node('b', 'recommended')];
    const incoming = buildIncomingDependencyMap(edges);

    expect(isNodeLockedByDependencies('b', incoming, new Map(nodes.map((entry) => [entry.id, entry])))).toBe(true);
    expect(getUnsatisfiedDependencySources('b', incoming, new Map(nodes.map((entry) => [entry.id, entry])))).toEqual([
      'c',
    ]);
  });

  it('unlocks target when all prerequisites are completed', () => {
    const nodes = [node('a', 'completed'), node('c', 'completed'), node('b', 'recommended')];
    const locked = computeLockedNodeIds(nodes, edges);

    expect(locked.has('b')).toBe(false);
  });

  it('marks dependency edge satisfied only when source is completed', () => {
    const nodeById = new Map([
      ['a', node('a', 'completed')],
      ['c', node('c', 'future')],
    ]);

    expect(isDependencyEdgeSatisfied(edges[0]!, nodeById)).toBe(true);
    expect(isDependencyEdgeSatisfied(edges[1]!, nodeById)).toBe(false);
  });

  it('spreads curvature offsets for multi-dependency targets', () => {
    const offsets = assignDependencyEdgeCurvatureOffsets(edges);

    expect(offsets.get('dep-a-b')).toBe(-1.1);
    expect(offsets.get('dep-c-b')).toBe(1.1);
  });
});
