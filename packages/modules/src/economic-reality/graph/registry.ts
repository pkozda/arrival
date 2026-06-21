import type { EconomicGraphDefinition, GraphRegistryKey } from './types.js';

export const G1_A: EconomicGraphDefinition = {
  graphId: 'G1',
  variant: 'A',
  intent: 'Economic detection — clarify income and residency facts',
  entryNodeId: 'g1-income-assess',
  nodeIds: ['g1-income-assess', 'g1-residency-assess'],
};

export const G1_B: EconomicGraphDefinition = {
  graphId: 'G1',
  variant: 'B',
  intent: 'System routing — identify Jobcenter or Sozialamt path',
  entryNodeId: 'g1-enter-system',
  nodeIds: [
    'g1-income-assess',
    'g1-residency-assess',
    'g1-route-support',
    'g1-jobcenter-intent',
    'g1-sozialamt-intent',
    'g1-enter-system',
  ],
};

export const G1_C: EconomicGraphDefinition = {
  graphId: 'G1',
  variant: 'C',
  intent: 'Crisis routing handoff — enter support system',
  entryNodeId: 'g5-system-entry',
  nodeIds: ['g1-enter-system', 'g5-system-entry'],
};

export const G2: EconomicGraphDefinition = {
  graphId: 'G2',
  intent: 'Jobcenter onboarding',
  entryNodeId: 'g2-registration',
  nodeIds: [
    'g2-registration',
    'g2-termination-docs',
    'g2-jobcenter-appointment',
    'g2-bank-account',
    'g2-first-payment',
  ],
};

export const G3: EconomicGraphDefinition = {
  graphId: 'G3',
  intent: 'Active Bürgergeld support loop',
  entryNodeId: 'g3-reporting',
  nodeIds: [
    'g3-reporting',
    'g3-job-search',
    'g3-income-changes',
    'g3-insurance',
    'g3-transition-plan',
  ],
};

export const G4: EconomicGraphDefinition = {
  graphId: 'G4',
  intent: 'Employment transition and benefit exit',
  entryNodeId: 'g4-offer-evaluation',
  nodeIds: [
    'g4-offer-evaluation',
    'g4-notify-jobcenter',
    'g4-benefit-exit',
    'g4-income-stability',
  ],
};

export const G5: EconomicGraphDefinition = {
  graphId: 'G5',
  intent: 'Financial crisis recovery',
  entryNodeId: 'g5-immediate-needs',
  nodeIds: [
    'g5-immediate-needs',
    'g5-system-entry',
    'g5-registration',
    'g5-appointment',
    'g5-bridge-income',
  ],
};

export const G6: EconomicGraphDefinition = {
  graphId: 'G6',
  intent: 'Sozialamt / asylum-era support path',
  entryNodeId: 'g6-status-confirm',
  nodeIds: [
    'g6-status-confirm',
    'g6-sozialamt-contact',
    'g6-arrival-proof',
    'g6-payment-setup',
    'g6-transition-awareness',
  ],
};

export const GRAPH_REGISTRY: Record<GraphRegistryKey, EconomicGraphDefinition> = {
  G1_A,
  G1_B,
  G1_C,
  G2,
  G3,
  G4,
  G5,
  G6,
};

export function lookupGraphDefinition(
  graphId: EconomicGraphDefinition['graphId'],
  variant?: EconomicGraphDefinition['variant']
): EconomicGraphDefinition {
  if (graphId === 'G1') {
    if (variant === 'A') {
      return GRAPH_REGISTRY.G1_A;
    }
    if (variant === 'B') {
      return GRAPH_REGISTRY.G1_B;
    }
    if (variant === 'C') {
      return GRAPH_REGISTRY.G1_C;
    }
    throw new Error(`G1 requires variant A, B, or C — received ${variant ?? 'none'}`);
  }

  const key = graphId as Exclude<GraphRegistryKey, 'G1_A' | 'G1_B' | 'G1_C'>;
  return GRAPH_REGISTRY[key];
}
