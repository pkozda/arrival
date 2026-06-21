import { clearEconomicPlanCache } from './cache';

export function shouldInvalidateEconomicPlan(
  previousHash: string | null,
  nextHash: string | null
): boolean {
  if (!previousHash || !nextHash) {
    return false;
  }
  return previousHash !== nextHash;
}

export function invalidateEconomicPlanIfHashChanged(
  previousHash: string | null,
  nextHash: string | null
): boolean {
  if (!shouldInvalidateEconomicPlan(previousHash, nextHash)) {
    return false;
  }

  clearEconomicPlanCache();
  return true;
}
