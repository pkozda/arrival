import type { LifeEventPlanNode } from '@arrival-atlas/product-contract';
import type { GraphNodeDefinition, LifeEventGraphDefinition } from './types.js';
import { CATEGORY_RANK, PRIORITY_RANK } from './types.js';
import { isSatisfactionMet, type SituationSignals } from '../signals.js';

export type ResolvedGraph = {
  graph: LifeEventGraphDefinition;
  nodes: LifeEventPlanNode[];
  focus: LifeEventPlanNode;
  nextBestActions: LifeEventPlanNode[];
  activeBlocks: LifeEventPlanNode[];
  timeline: LifeEventPlanNode[];
};

export function resolveGraph(
  graph: LifeEventGraphDefinition,
  signals: SituationSignals
): ResolvedGraph {
  const satisfactionByNodeId = new Map<string, boolean>();

  for (const node of graph.nodes) {
    satisfactionByNodeId.set(node.id, isSatisfactionMet(node.satisfactionKey, signals));
  }

  const nodes: LifeEventPlanNode[] = graph.nodes.map((node) => {
    const satisfied = satisfactionByNodeId.get(node.id) ?? false;
    const blocked = isNodeBlocked(node, satisfactionByNodeId);
    return toPlanNode(node, satisfied, blocked);
  });

  const unsatisfied = nodes.filter((node) => !node.satisfied);
  const ranked = [...unsatisfied].sort(comparePlanNodes);
  const focus = ranked[0] ?? nodes[nodes.length - 1]!;
  const nextBestActions = ranked.slice(0, 4);
  const activeBlocks = nodes.filter((node) => node.blocked && !node.satisfied);

  return {
    graph,
    nodes,
    focus,
    nextBestActions,
    activeBlocks,
    timeline: nodes,
  };
}

function isNodeBlocked(
  node: GraphNodeDefinition,
  satisfactionByNodeId: Map<string, boolean>
): boolean {
  for (const blockerId of node.blockedByNodeIds) {
    if (!satisfactionByNodeId.get(blockerId)) {
      return true;
    }
  }
  return false;
}

function toPlanNode(
  node: GraphNodeDefinition,
  satisfied: boolean,
  blocked: boolean
): LifeEventPlanNode {
  return {
    id: node.id,
    title: node.title,
    category: node.category,
    description: node.description,
    priority: node.priority,
    phase: node.phase,
    actions: node.actions,
    satisfied,
    blocked,
  };
}

export function comparePlanNodes(a: LifeEventPlanNode, b: LifeEventPlanNode): number {
  if (a.blocked !== b.blocked) {
    return a.blocked ? 1 : -1;
  }

  const categoryDiff = CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category];
  if (categoryDiff !== 0) {
    return categoryDiff;
  }

  const priorityDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  if (a.phase !== b.phase) {
    return a.phase - b.phase;
  }

  return a.id.localeCompare(b.id);
}

export function findNodeDefinition(
  graph: LifeEventGraphDefinition,
  nodeId: string
): GraphNodeDefinition | undefined {
  return graph.nodes.find((node) => node.id === nodeId);
}
