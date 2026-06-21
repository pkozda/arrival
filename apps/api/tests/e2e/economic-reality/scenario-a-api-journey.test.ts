import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ECONOMIC_FIXTURES } from '@arrival-atlas/modules/economic-reality';
import { CLASSIFIER_FIXTURES } from '@arrival-atlas/modules/life-event';
import { buildApp } from '../../../src/build-app.js';
import {
  resetTestStateStore,
  setupTestStateStore,
  teardownTestStateStore,
} from '../../../src/test-state.js';
import {
  createE2eSession,
  fetchE2eEconomicPlan,
  fetchE2eLifeEventPlan,
  seedE2eUserContext,
} from './helpers.js';

function fixtureById<T extends { id: string }>(fixtures: T[], id: string): T {
  const fixture = fixtures.find((entry) => entry.id === id);
  if (!fixture) {
    throw new Error(`Missing fixture ${id}`);
  }
  return fixture;
}

describe('E2E Scenario A — API journey: onboarding → economic assistance', () => {
  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
  });

  afterEach(() => {
    teardownTestStateStore();
  });

  it('Life Event plan is available for F01 and Economic Reality returns crisis plan for EF07', async () => {
    const app = await buildApp({ logger: false });

    const lifeSession = await createE2eSession(app);
    await seedE2eUserContext(lifeSession, fixtureById(CLASSIFIER_FIXTURES, 'F01').userContext);
    const lifeResponse = await fetchE2eLifeEventPlan(app, lifeSession);
    expect(lifeResponse.statusCode).toBe(200);
    expect((lifeResponse.body as { currentLifeState: string }).currentLifeState).toBe(
      'arrival_unregistered'
    );

    const erSession = await createE2eSession(app);
    await seedE2eUserContext(erSession, fixtureById(ECONOMIC_FIXTURES, 'EF07').userContext);
    const erResponse = await fetchE2eEconomicPlan(app, erSession);

    expect(erResponse.statusCode).toBe(200);
    expect(erResponse.headers['x-read-model']).toBe('EconomicRealityPlanResponseV1');

    const body = erResponse.body as Exclude<typeof erResponse.body, Record<string, unknown>>;
    expect(body.plan.orderingStrategy).toBe('CRISIS_FIRST');
    expect(body.presentation.sections.map((section) => section.type)).toEqual(
      expect.arrayContaining(['PRIMARY', 'SYSTEM'])
    );

    const benefitIntent = body.actionSet.actions.some(
      (action) =>
        action.type === 'system_intent' &&
        action.payload.systemIntent === 'initiate_benefit_application'
    );
    expect(benefitIntent).toBe(true);
    expect(body.meta.deterministicHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
