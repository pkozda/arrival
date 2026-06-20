import type { LifeEventPlanV1, MissingContextHint, ProfileInsightViewV1 } from '@/lib/product-contract';
import type { ModuleSuggestion } from '@/lib/situation-utils';
import { projectActionSurface, type ActionSurfaceV1, EMPTY_ACTION_SURFACE } from './actions';
import { buildExecutionSurface, type ExecutionSurfaceV1 } from './execution';
import { dedupeHomeSurfaces } from './home-dedup';
import { mergeP4WithPlan } from './p4-merge';

export type HomePlanViewModelV2 = {
  plan: LifeEventPlanV1 | null;
  actionSurface: ActionSurfaceV1;
  executionSurface: ExecutionSurfaceV1 | null;
  p4: {
    showCard: boolean;
    completenessSummary: string | null;
    hints: MissingContextHint[];
  };
  suggestedModules: {
    showSection: boolean;
    items: ModuleSuggestion[];
  };
  nextSteps: {
    showCard: boolean;
    actionSurface: ActionSurfaceV1;
    executionSurface: ExecutionSurfaceV1 | null;
  };
};

export type BuildHomePlanViewModelInput = {
  plan: LifeEventPlanV1 | null;
  insights: ProfileInsightViewV1 | null;
  moduleSuggestions: ModuleSuggestion[];
  /**
   * undefined — build ExecutionSurfaceV1 from ActionSurfaceV1 (LE-5 default).
   * null — skip AEAL (LE-3/LE-4 fallback).
   */
  executionSurface?: ExecutionSurfaceV1 | null;
};

export function buildHomePlanViewModelV2(input: BuildHomePlanViewModelInput): HomePlanViewModelV2 {
  const { plan, insights, moduleSuggestions, executionSurface } = input;
  const actionSurface = plan ? projectActionSurface(plan) : { ...EMPTY_ACTION_SURFACE };

  const resolvedExecution =
    executionSurface === null
      ? null
      : executionSurface ?? (actionSurface.primaryAction ? buildExecutionSurface(actionSurface) : null);

  const p4Overlay = mergeP4WithPlan(plan, insights);
  const dedup = dedupeHomeSurfaces({
    actionSurface,
    p4Overlay,
    moduleSuggestions,
  });

  const showP4Card =
    dedup.visibleHints.length > 0 || Boolean(p4Overlay.metadata.completenessSummary);
  const showNextSteps = Boolean(actionSurface.primaryAction);
  const showSuggestedModules = dedup.visibleModuleSuggestions.length > 0;

  return {
    plan,
    actionSurface,
    executionSurface: resolvedExecution,
    p4: {
      showCard: showP4Card,
      completenessSummary: p4Overlay.metadata.completenessSummary,
      hints: dedup.visibleHints,
    },
    suggestedModules: {
      showSection: showSuggestedModules,
      items: dedup.visibleModuleSuggestions,
    },
    nextSteps: {
      showCard: showNextSteps,
      actionSurface,
      executionSurface: resolvedExecution,
    },
  };
}
