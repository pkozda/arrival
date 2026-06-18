export type SdkRecommendationPriority = 'critical' | 'high' | 'medium' | 'low';

export type SdkRecommendationDefinition = {
  id: string;
  title: string;
  description: string;
  priority: SdkRecommendationPriority;
};

export function defineRecommendation(
  recommendation: SdkRecommendationDefinition
): SdkRecommendationDefinition {
  if (!recommendation.id || !recommendation.title) {
    throw new Error('Recommendation definition requires id and title');
  }

  return {
    id: recommendation.id,
    title: recommendation.title,
    description: recommendation.description,
    priority: recommendation.priority,
  };
}
