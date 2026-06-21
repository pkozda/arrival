import type { EconomicRealityPlanResponseV1 } from '@/lib/product-contract';
import type { EconomicRealityClientStateV1 } from './economic-reality-client-state';

export function hydrateEconomicPlan(
  apiResponse: EconomicRealityPlanResponseV1
): EconomicRealityClientStateV1 {
  return {
    loading: false,
    error: null,

    lastUpdated: apiResponse.meta.generatedAt,
    deterministicHash: apiResponse.meta.deterministicHash,

    evaluation: apiResponse.evaluation,
    graph: apiResponse.graph,
    execution: apiResponse.execution,
    actionSet: apiResponse.actionSet,
    plan: apiResponse.plan,
    presentation: apiResponse.presentation,
  };
}
