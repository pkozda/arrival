import type { ScenarioMatchV1, ScenarioPlanHintsV1 } from './scenario-types';

/**
 * Read-only bridge from scenario match to non-authoritative planner hints.
 * Does NOT mutate LifeEventPlanV1 or affect classifier output.
 */
export function buildScenarioPlanHints(match: ScenarioMatchV1 | null): ScenarioPlanHintsV1 | null {
  if (!match) {
    return null;
  }

  const suggestedStateShift =
    match.fromState !== match.toState ? match.toState : undefined;

  return {
    suggestedStateShift,
    explanation: match.reasoning,
    confidence: match.confidence,
  };
}
