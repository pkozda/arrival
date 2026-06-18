import type { ActionItem } from '../types/ActionItem.js';
import type { Recommendation } from '../types/Recommendation.js';
import { normalizeRecommendations } from '../normalizers/normalizeRecommendations.js';
import { buildActionItems } from '../normalizers/actions/buildActionItems.js';
import type { GovernedModuleRegistry } from './GovernedModuleRegistry.js';

export function resolveNormalizers(
  governedRegistry: GovernedModuleRegistry,
  moduleId: string
) {
  return {
    recommendation: governedRegistry.hasRecommendationNormalizer(moduleId)
      ? (payload: unknown) => governedRegistry.normalizeRecommendations(moduleId, payload)
      : undefined,
    action: governedRegistry.hasActionNormalizer(moduleId)
      ? (payload: unknown, recommendations?: readonly Recommendation[]) =>
          governedRegistry.normalizeActions(moduleId, payload, recommendations)
      : undefined,
  };
}

export function normalizeRecommendationsFromGovernance(
  governedRegistry: GovernedModuleRegistry,
  moduleId: string,
  payload: unknown
): readonly Recommendation[] {
  if (governedRegistry.hasRecommendationNormalizer(moduleId)) {
    return governedRegistry.normalizeRecommendations(moduleId, payload);
  }

  return normalizeRecommendations({ moduleId, payload });
}

export function normalizeActionsFromGovernance(
  governedRegistry: GovernedModuleRegistry,
  moduleId: string,
  payload: unknown,
  recommendations?: readonly Recommendation[]
): readonly ActionItem[] {
  if (governedRegistry.hasActionNormalizer(moduleId)) {
    return governedRegistry.normalizeActions(moduleId, payload, recommendations);
  }

  return buildActionItems({ moduleId, payload, recommendations });
}
