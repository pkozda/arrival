import { JOURNEY_NODE_ID } from '@/lib/presentation/spatial-core';
import { toMissionTitle } from './mission-labels';
import type { CinematicUnlockSequence, StoredUnlockEvent } from './types';
import type { SpatialGraphEdge, SpatialGraphNode } from '@/lib/presentation/spatial-core';

export const CINEMATIC_TIMING = {
  completion: 1000,
  routeHop: 450,
  emergence: 650,
  overlay: 2800,
  guide: 4000,
} as const;

export function findNewlyCompletedNodeIds(
  previous: Set<string>,
  graphNodes: SpatialGraphNode[]
): string[] {
  return graphNodes
    .filter((node) => node.status === 'completed' && node.id !== JOURNEY_NODE_ID && !previous.has(node.id))
    .map((node) => node.id);
}

export function findNewlyUnlockedNodeIds(
  previousLocked: Set<string>,
  currentLocked: Set<string>,
  graphNodes: SpatialGraphNode[]
): string[] {
  return graphNodes
    .filter(
      (node) =>
        node.id !== JOURNEY_NODE_ID && previousLocked.has(node.id) && !currentLocked.has(node.id)
    )
    .map((node) => node.id);
}

function findPathFromSource(
  sourceId: string,
  targetId: string,
  graphEdges: SpatialGraphEdge[],
  graphNodes: SpatialGraphNode[]
): { nodeIds: string[]; edgeIds: string[] } | null {
  const visited = new Set<string>([sourceId]);
  const queue: Array<{ nodeId: string; nodeIds: string[]; edgeIds: string[] }> = [
    { nodeId: sourceId, nodeIds: [sourceId], edgeIds: [] },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.nodeId === targetId) {
      return { nodeIds: current.nodeIds, edgeIds: current.edgeIds };
    }

    const outgoing = graphEdges
      .filter(
        (edge) =>
          edge.from === current.nodeId &&
          (edge.type === 'unlock' || edge.type === 'dependency') &&
          edge.to !== JOURNEY_NODE_ID &&
          graphNodes.some((node) => node.id === edge.to) &&
          !visited.has(edge.to)
      )
      .sort((left, right) => {
        if (left.type === right.type) {
          return 0;
        }
        return left.type === 'unlock' ? -1 : 1;
      });

    for (const edge of outgoing) {
      visited.add(edge.to);
      queue.push({
        nodeId: edge.to,
        nodeIds: [...current.nodeIds, edge.to],
        edgeIds: [...current.edgeIds, edge.id],
      });
    }
  }

  return null;
}

function dedupePaths(
  paths: Array<{ nodeIds: string[]; edgeIds: string[]; targetId: string }>
): Array<{ nodeIds: string[]; edgeIds: string[]; targetId: string }> {
  return paths.filter((path, index) => {
    const key = path.nodeIds.join('>');
    return !paths.some((other, otherIndex) => {
      if (otherIndex === index) {
        return false;
      }
      const otherKey = other.nodeIds.join('>');
      return otherKey.startsWith(key) && other.nodeIds.length > path.nodeIds.length;
    });
  });
}

