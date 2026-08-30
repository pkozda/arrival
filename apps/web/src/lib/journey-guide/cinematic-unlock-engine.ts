import { getTranslations } from '@arrival-atlas/core';
import { JOURNEY_NODE_ID } from '@/lib/presentation/spatial-core';
import { toMissionTitle, type GuideTranslate } from './mission-labels';
import type { CinematicUnlockSequence, StoredUnlockEvent } from './types';
import type { SpatialGraphEdge, SpatialGraphNode } from '@/lib/presentation/spatial-core';

export type { GuideTranslate } from './mission-labels';

export const CINEMATIC_TIMING = {
  completion: 1000,
  routeHop: 450,
  emergence: 650,
  overlay: 2800,
  guide: 4000,
} as const;

export function fillGuideTemplate(
  template: string,
  vars: Record<string, string | number>
): string {
  return Object.entries(vars).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template
  );
}

function defaultTranslate(key: string): string {
  return getTranslations('en')[key] ?? key;
}

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
  nodeTitles: Record<string, string>,
  translate?: GuideTranslate
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
    sourceMissionTitle: toMissionTitle(sourceNodeId, sourceTitle, translate),
    newlyUnlockedNodeIds: emergenceOrder,
    newlyUnlockedTitles,
    routeSteps,
    chainNodeIds: [sourceNodeId, ...routeSteps.map((step) => step.toNodeId)],
    chainEdgeIds: routeSteps.map((step) => step.edgeId),
  };
}

export function buildUnlockGuideMessage(
  sourceTitle: string,
  unlockedTitles: string[],
  translate: GuideTranslate = defaultTranslate
): { title: string; body: string } {
  if (unlockedTitles.length === 0) {
    return {
      title: translate('guide.unlock.progressTitle'),
      body: translate('guide.unlock.progressBody'),
    };
  }

  if (unlockedTitles.length === 1) {
    return {
      title: translate('guide.unlock.newRouteTitle'),
      body: fillGuideTemplate(translate('guide.unlock.newRouteBody'), {
        source: sourceTitle,
        target: unlockedTitles[0]!,
      }),
    };
  }

  if (unlockedTitles.length === 2) {
    return {
      title: translate('guide.unlock.newRoutesTitle'),
      body: fillGuideTemplate(translate('guide.unlock.newRoutesBodyTwo'), {
        source: sourceTitle,
        a: unlockedTitles[0]!,
        b: unlockedTitles[1]!,
      }),
    };
  }

  const last = unlockedTitles[unlockedTitles.length - 1]!;
  const list = unlockedTitles.slice(0, -1).join(', ');
  return {
    title: fillGuideTemplate(translate('guide.unlock.destinationsAvailable'), {
      count: unlockedTitles.length,
    }),
    body: fillGuideTemplate(translate('guide.unlock.newRoutesBodyMany'), {
      source: sourceTitle,
      list,
      last,
    }),
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

export function storedEventToSequence(
  event: StoredUnlockEvent,
  translate?: GuideTranslate
): CinematicUnlockSequence {
  return {
    sourceNodeId: event.sourceNodeId,
    sourceTitle: event.sourceTitle,
    sourceMissionTitle: toMissionTitle(event.sourceNodeId, event.sourceTitle, translate),
    newlyUnlockedNodeIds: event.newlyUnlockedNodeIds,
    newlyUnlockedTitles: event.newlyUnlockedTitles,
    routeSteps: event.routeSteps,
    chainNodeIds: event.chainNodeIds,
    chainEdgeIds: event.chainEdgeIds,
  };
}

export function buildOverlayTitle(
  unlockedCount: number,
  translate: GuideTranslate = defaultTranslate
): string {
  if (unlockedCount === 1) {
    return translate('guide.unlock.overlayOne');
  }
  return fillGuideTemplate(translate('guide.unlock.overlayMany'), { count: unlockedCount });
}
