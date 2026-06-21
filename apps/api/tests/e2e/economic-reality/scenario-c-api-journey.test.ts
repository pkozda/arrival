import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ECONOMIC_FIXTURES } from '@arrival-atlas/modules/economic-reality';
import type { UserContextV1 } from '@arrival-atlas/product-contract';
import { buildApp } from '../../../src/build-app.js';
import {
  resetTestStateStore,
  setupTestStateStore,
  teardownTestStateStore,
} from '../../../src/test-state.js';
import { createE2eSession, fetchE2eEconomicPlan, seedE2eUserContext } from './helpers.js';

function stabilizeCrisisContext(crisisContext: UserContextV1): UserContextV1 {
  const profile = crisisContext.profile;
  if (!profile) {
    throw new Error('Expected profile');
  }

  return {
    profile: {
      ...profile,
      domains: {
        ...profile.domains,
        migration: {
          residencyStatus: 'permanent-resident',
          arrivedAt: profile.domains.migration?.arrivedAt,
        },
        employment: { employmentStatus: 'employed' },
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

describe('E2E Scenario C — API journey: crisis recovery progression', () => {
  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
  });

  afterEach(() => {
    teardownTestStateStore();
  });

  it('deterministicHash changes when user context stabilizes after crisis', async () => {
    const app = await buildApp({ logger: false });
    const sessionId = await createE2eSession(app);
    const crisisFixture = ECONOMIC_FIXTURES.find((entry) => entry.id === 'EF07');
    if (!crisisFixture) {
      throw new Error('Missing EF07');
    }

    await seedE2eUserContext(sessionId, crisisFixture.userContext);
    const before = await fetchE2eEconomicPlan(app, sessionId);
    expect(before.statusCode).toBe(200);

    await seedE2eUserContext(sessionId, stabilizeCrisisContext(crisisFixture.userContext));
    const after = await fetchE2eEconomicPlan(app, sessionId);
    expect(after.statusCode).toBe(200);

    if (
      typeof before.body === 'object' &&
      before.body !== null &&
      'meta' in before.body &&
      typeof after.body === 'object' &&
      after.body !== null &&
      'meta' in after.body
    ) {
      expect(after.body.meta.deterministicHash).not.toEqual(before.body.meta.deterministicHash);
      expect(before.body.plan.orderingStrategy).toBe('CRISIS_FIRST');
      expect(after.body.plan.orderingStrategy).toBe('INSTITUTION_FIRST');
    }
  });
});
