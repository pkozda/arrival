import type { ModuleRuntimeContext } from '../types/ModuleRuntimeContext.js';
import type { Recommendation } from '../types/Recommendation.js';
import { normalizeBenefitsSimulatorRecommendations } from './benefits-simulator.js';
import { normalizeFinancialRealityRecommendations } from './financial-reality.js';

export type NormalizeRecommendationsParams = {
  moduleId: string;
  payload: unknown;
  runtimeContext?: ModuleRuntimeContext;
};

export function normalizeRecommendations(
  params: NormalizeRecommendationsParams
): Recommendation[] {
  switch (params.moduleId) {
    case 'financial-reality':
      return normalizeFinancialRealityRecommendations(params.payload);
    case 'benefits-simulator':
      return normalizeBenefitsSimulatorRecommendations(params.payload);
    default:
      return [];
  }
}
