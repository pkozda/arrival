import type { EconomicRealityPlanResponseV1, UserContextV1 } from '@arrival-atlas/product-contract';
import { evaluate } from '../../economic-reality/rule-engine/evaluate.js';
import { resolveGraphContext } from '../../economic-reality/graph/resolve-graph.js';
import { buildExecutionState } from '../../economic-reality/execution/build-execution-state.js';
import { buildActionSet } from '../../economic-reality/actions/build-action-set.js';
import { buildPlan } from '../../economic-reality/planner/build-plan.js';
import { buildPresentation } from '../../economic-reality/presentation/build-presentation.js';
import { assertValidEconomicUserContext, EconomicRealityPlanError } from './guards.js';
import { computePipelineDeterministicHash } from './serializer.js';
import { buildEconomicRealityPlanResponse } from './response-builder.js';
import type { PipelineMetaInput } from './guards.js';

const ECONOMIC_REALITY_PIPELINE_VERSION = 'ep1-ep6-v1' as const;

export function buildEconomicRealityPlan(
  userContext: UserContextV1,
  meta: PipelineMetaInput
): EconomicRealityPlanResponseV1 {
  assertValidEconomicUserContext(userContext);

  let evaluation;
  try {
    evaluation = evaluate(userContext, {
      feedbackSignals: meta.feedbackSignals,
    });
  } catch (error) {
    throw new EconomicRealityPlanError(
      'ECONOMIC_CONTEXT_INVALID',
      'Failed to evaluate economic context',
      error
    );
  }

  let graph;
  try {
    graph = resolveGraphContext(evaluation);
  } catch (error) {
    throw new EconomicRealityPlanError(
      'GRAPH_RESOLUTION_FAILED',
      'Failed to resolve economic graph context',
      error
    );
  }

  let execution;
  try {
    execution = buildExecutionState(graph, userContext, {
      feedbackSignals: meta.feedbackSignals,
    });
  } catch (error) {
    throw new EconomicRealityPlanError(
      'EXECUTION_BUILD_FAILED',
      'Failed to build graph execution state',
      error
    );
  }

  let actionSet;
  try {
    actionSet = buildActionSet(execution, userContext);
  } catch (error) {
    throw new EconomicRealityPlanError(
      'EXECUTION_BUILD_FAILED',
      'Failed to build economic action set',
      error
    );
  }

  if (actionSet.actions.length === 0) {
    throw new EconomicRealityPlanError('ACTION_SET_EMPTY', 'Economic action set is empty');
  }

  let plan;
  try {
    plan = buildPlan(execution, actionSet, userContext);
  } catch (error) {
    throw new EconomicRealityPlanError(
      'PLAN_BUILD_FAILED',
      'Failed to build economic plan',
      error
    );
  }

  let presentation;
  try {
    presentation = buildPresentation(plan, actionSet);
  } catch (error) {
    throw new EconomicRealityPlanError(
      'PRESENTATION_BUILD_FAILED',
      'Failed to build economic presentation',
      error
    );
  }

  const deterministicHash = computePipelineDeterministicHash({
    evaluation,
    graph,
    execution,
    actionSet,
    plan,
    presentation,
  });

  const response = buildEconomicRealityPlanResponse({
    pipeline: {
      evaluation,
      graph,
      execution,
      actionSet,
      plan,
      presentation,
    },
    meta: {
      requestId: meta.requestId,
      generatedAt: meta.generatedAt,
      pipelineVersion: ECONOMIC_REALITY_PIPELINE_VERSION,
      deterministicHash,
    },
  });

  return serializeEconomicRealityPlanResponse(response);
}

export function serializeEconomicRealityPlanResponse(
  response: EconomicRealityPlanResponseV1
): EconomicRealityPlanResponseV1 {
  return response;
}
