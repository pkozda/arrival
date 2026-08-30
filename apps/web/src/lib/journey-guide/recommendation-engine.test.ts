import { describe, expect, it } from 'vitest';
import {
  buildLockedGuideState,
  buildRoutePreviewChain,
  getRecommendedNextPlanet,
} from './recommendation-engine';
import type { SpatialGraphEdge, SpatialGraphNode } from '@/lib/presentation/spatial-core';

const nodes: SpatialGraphNode[] = [
  { id: '__journey__', status: 'core', x: 50, y: 50, payload: null },
  { id: 'anmeldung', status: 'recommended', x: 30, y: 40, payload: null },
  { id: 'tax-id', status: 'future', x: 60, y: 35, payload: null },
  { id: 'health', status: 'future', x: 70, y: 55, payload: null },
];

const edges: SpatialGraphEdge[] = [
  { id: 'e1', from: 'anmeldung', to: 'tax-id', type: 'dependency' },
  { id: 'e2', from: 'tax-id', to: 'health', type: 'dependency' },
];

const titles = {
  anmeldung: 'Anmeldung',
  'tax-id': 'Tax ID',
  health: 'Health Insurance',
};

describe('getRecommendedNextPlanet', () => {
  it('prefers recommended unlocked nodes', () => {
    const result = getRecommendedNextPlanet({
      graphNodes: nodes,
      graphEdges: [
        ...edges,
        { id: 'u1', from: 'anmeldung', to: 'tax-id', type: 'unlock' },
      ],
      lockedNodeIds: new Set(['tax-id', 'health']),
      nodeTitles: titles,
    });

    expect(result?.nodeId).toBe('anmeldung');
    expect(result?.unlockPreview.map((entry) => entry.nodeId)).toEqual(['tax-id']);
    expect(result?.reason).toBe('This is the most actionable step on your current route.');
  });

  it('skips completed nodes and advances to the next actionable step', () => {
    const completedNodes: SpatialGraphNode[] = [
      { id: '__journey__', status: 'core', x: 50, y: 50, payload: null },
      { id: 'anmeldung', status: 'completed', x: 30, y: 40, payload: null },
      { id: 'tax-id', status: 'recommended', x: 60, y: 35, payload: null },
      { id: 'health', status: 'future', x: 70, y: 55, payload: null },
    ];

    const result = getRecommendedNextPlanet({
      graphNodes: completedNodes,
      graphEdges: edges,
      lockedNodeIds: new Set(['health']),
      nodeTitles: titles,
      primaryNodeId: 'anmeldung',
      completedNodeIds: new Set(['anmeldung']),
    });

    expect(result?.nodeId).toBe('tax-id');
  });

  it('returns null when every candidate is already completed', () => {
    const completedNodes: SpatialGraphNode[] = [
      { id: '__journey__', status: 'core', x: 50, y: 50, payload: null },
      { id: 'anmeldung', status: 'completed', x: 30, y: 40, payload: null },
      { id: 'tax-id', status: 'completed', x: 60, y: 35, payload: null },
    ];

    const result = getRecommendedNextPlanet({
      graphNodes: completedNodes,
      graphEdges: edges,
      lockedNodeIds: new Set(),
      nodeTitles: titles,
      completedNodeIds: new Set(['anmeldung', 'tax-id']),
    });

    expect(result).toBeNull();
  });
});

describe('buildRoutePreviewChain', () => {
  it('walks dependency edges up to three hops', () => {
    const chain = buildRoutePreviewChain('anmeldung', nodes, edges, titles);
    expect(chain.nodeIds).toEqual(['anmeldung', 'tax-id', 'health']);
    expect(chain.edgeIds).toEqual(['e1', 'e2']);
  });

  it('follows unlock edges for consequence chains', () => {
    const unlockNodes: SpatialGraphNode[] = [
      { id: 'focus', status: 'recommended', x: 30, y: 40, payload: null },
      { id: 'next-a', status: 'future', x: 60, y: 35, payload: null },
      { id: 'next-b', status: 'future', x: 70, y: 55, payload: null },
    ];
    const unlockEdges: SpatialGraphEdge[] = [
      { id: 'u1', from: 'focus', to: 'next-a', type: 'unlock' },
      { id: 'u2', from: 'focus', to: 'next-b', type: 'unlock' },
    ];

    const chain = buildRoutePreviewChain('focus', unlockNodes, unlockEdges, {
      focus: 'Focus',
      'next-a': 'Next A',
      'next-b': 'Next B',
    });

    expect(chain.nodeIds).toEqual(['focus', 'next-a']);
    expect(chain.edgeIds).toEqual(['u1']);
  });
});

describe('buildLockedGuideState', () => {
  it('lists unsatisfied prerequisites for locked nodes', () => {
    const locked = buildLockedGuideState('health', nodes, edges, titles);
    expect(locked.prerequisiteIds).toEqual(['tax-id']);
  });
});
