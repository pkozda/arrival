import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ECONOMIC_FIXTURES } from '@arrival-atlas/modules/economic-reality';
import { buildApp } from '../../../src/build-app.js';
import { buildEconomicRealityPlanFromState } from '../../../src/state/economic-reality-plan-projection.js';
import { systemStateCoordinator } from '../../../src/state/system-state-coordinator.js';
import {
  resetTestStateStore,
  setupTestStateStore,
  teardownTestStateStore,
} from '../../../src/test-state.js';
import { createE2eSession, fetchE2eEconomicPlan, seedE2eUserContext } from './helpers.js';

describe('E2E API — economic action execute boundary', () => {
  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
  });

  afterEach(() => {
    teardownTestStateStore();
  });

  it('accepts only action IDs from the current action set', async () => {
    const app = await buildApp({ logger: false });
    const sessionId = await createE2eSession(app);
    await seedE2eUserContext(sessionId, ECONOMIC_FIXTURES[2]!.userContext);

    const planResponse = await fetchE2eEconomicPlan(app, sessionId);
    expect(planResponse.statusCode).toBe(200);

    const state = await systemStateCoordinator.getState(sessionId);
    const projected = buildEconomicRealityPlanFromState(state!, 'e2e-action');
    const actionId = projected.actionSet.actions[0]!.id;

    const execute = await app.inject({
      method: 'POST',
      url: '/api/modules/economic-reality/action/execute',
      headers: { 'x-session-id': sessionId },
      payload: {
        actionId,
        deterministicHash: projected.meta.deterministicHash,
      },
    });

    expect(execute.statusCode).toBe(200);
    expect((execute.json() as { accepted: boolean }).accepted).toBe(true);
  });

  it('rejects action IDs outside the current action set', async () => {
    const app = await buildApp({ logger: false });
    const sessionId = await createE2eSession(app);
    await seedE2eUserContext(sessionId, ECONOMIC_FIXTURES[2]!.userContext);

    const planResponse = await fetchE2eEconomicPlan(app, sessionId);
    expect(planResponse.statusCode).toBe(200);

    if (typeof planResponse.body !== 'object' || planResponse.body === null || !('meta' in planResponse.body)) {
      throw new Error('Expected plan body');
    }

    const execute = await app.inject({
      method: 'POST',
      url: '/api/modules/economic-reality/action/execute',
      headers: { 'x-session-id': sessionId },
      payload: {
        actionId: 'forbidden-action-id',
        deterministicHash: planResponse.body.meta.deterministicHash,
      },
    });

    expect(execute.statusCode).toBeGreaterThanOrEqual(400);
  });
});