export function buildUnlockSequence(
  sourceNodeId: string,
  newlyUnlockedIds: string[],
  graphNodes: SpatialGraphNode[],
  graphEdges: SpatialGraphEdge[],
  nodeTitles: Record<string, string>
): CinematicUnlockSequence | null {
  if (newlyUnlockedIds.length === 0) {
    return null;
  }

  const paths = dedupePaths(
    newlyUnlockedIds
      .map((targetId) => {
        const path = findPathFromSource(sourceNodeId, targetId, graphEdges, graphNodes);
        if (!path) {
          return null;
        }
        return { ...path, targetId };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry != null)
      .sort((left, right) => left.nodeIds.length - right.nodeIds.length)
  );

  if (paths.length === 0) {
    return null;
  }

  const routeSteps: CinematicUnlockSequence['routeSteps'] = [];
  const seenEdges = new Set<string>();

  paths.forEach((path) => {
    path.edgeIds.forEach((edgeId, index) => {
      if (seenEdges.has(edgeId)) {
        return;
      }
      seenEdges.add(edgeId);
      routeSteps.push({
        edgeId,
        toNodeId: path.nodeIds[index + 1]!,
      });
    });
  });

  const emergenceOrder: string[] = [];
  const seenEmergence = new Set<string>();
  paths.forEach((path) => {
    path.nodeIds.forEach((nodeId) => {
      if (nodeId === sourceNodeId || !newlyUnlockedIds.includes(nodeId) || seenEmergence.has(nodeId)) {
        return;
      }
      seenEmergence.add(nodeId);
      emergenceOrder.push(nodeId);
    });
  });

  const sourceTitle = nodeTitles[sourceNodeId] ?? sourceNodeId;
  const newlyUnlockedTitles = emergenceOrder.map((id) => nodeTitles[id] ?? id);

  return {
    sourceNodeId,
    sourceTitle,
    sourceMissionTitle: toMissionTitle(sourceNodeId, sourceTitle),
    newlyUnlockedNodeIds: emergenceOrder,
    newlyUnlockedTitles,
    routeSteps,
    chainNodeIds: [sourceNodeId, ...routeSteps.map((step) => step.toNodeId)],
    chainEdgeIds: routeSteps.map((step) => step.edgeId),
  };
}

export function buildUnlockGuideMessage(
  sourceTitle: string,
  unlockedTitles: string[]
): { title: string; body: string } {
  if (unlockedTitles.length === 0) {
    return {
      title: 'Progress recorded',
      body: 'Your route has been updated.',
    };
  }

  if (unlockedTitles.length === 1) {
    return {
      title: 'A new route has become available',
      body: `Completing ${sourceTitle} unlocked your access to ${unlockedTitles[0]}.`,
    };
  }

  if (unlockedTitles.length === 2) {
    return {
      title: 'New routes discovered',
      body: `Completing ${sourceTitle} unlocked ${unlockedTitles[0]} and ${unlockedTitles[1]}.`,
    };
  }

  const last = unlockedTitles[unlockedTitles.length - 1]!;
  const rest = unlockedTitles.slice(0, -1).join(', ');
  return {
    title: `${unlockedTitles.length} new destinations available`,
    body: `Completing ${sourceTitle} unlocked ${rest}, and ${last}.`,
  };
}

export function sequenceToStoredEvent(
  surfaceId: string,
  sequence: CinematicUnlockSequence
): StoredUnlockEvent {
  return {
    surfaceId,
    sourceNodeId: sequence.sourceNodeId,
    sourceTitle: sequence.sourceTitle,
    newlyUnlockedNodeIds: sequence.newlyUnlockedNodeIds,
    newlyUnlockedTitles: sequence.newlyUnlockedTitles,
    chainNodeIds: sequence.chainNodeIds,
    chainEdgeIds: sequence.chainEdgeIds,
    routeSteps: sequence.routeSteps,
    recordedAt: new Date().toISOString(),
  };
}

export function storedEventToSequence(event: StoredUnlockEvent): CinematicUnlockSequence {
  return {
    sourceNodeId: event.sourceNodeId,
    sourceTitle: event.sourceTitle,
    sourceMissionTitle: toMissionTitle(event.sourceNodeId, event.sourceTitle),
    newlyUnlockedNodeIds: event.newlyUnlockedNodeIds,
    newlyUnlockedTitles: event.newlyUnlockedTitles,
    routeSteps: event.routeSteps,
    chainNodeIds: event.chainNodeIds,
    chainEdgeIds: event.chainEdgeIds,
  };
}

export function buildOverlayTitle(unlockedCount: number): string {
  if (unlockedCount === 1) {
    return 'New route discovered';
  }
  return `${unlockedCount} new destinations available`;
}
