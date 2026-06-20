import type { LifeStateId } from '@/lib/product-contract';
import type { ScenarioTransitionType } from './scenario-types';

/**
 * Allowed life-state transitions for scenario reasoning (NOT the planning graph G1–G7).
 */
export const TRANSITION_MATRIX: Record<LifeStateId, LifeStateId[]> = {
  arrival_unregistered: [
    'arrival_stabilizing',
    'economic_setup_pending',
    'housing_instability',
    'insurance_gap',
  ],
  arrival_stabilizing: [
    'arrival_unregistered',
    'economic_setup_pending',
    'housing_instability',
    'insurance_gap',
    'benefits_exploration',
    'situation_stable',
  ],
  economic_setup_pending: [
    'arrival_stabilizing',
    'benefits_exploration',
    'situation_stable',
    'insurance_gap',
    'housing_instability',
  ],
  housing_instability: [
    'arrival_stabilizing',
    'economic_setup_pending',
    'situation_stable',
  ],
  insurance_gap: [
    'arrival_stabilizing',
    'economic_setup_pending',
    'situation_stable',
  ],
  benefits_exploration: [
    'economic_setup_pending',
    'situation_stable',
    'arrival_stabilizing',
  ],
  situation_stable: [
    'economic_setup_pending',
    'housing_instability',
    'insurance_gap',
    'benefits_exploration',
    'arrival_stabilizing',
  ],
};

const STABLE_EXIT_MIN_CONFIDENCE = 0.75;

const SEVERITY_RANK: Record<LifeStateId, number> = {
  arrival_unregistered: 4,
  insurance_gap: 4,
  economic_setup_pending: 3,
  housing_instability: 3,
  benefits_exploration: 2,
  arrival_stabilizing: 2,
  situation_stable: 1,
};

export function isTransitionAllowed(fromState: LifeStateId, toState: LifeStateId): boolean {
  if (fromState === toState) {
    return true;
  }
  return TRANSITION_MATRIX[fromState]?.includes(toState) ?? false;
}

export function classifyTransitionType(
  fromState: LifeStateId,
  toState: LifeStateId
): ScenarioTransitionType {
  if (fromState === toState) {
    return 'none';
  }

  const delta = Math.abs(SEVERITY_RANK[toState] - SEVERITY_RANK[fromState]);
  if (delta >= 2 || toState === 'arrival_unregistered' || toState === 'insurance_gap') {
    return 'hard';
  }

  return 'soft';
}

export function scoreTransitionConfidence(input: {
  fromState: LifeStateId;
  toState: LifeStateId;
  matchedTriggerCount: number;
  scenarioPriority: number;
}): number {
  const { fromState, toState, matchedTriggerCount, scenarioPriority } = input;
  let score = scenarioPriority / 100;

  score += Math.min(0.4, matchedTriggerCount * 0.15);

  if (fromState === toState) {
    score *= 0.6;
  }

  if (fromState === 'situation_stable' && toState !== 'situation_stable') {
    score *= 0.5;
  }

  return Math.min(1, Math.round(score * 100) / 100);
}

export function passesStabilityGuard(input: {
  fromState: LifeStateId;
  toState: LifeStateId;
  confidence: number;
}): boolean {
  if (input.fromState !== 'situation_stable') {
    return true;
  }

  if (input.toState === 'situation_stable') {
    return true;
  }

  return input.confidence >= STABLE_EXIT_MIN_CONFIDENCE;
}

export function compareScenarioCandidates(
  left: { priority: number; scenarioId: string },
  right: { priority: number; scenarioId: string }
): number {
  if (right.priority !== left.priority) {
    return right.priority - left.priority;
  }

  return left.scenarioId.localeCompare(right.scenarioId);
}
