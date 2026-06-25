import type { SpatialGraphEdge, SpatialGraphNode } from './types';
import {
  getUnsatisfiedDependencySources,
  isDependencyEdgeSatisfied,
  JOURNEY_NODE_ID,
} from './galaxy-dependencies';

export const GRAVITY_MAX_OFFSET_PX = 3;

export type NodeGravityState = {
  offsetX: number;
  offsetY: number;
  pullIntensity: number;
  isTargetPulled: boolean;
  isSourceActive: boolean;
};

export type EdgeGravityState = {
  isActive: boolean;
  intensity: number;
  weight: number;
};

export function resolveDependencyWeight(edge: SpatialGraphEdge): number {
  const weight = edge.weight ?? 0.5;
  return Math.min(1, Math.max(0.1, weight));
}

function pullVector(
  target: { x: number; y: number },
  source: { x: number; y: number },
  magnitudePx: number
): { x: number; y: number } {
  const dx = source.x - target.x;
  const dy = source.y - target.y;
  const distance = Math.hypot(dx, dy) || 1;
  return {
    x: (dx / distance) * magnitudePx,
    y: (dy / distance) * magnitudePx,
  };
}

function clampVector(x: number, y: number, maxMagnitude: number): { x: number; y: number } {
  const magnitude = Math.hypot(x, y);
  if (magnitude <= maxMagnitude || magnitude === 0) {
    return { x, y };
  }
  const scale = maxMagnitude / magnitude;
  return { x: x * scale, y: y * scale };
}

function findDependencyEdge(
  edges: SpatialGraphEdge[],
  from: string,
  to: string
): SpatialGraphEdge | undefined {
  return edges.find((edge) => edge.type === 'dependency' && edge.from === from && edge.to === to);
}

function isHoverGravityEdge(
  edge: SpatialGraphEdge,
  hoveredNodeId: string | null,
  nodeById: Map<string, SpatialGraphNode>
): boolean {
  if (!hoveredNodeId || edge.type !== 'dependency' || isDependencyEdgeSatisfied(edge, nodeById)) {
    return false;
  }
  return edge.from === hoveredNodeId || edge.to === hoveredNodeId;
}

type GravityFieldInput = {
  graphNodes: SpatialGraphNode[];
  graphEdges: SpatialGraphEdge[];
  nodeById: Map<string, SpatialGraphNode>;
  incomingDependencyMap: Map<string, string[]>;
  hoveredNodeId: string | null;
};

export function computeGravityField({
  graphNodes,
  graphEdges,
  nodeById,
  incomingDependencyMap,
  hoveredNodeId,
}: GravityFieldInput): {
  nodeGravity: Map<string, NodeGravityState>;
  edgeGravity: Map<string, EdgeGravityState>;
} {
  const nodeGravity = new Map<string, NodeGravityState>();
  const edgeGravity = new Map<string, EdgeGravityState>();
  const sourceActiveIntensity = new Map<string, number>();

  if (!hoveredNodeId) {
    return { nodeGravity, edgeGravity };
  }

  for (const edge of graphEdges) {
    if (edge.type !== 'dependency') {
      continue;
    }

    const weight = resolveDependencyWeight(edge);
    const isActive = isHoverGravityEdge(edge, hoveredNodeId, nodeById);
    const intensity = isActive ? 0.45 + weight * 0.35 : 0;

    edgeGravity.set(edge.id, {
      isActive,
      intensity,
      weight,
    });

    if (isActive) {
      sourceActiveIntensity.set(
        edge.from,
        Math.max(sourceActiveIntensity.get(edge.from) ?? 0, intensity)
      );
    }
  }

  for (const node of graphNodes) {
    if (node.id === JOURNEY_NODE_ID || hoveredNodeId !== node.id) {
      const sourceActive = sourceActiveIntensity.get(node.id) ?? 0;
      if (sourceActive > 0) {
        nodeGravity.set(node.id, {
          offsetX: 0,
          offsetY: 0,
          pullIntensity: sourceActive,
          isTargetPulled: false,
          isSourceActive: true,
        });
      }
      continue;
    }

    const unsatisfiedSources = getUnsatisfiedDependencySources(
      node.id,
      incomingDependencyMap,
      nodeById
    );

    let sumX = 0;
    let sumY = 0;
    let pullIntensity = 0;

    for (const sourceId of unsatisfiedSources) {
      const source = nodeById.get(sourceId);
      const edge = findDependencyEdge(graphEdges, sourceId, node.id);
      if (!source || !edge) {
        continue;
      }

      const weight = resolveDependencyWeight(edge);
      const pull = pullVector(node, source, GRAVITY_MAX_OFFSET_PX * weight * 0.9);
      sumX += pull.x;
      sumY += pull.y;
      pullIntensity = Math.max(pullIntensity, weight);
    }

    const clamped = clampVector(sumX, sumY, GRAVITY_MAX_OFFSET_PX);

    nodeGravity.set(node.id, {
      offsetX: clamped.x,
      offsetY: clamped.y,
      pullIntensity,
      isTargetPulled: pullIntensity > 0.05,
      isSourceActive: false,
    });
  }

  return { nodeGravity, edgeGravity };
}
