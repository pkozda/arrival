import type { LifeEventPlanNode } from '@/lib/product-contract';
import { layoutGalaxyGraphNodes, type SpatialGraphEdge } from '@/lib/presentation/spatial-core';

type BuildGalaxyGraphInput = {
  primaryAction: LifeEventPlanNode | null;
  blockedActions: LifeEventPlanNode[];
  completedNodes: LifeEventPlanNode[];
  secondaryActions: LifeEventPlanNode[];
  contextualActions: LifeEventPlanNode[];
};

export function buildLifeEventGalaxyGraph({
  primaryAction,
  blockedActions,
  completedNodes,
  secondaryActions,
  contextualActions,
}: BuildGalaxyGraphInput) {
  const graphNodes = layoutGalaxyGraphNodes<LifeEventPlanNode>({
    primary: primaryAction
      ? {
          id: primaryAction.id,
          status: primaryAction.satisfied ? 'completed' : 'recommended',
          payload: primaryAction,
        }
      : undefined,
    blocked: blockedActions.map((node) => ({
      id: node.id,
      status: 'blocked' as const,
      payload: node,
    })),
    completed: completedNodes.map((node) => ({
      id: node.id,
      status: 'completed' as const,
      payload: node,
    })),
    secondary: secondaryActions.map((node) => ({
      id: node.id,
      status: node.satisfied ? 'completed' : 'recommended',
      payload: node,
    })),
    contextual: contextualActions.map((node) => ({
      id: node.id,
      status: 'future' as const,
      payload: node,
    })),
  });

  const graphEdges: SpatialGraphEdge[] = [];
  const focusId = primaryAction?.id;

  if (focusId) {
    graphEdges.push({ id: `unlock-journey-${focusId}`, from: '__journey__', to: focusId, type: 'unlock' });
    secondaryActions.forEach((node) => {
      graphEdges.push({ id: `unlock-${focusId}-${node.id}`, from: focusId, to: node.id, type: 'unlock' });
    });
    contextualActions.forEach((node) => {
      graphEdges.push({ id: `unlock-${focusId}-${node.id}`, from: focusId, to: node.id, type: 'unlock' });
    });
    blockedActions.forEach((node) => {
      graphEdges.push({ id: `dep-${node.id}-${focusId}`, from: node.id, to: focusId, type: 'dependency' });
    });
  } else {
    secondaryActions.forEach((node) => {
      graphEdges.push({ id: `unlock-journey-${node.id}`, from: '__journey__', to: node.id, type: 'unlock' });
    });
  }

  return { graphNodes, graphEdges };
}
