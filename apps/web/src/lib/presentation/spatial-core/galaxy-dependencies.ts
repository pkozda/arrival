import type { GalaxyNodeState, SpatialGraphEdge, SpatialGraphNode } from './types';

export const JOURNEY_NODE_ID = '__journey__';

export function isPrerequisiteSatisfied(node: SpatialGraphNode): boolean {
  if (node.id === JOURNEY_NODE_ID) {
    return true;
  }
  return node.status === 'completed';
}

export function buildIncomingDependencyMap(edges: SpatialGraphEdge[]): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const edge of edges) {
    if (edge.type !== 'dependency') {
      continue;
    }
    const existing = map.get(edge.to) ?? [];
    existing.push(edge.from);
    map.set(edge.to, existing);
  }

  return map;
}

export function getUnsatisfiedDependencySources(
  nodeId: string,
  incomingDeps: Map<string, string[]>,
  nodeById: Map<string, SpatialGraphNode>
): string[] {
  const sources = incomingDeps.get(nodeId) ?? [];
  return sources.filter((sourceId) => {
    const source = nodeById.get(sourceId);
    return !source || !isPrerequisiteSatisfied(source);
  });
}

export function isNodeLockedByDependencies(
  nodeId: string,
  incomingDeps: Map<string, string[]>,
  nodeById: Map<string, SpatialGraphNode>
): boolean {
  if (nodeId === JOURNEY_NODE_ID) {
    return false;
  }
  return getUnsatisfiedDependencySources(nodeId, incomingDeps, nodeById).length > 0;
}

export function computeLockedNodeIds(
  nodes: SpatialGraphNode[],
  edges: SpatialGraphEdge[]
): Set<string> {
  const incomingDeps = buildIncomingDependencyMap(edges);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const locked = new Set<string>();

  for (const node of nodes) {
    if (isNodeLockedByDependencies(node.id, incomingDeps, nodeById)) {
      locked.add(node.id);
    }
  }

  return locked;
}

export function isDependencyEdgeSatisfied(
  edge: SpatialGraphEdge,
  nodeById: Map<string, SpatialGraphNode>
): boolean {
  if (edge.type !== 'dependency') {
    return true;
  }
  const source = nodeById.get(edge.from);
  return source ? isPrerequisiteSatisfied(source) : false;
}

export function assignDependencyEdgeCurvatureOffsets(edges: SpatialGraphEdge[]): Map<string, number> {
  const byTarget = new Map<string, SpatialGraphEdge[]>();

  for (const edge of edges) {
    if (edge.type !== 'dependency') {
      continue;
    }
    const group = byTarget.get(edge.to) ?? [];
    group.push(edge);
    byTarget.set(edge.to, group);
  }

  const offsets = new Map<string, number>();
  byTarget.forEach((group) => {
    const sorted = [...group].sort((left, right) => left.from.localeCompare(right.from));
    const spread = sorted.length;
    sorted.forEach((edge, index) => {
      const offset = spread === 1 ? 0 : (index - (spread - 1) / 2) * 2.2;
      offsets.set(edge.id, offset);
    });
  });

  return offsets;
}

export type PlanetScaleTier = 'primary' | 'secondary' | 'locked';

export function resolvePlanetScaleTier(input: {
  nodeId: string;
  status: GalaxyNodeState;
  isJourneyNode: boolean;
  isLocked: boolean;
  primaryNodeId: string | null;
  isSelected: boolean;
  isHovered: boolean;
  isNeighbor: boolean;
}): PlanetScaleTier {
  if (input.isLocked) {
    return 'locked';
  }
  if (
    input.isJourneyNode ||
    input.nodeId === input.primaryNodeId ||
    input.isSelected ||
    input.isHovered
  ) {
    return 'primary';
  }
  if (input.isNeighbor || input.status === 'recommended' || input.status === 'completed') {
    return 'primary';
  }
  return 'secondary';
}

export function computeVisibleDependencyEdgeIds(graphEdges: SpatialGraphEdge[]): Set<string> {
  const visible = new Set<string>();

  for (const edge of graphEdges) {
    if (edge.type === 'dependency') {
      visible.add(edge.id);
    }
  }

  return visible;
}
