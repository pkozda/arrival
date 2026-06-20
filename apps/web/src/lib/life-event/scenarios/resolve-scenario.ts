import type { SecondaryConditionId } from '@/lib/product-contract';
import type { ResolveScenarioInput, ScenarioContext, ScenarioMatchV1 } from './scenario-types';
import {
  countMatchedTriggers,
  SCENARIO_REGISTRY,
  scenarioAppliesToState,
} from './scenario-registry';
import {
  classifyTransitionType,
  compareScenarioCandidates,
  isTransitionAllowed,
  passesStabilityGuard,
  scoreTransitionConfidence,
} from './state-transitions';

export function resolveScenario(input: ResolveScenarioInput): ScenarioMatchV1 | null {
  const { userContext, currentPlan } = input;
  const currentState = currentPlan.currentLifeState;
  const secondaryConditions = currentPlan.secondaryConditions;

  if (currentState === 'situation_stable') {
    const hasDisruption = secondaryConditions.some((condition) =>
      (
        [
          'registration_incomplete',
          'insurance_gap',
          'housing_search_active',
          're_registration_required',
          'housing_data_missing',
          'employment_data_missing',
          'economic_setup_pending',
          'benefits_data_missing',
        ] as SecondaryConditionId[]
      ).includes(condition)
    );

    if (!hasDisruption) {
      return null;
    }
  }

  const context: ScenarioContext = {
    userContext,
    currentState,
    secondaryConditions,
  };

  const candidates: ScenarioMatchV1[] = [];

  for (const definition of SCENARIO_REGISTRY) {
    if (!scenarioAppliesToState(definition, currentState)) {
      continue;
    }

    if (!definition.matches(context)) {
      continue;
    }

    if (!isTransitionAllowed(currentState, definition.toState)) {
      continue;
    }

    const matchedTriggerCount = countMatchedTriggers(definition, context);
    const confidence = scoreTransitionConfidence({
      fromState: currentState,
      toState: definition.toState,
      matchedTriggerCount,
      scenarioPriority: definition.priority,
    });

    if (!passesStabilityGuard({ fromState: currentState, toState: definition.toState, confidence })) {
      continue;
    }

    if (currentState === definition.toState && confidence < 0.45) {
      continue;
    }

    candidates.push({
      scenarioId: definition.id,
      fromState: currentState,
      toState: definition.toState,
      confidence,
      reasoning: definition.reasoningTemplate(context),
      transitionType: classifyTransitionType(currentState, definition.toState),
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((left, right) =>
    compareScenarioCandidates(
      { priority: SCENARIO_REGISTRY.find((entry) => entry.id === left.scenarioId)!.priority, scenarioId: left.scenarioId },
      { priority: SCENARIO_REGISTRY.find((entry) => entry.id === right.scenarioId)!.priority, scenarioId: right.scenarioId }
    )
  );

  return candidates[0] ?? null;
}
