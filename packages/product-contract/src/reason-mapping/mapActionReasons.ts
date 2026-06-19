import type { ActionItem, Recommendation } from '@arrival-atlas/module-runtime';
import type { ExplanationFactor } from '../ModuleExplanationView.js';
import { mapExplanationFactors } from './mapExplanationFactors.js';

export function mapActionReasons(
  actions: readonly ActionItem[] | undefined,
  recommendations: readonly Recommendation[] | undefined
): Array<{ actionId: string; because: ExplanationFactor[] }> {
  if (!actions) {
    return [];
  }

  const recommendationsById = new Map(
    (recommendations ?? []).map((recommendation) => [recommendation.id, recommendation])
  );

  return actions.map((action) => {
    const linkedRecommendation = action.recommendationId
      ? recommendationsById.get(action.recommendationId)
      : undefined;

    return {
      actionId: action.id,
      because: mapExplanationFactors(linkedRecommendation?.explanation.factors),
    };
  });
}
