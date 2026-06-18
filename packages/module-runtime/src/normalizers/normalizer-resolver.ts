import type { ActionItem } from '../types/ActionItem.js';
import type { Recommendation } from '../types/Recommendation.js';
import { buildActionItems } from './actions/buildActionItems.js';
import { normalizeRecommendations } from './normalizeRecommendations.js';
import type { GovernedModuleRegistry } from '../governance/GovernedModuleRegistry.js';

export function resolveRecommendations(params: {
  moduleId: string;
  payload: unknown;
  governedRegistry?: GovernedModuleRegistry;
}): readonly Recommendation[] {
  if (params.governedRegistry) {
    return params.governedRegistry.normalizeRecommendations(params.moduleId, params.payload);
  }

  return normalizeRecommendations({
    moduleId: params.moduleId,
    payload: params.payload,
  });
}

export function resolveActions(params: {
  moduleId: string;
  payload: unknown;
  recommendations?: readonly Recommendation[];
  governedRegistry?: GovernedModuleRegistry;
}): readonly ActionItem[] {
  if (params.governedRegistry) {
    return params.governedRegistry.normalizeActions(
      params.moduleId,
      params.payload,
      params.recommendations
    );
  }

  return buildActionItems({
    moduleId: params.moduleId,
    payload: params.payload,
    recommendations: params.recommendations,
  });
}
