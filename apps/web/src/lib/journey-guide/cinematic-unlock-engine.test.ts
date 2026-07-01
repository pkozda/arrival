import { describe, expect, it } from 'vitest';
import {
  buildOverlayTitle,
  buildUnlockGuideMessage,
  buildUnlockSequence,
  findNewlyCompletedNodeIds,
  findNewlyUnlockedNodeIds,
} from './cinematic-unlock-engine';
import type { SpatialGraphEdge, SpatialGraphNode } from '@/lib/presentation/spatial-core';

const nodes: SpatialGraphNode[] = [
  { id: '__journey__', status: 'core', x: 50, y: 50, payload: null },
  { id: 'anmeldung', status: 'completed', x: 30, y: 40, payload: null },
  { id: 'tax-id', status: 'recommended', x: 60, y: 35, payload: null },
  { id: 'health', status: 'future', x: 70, y: 55, payload: null },
];

const edges: SpatialGraphEdge[] = [
  { id: 'u1', from: 'anmeldung', to: 'tax-id', type: 'unlock' },
  { id: 'd1', from: 'tax-id', to: 'health', type: 'dependency' },
  { id: 'u2', from: 'tax-id', to: 'health', type: 'unlock' },
];

const titles = {
  anmeldung: 'Anmeldung',
  'tax-id': 'Tax ID',
  health: 'Health Insurance',
};

describe('findNewlyCompletedNodeIds', () => {
  it('detects nodes that just completed', () => {
    const previous = new Set<string>();
    expect(findNewlyCompletedNodeIds(previous, nodes)).toEqual(['anmeldung']);
  });
});

describe('findNewlyUnlockedNodeIds', () => {
  it('detects nodes that left the locked set', () => {
    const previousLocked = new Set(['tax-id', 'health']);
    const currentLocked = new Set(['health']);
    expect(findNewlyUnlockedNodeIds(previousLocked, currentLocked, nodes)).toEqual(['tax-id']);
  });
});

describe('buildUnlockSequence', () => {
  it('builds a causal chain from source to newly unlocked nodes', () => {
    const sequence = buildUnlockSequence('anmeldung', ['tax-id'], nodes, edges, titles);
    expect(sequence?.chainNodeIds).toEqual(['anmeldung', 'tax-id']);
    expect(sequence?.chainEdgeIds).toEqual(['u1']);
    expect(sequence?.newlyUnlockedNodeIds).toEqual(['tax-id']);
  });

  it('orders cascading unlocks along the dependency chain', () => {
    const cascadingNodes: SpatialGraphNode[] = [
      { id: 'a', status: 'completed', x: 20, y: 40, payload: null },
      { id: 'b', status: 'recommended', x: 40, y: 40, payload: null },
      { id: 'c', status: 'future', x: 60, y: 40, payload: null },
    ];
    const cascadingEdges: SpatialGraphEdge[] = [
      { id: 'ab', from: 'a', to: 'b', type: 'unlock' },
      { id: 'bc', from: 'b', to: 'c', type: 'dependency' },
    ];

    const sequence = buildUnlockSequence('a', ['b', 'c'], cascadingNodes, cascadingEdges, {
      a: 'A',
      b: 'B',
      c: 'C',
    });

    expect(sequence?.newlyUnlockedNodeIds).toEqual(['b', 'c']);
    expect(sequence?.routeSteps.map((step) => step.toNodeId)).toEqual(['b', 'c']);
  });

  it('returns null when nothing was unlocked', () => {
    expect(buildUnlockSequence('anmeldung', [], nodes, edges, titles)).toBeNull();
  });
});

describe('buildUnlockGuideMessage', () => {
  it('formats a single unlock message', () => {
    const message = buildUnlockGuideMessage('Anmeldung', ['Tax ID']);
    expect(message.title).toBe('A new route has become available');
    expect(message.body).toContain('Tax ID');
  });

  it('formats a multi-unlock overlay title', () => {
    expect(buildOverlayTitle(3)).toBe('3 new destinations available');
  });
});
