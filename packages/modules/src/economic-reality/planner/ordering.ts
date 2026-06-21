import type { EconomicActionV1 } from '@arrival-atlas/product-contract';
import { ACTION_TYPE_ORDER } from '../actions/types.js';
import { lookupNodeCatalogEntry } from '../execution/node-catalog.js';

export function topologicalNodeOrder(nodeIds: string[], graphNodeIds: string[]): string[] {
  const relevant = new Set(nodeIds);
  const indegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const nodeId of nodeIds) {
    indegree.set(nodeId, 0);
    adjacency.set(nodeId, []);
  }

  for (const nodeId of nodeIds) {
    const catalog = lookupNodeCatalogEntry(nodeId);
    const prerequisites = [
      ...(catalog.dependsOnNodeIds ?? []),
      ...(catalog.dependsOnAnyOfNodeIds ?? []),
    ].filter((dependencyId) => relevant.has(dependencyId));

    for (const dependencyId of prerequisites) {
      adjacency.get(dependencyId)?.push(nodeId);
      indegree.set(nodeId, (indegree.get(nodeId) ?? 0) + 1);
    }
  }

  const queue = nodeIds
    .filter((nodeId) => (indegree.get(nodeId) ?? 0) === 0)
    .sort((left, right) => graphNodeIds.indexOf(left) - graphNodeIds.indexOf(right));

  const ordered: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    ordered.push(current);

    for (const next of adjacency.get(current) ?? []) {
      const nextDegree = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, nextDegree);
      if (nextDegree === 0) {
        queue.push(next);
        queue.sort((left, right) => graphNodeIds.indexOf(left) - graphNodeIds.indexOf(right));
      }
    }
  }

  if (ordered.length !== nodeIds.length) {
    return [...nodeIds].sort(
      (left, right) => graphNodeIds.indexOf(left) - graphNodeIds.indexOf(right)
    );
  }

  return ordered;
}

export function sortActionsDeterministically(
  actions: EconomicActionV1[],
  graphNodeIds: string[]
): EconomicActionV1[] {
  if (actions.length <= 1) {
    return [...actions];
  }

  const nodeIds = [...new Set(actions.map((action) => action.sourceNodeId))];
  const nodeOrder = topologicalNodeOrder(nodeIds, graphNodeIds);
  const nodeRank = new Map(nodeOrder.map((nodeId, index) => [nodeId, index]));

  return [...actions].sort((left, right) => {
    const nodeDiff =
      (nodeRank.get(left.sourceNodeId) ?? Number.MAX_SAFE_INTEGER) -
      (nodeRank.get(right.sourceNodeId) ?? Number.MAX_SAFE_INTEGER);
    if (nodeDiff !== 0) {
      return nodeDiff;
    }

    const typeDiff = ACTION_TYPE_ORDER[left.type] - ACTION_TYPE_ORDER[right.type];
    if (typeDiff !== 0) {
      return typeDiff;
    }

    return left.id.localeCompare(right.id);
  });
}

function partitionMatchingFirst(
  actions: EconomicActionV1[],
  predicate: (action: EconomicActionV1) => boolean
): EconomicActionV1[] {
  const matched = actions.filter(predicate);
  const rest = actions.filter((action) => !predicate(action));
  return [...matched, ...rest];
}

export function sortPrimaryTrackActions(
  actions: EconomicActionV1[],
  graphNodeIds: string[],
  strategy: import('@arrival-atlas/product-contract').OrderingStrategy
): EconomicActionV1[] {
  const sorted = sortActionsDeterministically(actions, graphNodeIds);

  if (strategy === 'CRISIS_FIRST') {
    return partitionMatchingFirst(
      sorted,
      (action) => action.payload.systemIntent === 'initiate_benefit_application'
    );
  }

  if (strategy === 'INSTITUTION_FIRST') {
    return partitionMatchingFirst(sorted, (action) => action.type === 'system_intent');
  }

  return sorted;
}
