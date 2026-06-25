import type { GalaxyNodeState, SpatialGraphNode } from './types';

export type NodeStarRating = 0 | 1 | 2 | 3;

export type ModuleProgressUIState = {
  /** Module-wide fill: stars / 3 */
  completion: number;
  stars: 0 | 1 | 2 | 3;
  completedNodes: number;
  totalNodes: number;
  nodeStarsById: Record<string, NodeStarRating>;
};

const JOURNEY_NODE_ID = '__journey__';

function isProgressNode(node: SpatialGraphNode): boolean {
  return node.id !== JOURNEY_NODE_ID;
}

export function computeNodeStarRating(
  node: SpatialGraphNode,
  visitedNodeIds: Set<string>,
  interactionStarted: boolean
): NodeStarRating {
  if (!isProgressNode(node)) {
    return 0;
  }

  if (node.status === 'completed') {
    return 3;
  }

  if (!interactionStarted || !visitedNodeIds.has(node.id)) {
    return 0;
  }

  if (node.status === 'recommended') {
    return 2;
  }

  if (node.status === 'future') {
    return 2;
  }

  return 1;
}

function computeModuleStars(
  graphNodes: SpatialGraphNode[],
  visitedNodeIds: Set<string>,
  interactionStarted: boolean
): 0 | 1 | 2 | 3 {
  if (!interactionStarted) {
    return 0;
  }

  const selectable = graphNodes.filter(isProgressNode);
  const visitedCount = selectable.filter((node) => visitedNodeIds.has(node.id)).length;
  const recommended = selectable.filter((node) => node.status === 'recommended');
  const allRecommendedVisited =
    recommended.length > 0 && recommended.every((node) => visitedNodeIds.has(node.id));
  const criticalPath = selectable.filter(
    (node) => node.status === 'recommended' || node.status === 'completed'
  );
  const criticalPathComplete =
    criticalPath.length > 0 &&
    criticalPath.every(
      (node) => node.status === 'completed' || visitedNodeIds.has(node.id)
    );

  if (allRecommendedVisited || criticalPathComplete) {
    return 3;
  }

  if (selectable.length > 0 && visitedCount / selectable.length >= 0.5) {
    return 2;
  }

  return 1;
}

export function computeModuleProgressUI(
  graphNodes: SpatialGraphNode[],
  visitedNodeIds: Set<string>,
  interactionStarted: boolean
): ModuleProgressUIState {
  const selectable = graphNodes.filter(isProgressNode);
  const totalNodes = selectable.length;
  const completedNodes = selectable.filter((node) => node.status === 'completed').length;

  const nodeStarsById: Record<string, NodeStarRating> = {};
  for (const node of graphNodes) {
    if (!isProgressNode(node)) {
      continue;
    }
    nodeStarsById[node.id] = computeNodeStarRating(node, visitedNodeIds, interactionStarted);
  }

  const stars = computeModuleStars(graphNodes, visitedNodeIds, interactionStarted);
  const completion = Math.round((stars / 3) * 100);

  return {
    completion,
    stars,
    completedNodes,
    totalNodes,
    nodeStarsById,
  };
}
