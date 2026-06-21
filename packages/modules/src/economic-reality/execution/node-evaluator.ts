import type {
  EconomicSatisfactionKey,
  NodeStateV1,
} from '@arrival-atlas/product-contract';
import {
  areSatisfactionKeysMet,
  countMetSatisfactionKeys,
} from './satisfaction-keys.js';
import type { EconomicSatisfactionSnapshot } from './types.js';

export type InstantiatedNode = {
  nodeId: string;
  satisfactionKeys: EconomicSatisfactionKey[];
  dependsOnNodeIds: string[];
  dependsOnAnyOfNodeIds: string[];
};

function isDependencySatisfied(
  node: InstantiatedNode,
  completedNodeIds: Set<string>
): { satisfied: boolean; blockedBy: string[] } {
  const blockedBy: string[] = [];

  for (const dependencyId of node.dependsOnNodeIds) {
    if (!completedNodeIds.has(dependencyId)) {
      blockedBy.push(dependencyId);
    }
  }

  if (node.dependsOnAnyOfNodeIds.length > 0) {
    const anyMet = node.dependsOnAnyOfNodeIds.some((dependencyId) =>
      completedNodeIds.has(dependencyId)
    );
    if (!anyMet) {
      blockedBy.push(...node.dependsOnAnyOfNodeIds);
    }
  }

  return { satisfied: blockedBy.length === 0, blockedBy };
}

function computeNodeProgress(
  satisfactionKeys: EconomicSatisfactionKey[],
  snapshot: EconomicSatisfactionSnapshot,
  met: boolean
): number {
  if (met) {
    return 1;
  }
  if (satisfactionKeys.length === 0) {
    return 0;
  }
  return countMetSatisfactionKeys(satisfactionKeys, snapshot) / satisfactionKeys.length;
}

export function evaluateNodeStates(
  nodes: InstantiatedNode[],
  snapshot: EconomicSatisfactionSnapshot
): Record<string, NodeStateV1> {
  const result: Record<string, NodeStateV1> = {};
  const completedNodeIds = new Set<string>();

  let changed = true;
  while (changed) {
    changed = false;

    for (const node of nodes) {
      if (completedNodeIds.has(node.nodeId)) {
        continue;
      }

      const satisfactionMet = areSatisfactionKeysMet(node.satisfactionKeys, snapshot);
      if (satisfactionMet) {
        completedNodeIds.add(node.nodeId);
        changed = true;
      }
    }
  }

  for (const node of nodes) {
    const satisfactionMet = areSatisfactionKeysMet(node.satisfactionKeys, snapshot);
    const { blockedBy } = isDependencySatisfied(node, completedNodeIds);

    let status: NodeStateV1['status'];
    if (satisfactionMet) {
      status = 'completed';
    } else if (blockedBy.length > 0) {
      status = 'locked';
    } else {
      status = 'active';
    }

    result[node.nodeId] = {
      nodeId: node.nodeId,
      status,
      progress: computeNodeProgress(node.satisfactionKeys, snapshot, satisfactionMet),
      satisfaction: {
        met: satisfactionMet,
        keys: node.satisfactionKeys,
      },
      blockedBy,
    };
  }

  return result;
}

export function deriveNodeSets(nodes: Record<string, NodeStateV1>): {
  activeNodeIds: string[];
  completedNodeIds: string[];
  readyNodeIds: string[];
  blockedNodeIds: string[];
} {
  const activeNodeIds: string[] = [];
  const completedNodeIds: string[] = [];
  const readyNodeIds: string[] = [];
  const blockedNodeIds: string[] = [];

  for (const node of Object.values(nodes)) {
    if (node.status === 'completed') {
      completedNodeIds.push(node.nodeId);
      continue;
    }

    if (node.status === 'locked') {
      blockedNodeIds.push(node.nodeId);
      continue;
    }

    if (node.status === 'active') {
      activeNodeIds.push(node.nodeId);
      readyNodeIds.push(node.nodeId);
    }
  }

  activeNodeIds.sort();
  completedNodeIds.sort();
  readyNodeIds.sort();
  blockedNodeIds.sort();

  return { activeNodeIds, completedNodeIds, readyNodeIds, blockedNodeIds };
}
