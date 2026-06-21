import type { LifeEventPlanNode } from '@/lib/product-contract';
import type { ActionSurfaceV1 } from '@/lib/life-event-plan';

const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function severityRank(node: LifeEventPlanNode): number {
  return SEVERITY_RANK[node.priority] ?? 99;
}

export function normalizeWireframeSurface(surface: ActionSurfaceV1): ActionSurfaceV1 {
  return {
    ...surface,
    blockedActions: [...surface.blockedActions].sort(
      (left, right) => severityRank(left) - severityRank(right)
    ),
  };
}
