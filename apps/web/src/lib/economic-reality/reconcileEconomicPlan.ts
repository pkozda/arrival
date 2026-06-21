import type { EconomicRealityPlanResponseV1 } from '@/lib/product-contract';
import type { EconomicRealityClientStateV1 } from './economic-reality-client-state';
import { writeEconomicPlanCache } from './cache';
import { hydrateEconomicPlan } from './hydrateEconomicPlan';

function cloneClientState(state: EconomicRealityClientStateV1): EconomicRealityClientStateV1 {
  return structuredClone(state);
}

export function reconcileEconomicPlanState(
  _current: EconomicRealityClientStateV1,
  incoming: EconomicRealityPlanResponseV1
): EconomicRealityClientStateV1 {
  const hydrated = hydrateEconomicPlan(incoming);
  writeEconomicPlanCache(hydrated);
  return cloneClientState(hydrated);
}
