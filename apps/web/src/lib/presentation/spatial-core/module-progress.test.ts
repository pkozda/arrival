import { describe, expect, it } from 'vitest';
import { computeModuleProgressUI, computeNodeStarRating } from './module-progress';
import type { SpatialGraphNode } from './types';

const journey: SpatialGraphNode = {
  id: '__journey__',
  x: 42,
  y: 40,
  status: 'core',
  payload: null,
};

describe('computeNodeStarRating', () => {
  it('returns 3 for completed nodes', () => {
    const node: SpatialGraphNode = {
      id: 'a',
      x: 1,
      y: 2,
      status: 'completed',
      payload: null,
    };
    expect(computeNodeStarRating(node, new Set(), true)).toBe(3);
  });

  it('returns 2 for visited recommended nodes', () => {
    const node: SpatialGraphNode = {
      id: 'b',
      x: 1,
      y: 2,
      status: 'recommended',
      payload: null,
    };
    expect(computeNodeStarRating(node, new Set(['b']), true)).toBe(2);
  });
});

describe('computeModuleProgressUI', () => {
  it('returns zero progress before interaction', () => {
    const nodes: SpatialGraphNode[] = [
      journey,
      { id: 'a', x: 10, y: 20, status: 'completed', payload: null },
      { id: 'b', x: 20, y: 30, status: 'recommended', payload: null },
    ];

    const result = computeModuleProgressUI(nodes, new Set(), false);
    expect(result.completion).toBe(0);
    expect(result.stars).toBe(0);
    expect(result.nodeStarsById.a).toBe(3);
    expect(result.nodeStarsById.b).toBe(0);
  });

  it('ties completion to module stars (stars / 3)', () => {
    const nodes: SpatialGraphNode[] = [
      journey,
      { id: 'a', x: 10, y: 20, status: 'future', payload: null },
      { id: 'b', x: 20, y: 30, status: 'future', payload: null },
      { id: 'c', x: 30, y: 40, status: 'future', payload: null },
      { id: 'd', x: 40, y: 50, status: 'future', payload: null },
    ];

    const visited = new Set(['a', 'b', 'c']);
    const result = computeModuleProgressUI(nodes, visited, true);
    expect(result.stars).toBe(2);
    expect(result.completion).toBe(67);
  });

  it('reaches three module stars when all recommended nodes are visited', () => {
    const nodes: SpatialGraphNode[] = [
      journey,
      { id: 'a', x: 10, y: 20, status: 'completed', payload: null },
      { id: 'b', x: 20, y: 30, status: 'recommended', payload: null },
      { id: 'c', x: 30, y: 40, status: 'future', payload: null },
    ];

    const visited = new Set(['b']);
    const result = computeModuleProgressUI(nodes, visited, true);
    expect(result.stars).toBe(3);
    expect(result.completion).toBe(100);
    expect(result.nodeStarsById.b).toBe(2);
  });
});
