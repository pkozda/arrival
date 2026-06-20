import {
  safeParseLifeEventPlanV1,
  type LifeEventPlanNode,
  type LifeEventPlanV1,
} from '@/lib/product-contract';

export type ActionSurfaceV1 = {
  primaryAction: LifeEventPlanNode | null;
  secondaryActions: LifeEventPlanNode[];
  contextualActions: LifeEventPlanNode[];
  blockedActions: LifeEventPlanNode[];
};

export const EMPTY_ACTION_SURFACE: ActionSurfaceV1 = {
  primaryAction: null,
  secondaryActions: [],
  contextualActions: [],
  blockedActions: [],
};

function dedupeNodes(
  nodes: LifeEventPlanNode[],
  excludeIds: ReadonlySet<string>
): LifeEventPlanNode[] {
  const seen = new Set<string>();
  const result: LifeEventPlanNode[] = [];

  for (const node of nodes) {
    if (excludeIds.has(node.id) || seen.has(node.id)) {
      continue;
    }
    seen.add(node.id);
    result.push(node);
  }

  return result;
}

function isFutureActionableTimelineNode(node: LifeEventPlanNode): boolean {
  return node.actions.length > 0 && !node.satisfied;
}

export function projectActionSurface(plan: LifeEventPlanV1): ActionSurfaceV1 {
  const parsed = safeParseLifeEventPlanV1(plan);
  if (!parsed.success || !parsed.data.currentFocus?.id) {
    return { ...EMPTY_ACTION_SURFACE };
  }

  const valid = parsed.data;
  const primaryAction = valid.currentFocus;
  const blockedActions = dedupeNodes(valid.activeBlocks, new Set());

  const reservedIds = new Set<string>([
    primaryAction.id,
    ...blockedActions.map((node) => node.id),
  ]);

  const secondaryActions = dedupeNodes(valid.nextBestActions, reservedIds).slice(0, 3);
  for (const node of secondaryActions) {
    reservedIds.add(node.id);
  }

  const contextualActions = valid.timeline.filter(
    (node) => !reservedIds.has(node.id) && isFutureActionableTimelineNode(node)
  );

  return {
    primaryAction,
    secondaryActions,
    contextualActions,
    blockedActions,
  };
}

export function collectActionSurfaceNodeIds(surface: ActionSurfaceV1): string[] {
  const ids: string[] = [];
  if (surface.primaryAction) {
    ids.push(surface.primaryAction.id);
  }
  for (const node of surface.secondaryActions) {
    ids.push(node.id);
  }
  for (const node of surface.contextualActions) {
    ids.push(node.id);
  }
  for (const node of surface.blockedActions) {
    ids.push(node.id);
  }
  return ids;
}
