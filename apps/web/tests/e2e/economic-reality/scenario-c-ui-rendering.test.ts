import { describe, expect, it } from 'vitest';
import { ECONOMIC_FIXTURES } from '@arrival-atlas/modules/economic-reality';
import { buildEconomicRealityPlan } from '@arrival-atlas/modules/economic-reality';
import { buildUiJourneyPlan, E2E_UI_FIXED_META, projectUiSections } from './helpers.js';

function stabilizeCrisisContext(fixtureId: string) {
  const fixture = ECONOMIC_FIXTURES.find((entry) => entry.id === fixtureId);
  if (!fixture?.userContext.profile) {
    throw new Error('Missing crisis fixture');
  }

  return {
    profile: {
      ...fixture.userContext.profile,
      domains: {
        ...fixture.userContext.profile.domains,
        migration: {
          residencyStatus: 'permanent-resident' as const,
          arrivedAt: fixture.userContext.profile.domains.migration?.arrivedAt,
        },
        employment: { employmentStatus: 'employed' as const },
        income: { grossMonthlyIncome: 2800 },
        housing: { city: 'Berlin' },
        benefits: {
          receivingBuergergeld: true,
          receivingSozialamtSupport: false,
          daysInGermany: 120,
        },
      },
    },
  };
}

describe('E2E Scenario C — UI rendering: crisis recovery progression', () => {
  it('changes UI strategy and section layout after stabilization', () => {
    const before = buildUiJourneyPlan('EF07');
    const after = buildEconomicRealityPlan(stabilizeCrisisContext('EF07'), E2E_UI_FIXED_META);

    expect(before.presentation.uiStrategy).toBe('CRISIS_UI');
    expect(after.presentation.uiStrategy).toBe('INSTITUTION_UI');
    expect(after.meta.deterministicHash).not.toEqual(before.meta.deterministicHash);

    const beforeSections = projectUiSections(before.presentation).map((entry) => entry.section.type);
    const afterSections = projectUiSections(after.presentation).map((entry) => entry.section.type);

    expect(beforeSections).toContain('SYSTEM');
    expect(afterSections).toContain('SECONDARY');
  });
});
