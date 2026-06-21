import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ECONOMIC_FIXTURES } from '@arrival-atlas/modules/economic-reality';
import { buildApp } from '../../../src/build-app.js';
import {
  resetTestStateStore,
  setupTestStateStore,
  teardownTestStateStore,
} from '../../../src/test-state.js';
import { createE2eSession, fetchE2eEconomicPlan, seedE2eUserContext } from './helpers.js';

describe('E2E Scenario B — API journey: stabilized user', () => {
  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
  });

  afterEach(() => {
    teardownTestStateStore();
  });

  it('EF13 returns institution path with secondary track and no crisis benefit intent', async () => {
    const app = await buildApp({ logger: false });
    const sessionId = await createE2eSession(app);
    const fixture = ECONOMIC_FIXTURES.find((entry) => entry.id === 'EF13');
    if (!fixture) {
      throw new Error('Missing EF13');
    }

    await seedE2eUserContext(sessionId, fixture.userContext);
    const { statusCode, body } = await fetchE2eEconomicPlan(app, sessionId);

    expect(statusCode).toBe(200);
    if (typeof body === 'object' && body !== null && 'plan' in body) {
      expect(body.plan.orderingStrategy).toBe('INSTITUTION_FIRST');
      expect(body.evaluation.economicState).toBe('benefits_jobcenter');
      expect(body.presentation.sections.some((section) => section.type === 'SECONDARY')).toBe(true);

      const crisisIntent = body.actionSet.actions.filter(
        (action) =>
          action.type === 'system_intent' &&
          action.payload.systemIntent === 'initiate_benefit_application'
      );
      expect(crisisIntent).toHaveLength(0);

      const profileOrIntent = body.actionSet.actions.some(
        (action) =>
          action.type === 'update_profile' ||
          (action.type === 'system_intent' &&
            action.payload.systemIntent === 'report_income_change')
      );
      expect(profileOrIntent).toBe(true);
    }
  });
});
