import type { EconomicSatisfactionKey } from '@arrival-atlas/product-contract';

export type NodeCatalogEntry = {
  satisfactionKeys: EconomicSatisfactionKey[];
  dependsOnNodeIds?: string[];
  dependsOnAnyOfNodeIds?: string[];
};

export type EconomicSatisfactionSnapshot = Record<EconomicSatisfactionKey, boolean>;
