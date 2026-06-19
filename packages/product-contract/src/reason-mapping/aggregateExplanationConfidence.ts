import type { ModuleResult } from '@arrival-atlas/module-runtime';
import type { ExplanationConfidence } from '../ModuleExplanationView.js';

function coverageRatio(mapped: number, total: number): number {
  if (total === 0) {
    return 1;
  }

  return mapped / total;
}

export function aggregateExplanationConfidence(
  sealedModuleResult: ModuleResult,
  triggeredBecauseCount: number,
  recommendationsWithBecause: number,
  recommendationCount: number,
  actionsWithBecause: number,
  actionCount: number
): ExplanationConfidence {
  const hasExplanation = Boolean(sealedModuleResult.explanation);
  const enrichmentPresent =
    hasExplanation ||
    (sealedModuleResult.recommendations?.length ?? 0) > 0 ||
    (sealedModuleResult.actions?.length ?? 0) > 0;

  if (!enrichmentPresent || triggeredBecauseCount === 0) {
    return 'low';
  }

  const recommendationCoverage = coverageRatio(recommendationsWithBecause, recommendationCount);
  const actionCoverage = coverageRatio(actionsWithBecause, actionCount);
  const fullRecommendationCoverage = recommendationCount === 0 || recommendationCoverage === 1;
  const fullActionCoverage = actionCount === 0 || actionCoverage === 1;

  if (fullRecommendationCoverage && fullActionCoverage) {
    return sealedModuleResult.explanation?.confidence ?? 'high';
  }

  if (recommendationCoverage > 0 || actionCoverage > 0) {
    return 'medium';
  }

  return 'low';
}
