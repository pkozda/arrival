import type { EconomicRealityClientStateV1 } from './economic-reality-client-state';

const economicPlanCache = new Map<string, EconomicRealityClientStateV1>();

export function buildEconomicPlanCacheKey(deterministicHash: string): string {
  return `economic-plan:${deterministicHash}`;
}

export function readEconomicPlanCache(
  deterministicHash: string
): EconomicRealityClientStateV1 | undefined {
  return economicPlanCache.get(buildEconomicPlanCacheKey(deterministicHash));
}

export function writeEconomicPlanCache(state: EconomicRealityClientStateV1): void {
  if (!state.deterministicHash) {
    return;
  }

  economicPlanCache.set(buildEconomicPlanCacheKey(state.deterministicHash), state);
}

export function clearEconomicPlanCache(): void {
  economicPlanCache.clear();
}
