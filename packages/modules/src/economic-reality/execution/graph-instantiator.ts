import type { GraphContextV1 } from '@arrival-atlas/product-contract';
import { lookupGraphDefinition } from '../graph/registry.js';
import { lookupNodeCatalogEntry } from './node-catalog.js';
import type { InstantiatedNode } from './node-evaluator.js';

export function instantiateGraphNodes(graphContext: GraphContextV1): InstantiatedNode[] {
  const definition = lookupGraphDefinition(graphContext.graphId, graphContext.variant);

  return definition.nodeIds.map((nodeId) => {
    const catalog = lookupNodeCatalogEntry(nodeId);
    return {
      nodeId,
      satisfactionKeys: catalog.satisfactionKeys,
      dependsOnNodeIds: catalog.dependsOnNodeIds ?? [],
      dependsOnAnyOfNodeIds: catalog.dependsOnAnyOfNodeIds ?? [],
    };
  });
}

export function fingerprintGraphContext(graphContext: GraphContextV1): string {
  const variant = graphContext.variant ?? '-';
  return `${graphContext.graphId}:${variant}:${graphContext.entryNodeId}:${graphContext.reasoning.primarySelector}`;
}
