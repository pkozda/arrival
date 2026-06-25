import {
  buildIncomingDependencyMap,
  getUnsatisfiedDependencySources,
  JOURNEY_NODE_ID,
} from '@/lib/presentation/spatial-core';
import { toMissionTitle } from './mission-labels';
import type { PlanetRecommendation } from './types';
import type { SpatialGraphEdge, SpatialGraphNode } from '@/lib/presentation/spatial-core';

type Input = {
  graphNodes: SpatialGraphNode[];
  graphEdges: SpatialGraphEdge[];
  lockedNodeIds: Set<string>;
  nodeTitles: Record<string, string>;
  primaryNodeId?: string | null;
  completedNodeIds?: Set<string>;
};

function isCompletedNode(
  node: SpatialGraphNode,
  completedNodeIds: Set<string> | undefined
): boolean {
  return node.status === 'completed' || Boolean(completedNodeIds?.has(node.id));
}

function scoreCandidate(
  node: SpatialGraphNode,
  lockedNodeIds: Set<string>,
  primaryNodeId: string | null | undefined,
  completedNodeIds: Set<string> | undefined
): number {
  if (node.id === JOURNEY_NODE_ID || lockedNodeIds.has(node.id)) {
    return -1;
  }
  if (isCompletedNode(node, completedNodeIds)) {
    return -1;
  }
  if (node.id === primaryNodeId) {
    return 100;
  }
  if (node.status === 'recommended') {
    return 80;
  }
  if (node.status === 'blocked') {
    return 60;
  }
  if (node.status === 'future') {
    return 20;
  }
  return 10;
}

function nodeTitle(nodeTitles: Record<string, string>, nodeId: string): string {
  return nodeTitles[nodeId] ?? nodeId;
}

function collectUnlockPreview(
  sourceId: string,
  graphNodes: SpatialGraphNode[],
  graphEdges: SpatialGraphEdge[],
  nodeTitles: Record<string, string>
): PlanetRecommendation['unlockPreview'] {
  const preview: PlanetRecommendation['unlockPreview'] = [];
  const seen = new Set<string>();

  const outgoing = graphEdges.filter(
    (edge) =>
      (edge.type === 'unlock' || edge.type === 'dependency') &&
      edge.from === sourceId &&
      !seen.has(edge.to)
  );

  outgoing
    .sort((left, right) => {
      if (left.type === right.type) {
        return 0;
      }
      return left.type === 'unlock' ? -1 : 1;
    })
    .forEach((edge) => {
      if (seen.has(edge.to)) {
        return;
      }
      seen.add(edge.to);
      const target = graphNodes.find((node) => node.id === edge.to);
      if (!target || target.id === JOURNEY_NODE_ID) {
        return;
      }
      const title = nodeTitle(nodeTitles, target.id);
      preview.push({
        nodeId: target.id,
        title,
        missionTitle: toMissionTitle(target.id, title),
      });
    });

  return preview.slice(0, 4);
}

export function getRecommendedNextPlanet({
  graphNodes,
  graphEdges,
  lockedNodeIds,
  nodeTitles,
  primaryNodeId = null,
  completedNodeIds,
}: Input): PlanetRecommendation | null {
  const candidates = graphNodes
    .map((node) => ({
      node,
      score: scoreCandidate(node, lockedNodeIds, primaryNodeId, completedNodeIds),
    }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => right.score - left.score);

  const next = candidates[0]?.node;
  if (!next) {
    return null;
  }

  const title = nodeTitle(nodeTitles, next.id);
  const unlockPreview = collectUnlockPreview(next.id, graphNodes, graphEdges, nodeTitles);

  const reason =
    next.status === 'recommended'
      ? 'This is the most actionable step on your current route.'
      : next.status === 'blocked'
        ? 'Resolving this blocker clears the path ahead.'
        : 'This node opens nearby progression.';

  return {
    nodeId: next.id,
    title,
    missionTitle: toMissionTitle(next.id, title),
    reason,
    unlockPreview,
  };
}

export function buildRoutePreviewChain(
  startNodeId: string,
  graphNodes: SpatialGraphNode[],
  graphEdges: SpatialGraphEdge[],
  nodeTitles: Record<string, string>
): { nodeIds: string[]; edgeIds: string[]; labels: string[] } {
  const nodeIds = [startNodeId];
  const edgeIds: string[] = [];
  const labels = [toMissionTitle(startNodeId, nodeTitle(nodeTitles, startNodeId))];
  const visited = new Set<string>([startNodeId]);

  let currentId = startNodeId;
  for (let depth = 0; depth < 3; depth += 1) {
    const candidates = graphEdges.filter(
      (edge) =>
        (edge.type === 'unlock' || edge.type === 'dependency') &&
        edge.from === currentId &&
        !visited.has(edge.to) &&
        edge.to !== JOURNEY_NODE_ID &&
        graphNodes.some((node) => node.id === edge.to)
    );

    const nextEdge =
      candidates.find((edge) => edge.type === 'unlock') ??
      candidates.find((edge) => edge.type === 'dependency');

    if (!nextEdge) {
      break;
    }
    edgeIds.push(nextEdge.id);
    currentId = nextEdge.to;
    visited.add(currentId);
    nodeIds.push(currentId);
    labels.push(toMissionTitle(currentId, nodeTitle(nodeTitles, currentId)));
  }

  return { nodeIds, edgeIds, labels };
}

export function buildLockedGuideState(
  nodeId: string,
  graphNodes: SpatialGraphNode[],
  graphEdges: SpatialGraphEdge[],
  nodeTitles: Record<string, string>
) {
  const nodeById = new Map(graphNodes.map((node) => [node.id, node]));
  const incoming = buildIncomingDependencyMap(graphEdges);
  const prerequisites = getUnsatisfiedDependencySources(nodeId, incoming, nodeById);

  return {
    nodeId,
    title: nodeTitle(nodeTitles, nodeId),
    prerequisiteIds: prerequisites,
    prerequisiteTitles: prerequisites.map((id) => nodeTitle(nodeTitles, id)),
  };
}
