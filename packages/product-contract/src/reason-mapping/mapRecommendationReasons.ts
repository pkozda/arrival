import type { Recommendation } from '@arrivalos/module-runtime';
import type { ExplanationFactor } from '../ModuleExplanationView.js';
import { mapExplanationFactors } from './mapExplanationFactors.js';

export function mapRecommendationReasons(
  recommendations: readonly Recommendation[] | undefined
): Array<{ recommendationId: string; because: ExplanationFactor[] }> {
  if (!recommendations) {
    return [];
  }

  return recommendations.map((recommendation) => ({
    recommendationId: recommendation.id,
    because: mapExplanationFactors(recommendation.explanation.factors),
  }));
}
