import type { LifeEventPlanNode } from '@/lib/product-contract';
import type { ActionSurfaceV1 } from '../actions';
import {
  assertExecutableNotBlocked,
  collectBlockedNodeIds,
  excludeBlockedIds,
  isValidPlanNode,
  resolveNodeHref,
} from './guards';
import {
  EMPTY_EXECUTION_SURFACE,
  type ExecutionAction,
  type ExecutionBlockedAction,
  type ExecutionSurfaceV1,
  type ExecutionUiHint,
} from './types';

function toExecutionAction(
  node: LifeEventPlanNode,
  source: ExecutionAction['source'],
  executionState: ExecutionAction['executionState'],
  uiHint: ExecutionUiHint
): ExecutionAction {
  return {
    id: node.id,
    label: node.title,
    href: resolveNodeHref(node),
    sourceNodeId: node.id,
    executionState,
    source,
    uiHint,
  };
}

function toBlockedAction(node: LifeEventPlanNode): ExecutionBlockedAction {
  return {
    id: node.id,
    label: node.title,
    href: resolveNodeHref(node),
    sourceNodeId: node.id,
    executionState: 'disabled',
    source: 'blocked',
    uiHint: 'secondary',
  };
}

function mapExecutableNodes(
  nodes: LifeEventPlanNode[],
  source: ExecutionAction['source'],
  blockedIds: ReadonlySet<string>
): ExecutionAction[] {
  const result: ExecutionAction[] = [];

  for (const node of nodes) {
    if (!isValidPlanNode(node) || blockedIds.has(node.id)) {
      continue;
    }

    result.push(toExecutionAction(node, source, 'ready', source));
  }

  return result;
}

export function buildExecutionSurface(surface: ActionSurfaceV1): ExecutionSurfaceV1 {
  const blockedIds = collectBlockedNodeIds(surface);

  const blocked = surface.blockedActions
    .filter(isValidPlanNode)
    .map(toBlockedAction);

  const primary =
    isValidPlanNode(surface.primaryAction) && !blockedIds.has(surface.primaryAction.id)
      ? toExecutionAction(surface.primaryAction, 'primary', 'ready', 'primary')
      : null;

  const secondary = mapExecutableNodes(
    excludeBlockedIds(surface.secondaryActions, blockedIds).slice(0, 3),
    'secondary',
    blockedIds
  );

  const contextual = mapExecutableNodes(
    excludeBlockedIds(surface.contextualActions, blockedIds),
    'contextual',
    blockedIds
  );

  const executionSurface: ExecutionSurfaceV1 = {
    primary,
    secondary,
    blocked,
    contextual,
  };

  if (primary) {
    assertExecutableNotBlocked([primary, ...secondary, ...contextual], blocked);
  } else {
    assertExecutableNotBlocked([...secondary, ...contextual], blocked);
  }

  return executionSurface;
}

export function buildExecutionSurfaceOrEmpty(surface: ActionSurfaceV1): ExecutionSurfaceV1 {
  try {
    return buildExecutionSurface(surface);
  } catch {
    return { ...EMPTY_EXECUTION_SURFACE };
  }
}
