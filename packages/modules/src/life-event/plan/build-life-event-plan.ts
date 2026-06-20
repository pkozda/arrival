import type { LifeEventPlanV1, ProfileInsightViewV1, UserContextV1 } from '@arrival-atlas/product-contract';
import { PLANNING_SEVERITY_BY_STATE } from '@arrival-atlas/product-contract';
import { classifyLifeState } from './classify-life-state.js';
import { detectSecondaryConditions } from './detect-secondary-conditions.js';
import { buildReasoning } from './build-reasoning.js';
import { getGraphForState } from './graph/catalog.js';
import { resolveGraph } from './graph/resolve.js';
import { computeSituationSignals } from './signals.js';

export const LIFE_EVENT_MODULE_VERSION = '2.0.0';

export type BuildLifeEventPlanInput = {
  userContext: UserContextV1;
  profileInsights?: ProfileInsightViewV1 | null;
  generatedAt?: string;
};

export function buildLifeEventPlan(input: BuildLifeEventPlanInput): LifeEventPlanV1 {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const currentLifeState = classifyLifeState(input.userContext);
  const secondaryConditions = detectSecondaryConditions(
    input.userContext,
    input.profileInsights
  );
  const graph = getGraphForState(currentLifeState);
  const signals = computeSituationSignals(input.userContext);
  const resolved = resolveGraph(graph, signals);
  const reasoning = buildReasoning(
    graph,
    resolved.focus,
    resolved.activeBlocks,
    secondaryConditions,
    input.profileInsights
  );

  return {
    schemaVersion: '1.0.0',
    generatedAt,
    moduleId: 'life-event',
    moduleVersion: LIFE_EVENT_MODULE_VERSION,
    currentLifeState,
    secondaryConditions,
    planningSeverity: PLANNING_SEVERITY_BY_STATE[currentLifeState],
    currentFocus: resolved.focus,
    nextBestActions: resolved.nextBestActions,
    activeBlocks: resolved.activeBlocks,
    timeline: resolved.timeline,
    reasoning,
  };
}
