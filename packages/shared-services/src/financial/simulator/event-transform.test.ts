import { describe, it, expect } from 'vitest';
import { applyEventsToBaseline } from './event-transform.js';
import { buildHouseholdFromLegacy } from '../household/index.js';

describe('applyEventsToBaseline', () => {
  const baseline = () => {
    const household = buildHouseholdFromLegacy(1, 'single', 800, 1, false);
    return {
      household,
      employments: {
        applicant: {
          type: 'regular' as const,
          grossMonthly: 2500,
          taxClass: 1 as const,
          churchTax: false,
        },
      },
    };
  };

  it('does not mutate baseline when applying unemployment event', () => {
    const base = baseline();
    const baseCopy = structuredClone(base);

    const result = applyEventsToBaseline(base, [{ type: 'unemployment' }]);

    expect(base).toEqual(baseCopy);
    expect(result.employments.applicant).toEqual({ type: 'none' });
  });

  it('applies minijob event immutably', () => {
    const result = applyEventsToBaseline(baseline(), [
      { type: 'minijob', grossMonthly: 450 },
    ]);

    expect(result.employments.applicant).toMatchObject({
      type: 'minijob',
      grossMonthly: 450,
    });
  });

  it('applies rent-change event', () => {
    const result = applyEventsToBaseline(baseline(), [
      { type: 'rent-change', newColdRent: 950 },
    ]);

    expect(result.household.housing.coldRent).toBe(950);
  });

  it('applies child-added event', () => {
    const result = applyEventsToBaseline(baseline(), [{ type: 'child-added', age: 3 }]);

    expect(result.household.members.filter((m) => m.role === 'child')).toHaveLength(1);
  });
});
