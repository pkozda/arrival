import type { LifeEventPlanNode } from '@/lib/product-contract';
import type { ActionSurfaceV1 } from '../actions';
import type { ExecutionAction, ExecutionBlockedAction } from './types';

export function collectBlockedNodeIds(surface: ActionSurfaceV1): Set<string> {
  const ids = new Set<string>();
  for (const node of surface.blockedActions) {
    if (isValidPlanNode(node)) {
      ids.add(node.id);
    }
  }
  return ids;
}

export function isValidPlanNode(node: LifeEventPlanNode | null | undefined): node is LifeEventPlanNode {
  return Boolean(node && typeof node.id === 'string' && node.id.length > 0 && typeof node.title === 'string' && node.title.length > 0);
}

export function resolveNodeHref(node: LifeEventPlanNode): string | undefined {
  const href = node.actions[0]?.href;
  return typeof href === 'string' && href.length > 0 ? href : undefined;
}

export function excludeBlockedIds<T extends { id: string }>(
  items: T[],
  blockedIds: ReadonlySet<string>
): T[] {
  return items.filter((item) => !blockedIds.has(item.id));
}

export function assertExecutableNotBlocked(
  actions: ExecutionAction[],
  blocked: ExecutionBlockedAction[]
): void {
  const blockedIds = new Set(blocked.map((action) => action.id));
  for (const action of actions) {
    if (blockedIds.has(action.id)) {
      throw new Error(`Blocked action leaked into executable set: ${action.id}`);
    }
  }
}

export function snapshotActionSurface(surface: ActionSurfaceV1): ActionSurfaceV1 {
  return structuredClone(surface);
}
