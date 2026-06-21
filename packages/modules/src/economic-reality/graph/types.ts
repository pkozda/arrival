import type { EconomicGraphId, EconomicGraphVariant } from '@arrival-atlas/product-contract';

export type EconomicGraphNodeRef = {
  id: string;
  layer?: 'G1-A' | 'G1-B' | 'G1-C';
};

export type EconomicGraphDefinition = {
  graphId: EconomicGraphId;
  variant?: EconomicGraphVariant;
  intent: string;
  entryNodeId: string;
  nodeIds: string[];
};

export type GraphRegistryKey =
  | 'G1_A'
  | 'G1_B'
  | 'G1_C'
  | 'G2'
  | 'G3'
  | 'G4'
  | 'G5'
  | 'G6';
