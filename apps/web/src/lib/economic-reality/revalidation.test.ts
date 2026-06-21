import { describe, expect, it } from 'vitest';
import { shouldInvalidateEconomicPlan, invalidateEconomicPlanIfHashChanged } from './revalidation';
import { writeEconomicPlanCache, readEconomicPlanCache } from './cache';
import { EMPTY_ECONOMIC_REALITY_CLIENT_STATE } from './economic-reality-client-state';

describe('economic plan revalidation EP-12', () => {
  it('invalidates cache only when deterministic hash changes', () => {
    expect(shouldInvalidateEconomicPlan('hash-a', 'hash-a')).toBe(false);
    expect(shouldInvalidateEconomicPlan('hash-a', 'hash-b')).toBe(true);
    expect(shouldInvalidateEconomicPlan(null, 'hash-b')).toBe(false);
  });

  it('clears cache when hash changes', () => {
    writeEconomicPlanCache({
      ...EMPTY_ECONOMIC_REALITY_CLIENT_STATE,
      deterministicHash: 'hash-a',
    });

    const changed = invalidateEconomicPlanIfHashChanged('hash-a', 'hash-b');
    expect(changed).toBe(true);
    expect(readEconomicPlanCache('hash-a')).toBeUndefined();
  });
});
