import type { OrderingStrategy } from '@arrival-atlas/product-contract';

export type TrackKind = 'primary' | 'secondary' | 'system';

export type ClassifiedTracks = {
  primary: import('@arrival-atlas/product-contract').EconomicActionV1[];
  secondary: import('@arrival-atlas/product-contract').EconomicActionV1[];
  system: import('@arrival-atlas/product-contract').EconomicActionV1[];
};

export const RULE_IDS = {
  P0: 'RULE_P0:crisis_override',
  P1: 'RULE_P1:institution_dominance',
  P2: 'RULE_P2:progression_default',
  P3: 'RULE_P3:action_type_priority',
  P4: 'RULE_P4:dependency_preservation',
  P5: 'RULE_P5:no_duplication',
} as const;

export type { OrderingStrategy };
