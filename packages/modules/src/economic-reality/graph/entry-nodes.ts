import type { EconomicGraphId, EconomicGraphVariant } from '@arrival-atlas/product-contract';

export const G1_ENTRY_BY_VARIANT: Record<EconomicGraphVariant, string> = {
  A: 'g1-income-assess',
  B: 'g1-enter-system',
  C: 'g5-system-entry',
};

export const ENTRY_NODE_BY_GRAPH: Record<Exclude<EconomicGraphId, 'G1'>, string> = {
  G2: 'g2-registration',
  G3: 'g3-reporting',
  G4: 'g4-offer-evaluation',
  G5: 'g5-immediate-needs',
  G6: 'g6-status-confirm',
};

export function resolveEntryNodeId(
  graphId: EconomicGraphId,
  variant?: EconomicGraphVariant
): string {
  if (graphId === 'G1') {
    if (!variant) {
      throw new Error('G1 graph requires variant A, B, or C');
    }
    return G1_ENTRY_BY_VARIANT[variant];
  }

  return ENTRY_NODE_BY_GRAPH[graphId];
}

export const ALL_ENTRY_NODE_IDS = [
  ...Object.values(G1_ENTRY_BY_VARIANT),
  ...Object.values(ENTRY_NODE_BY_GRAPH),
] as const;

export function isValidEntryNodeId(nodeId: string): boolean {
  return (ALL_ENTRY_NODE_IDS as readonly string[]).includes(nodeId);
}
