import type { EconomicRealityPlanResponseV1 } from '@/lib/product-contract';
import type { EconomicRealityClientStateV1 } from './economic-reality-client-state';
import { readEconomicPlanCache, writeEconomicPlanCache } from './cache';
import { hydrateEconomicPlan } from './hydrateEconomicPlan';

export function reconcileEconomicPlanState(
  current: EconomicRealityClientStateV1,
  incoming: EconomicRealityPlanResponseV1
): EconomicRealityClientStateV1 {
  if (
    current.deterministicHash !== null &&
    current.deterministicHash === incoming.meta.deterministicHash
  ) {
    return current;
  }

  const cached = readEconomicPlanCache(incoming.meta.deterministicHash);
  if (cached) {
    return cached;
  }

  const hydrated = hydrateEconomicPlan(incoming);
  writeEconomicPlanCache(hydrated);
  return hydrated;
}
