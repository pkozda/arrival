import type {
  EconomicActionSetV1,
  EconomicActionV1,
  GraphExecutionStateV1,
  UserContextV1,
} from '@arrival-atlas/product-contract';

const ECONOMIC_ACTION_SET_SCHEMA_VERSION = '1.0.0' as const;
import { mapNodeToActions } from './action-mapper.js';
import { ACTION_TYPE_ORDER } from './types.js';

function sortActions(actions: EconomicActionV1[]): EconomicActionV1[] {
  return [...actions].sort((left, right) => {
    const typeDiff = ACTION_TYPE_ORDER[left.type] - ACTION_TYPE_ORDER[right.type];
    if (typeDiff !== 0) {
      return typeDiff;
    }

    const nodeDiff = left.sourceNodeId.localeCompare(right.sourceNodeId);
    if (nodeDiff !== 0) {
      return nodeDiff;
    }

    return left.id.localeCompare(right.id);
  });
}

function collectEligibleNodes(execution: GraphExecutionStateV1) {
  const nodeIds = new Set([
    ...execution.activeNodeIds,
    ...execution.completedNodeIds,
    ...execution.derivedState.blockedNodeIds,
  ]);

  return [...nodeIds]
    .map((nodeId) => execution.nodes[nodeId])
    .filter((node): node is NonNullable<typeof node> => node !== undefined)
    .filter((node) => node.status === 'active' || node.status === 'completed');
}

export function buildActionSet(
  execution: GraphExecutionStateV1,
  _userContext: UserContextV1
): EconomicActionSetV1 {
  const eligibleNodes = collectEligibleNodes(execution);
  const actions = sortActions(
    eligibleNodes.flatMap((node) => mapNodeToActions(execution.graphId, node))
  );

  const derivedFromNodes = [...new Set(actions.map((action) => action.sourceNodeId))].sort();

  return {
    schemaVersion: ECONOMIC_ACTION_SET_SCHEMA_VERSION,
    graphId: execution.graphId,
    actions,
    metadata: {
      sourceExecutionId: execution.reasoning.initializedFrom,
      derivedFromNodes,
    },
  };
}
