import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ECONOMIC_FIXTURES } from '@arrival-atlas/modules/economic-reality';
import { buildApp } from './build-app.js';
import { buildEconomicRealityPlanFromState } from './state/economic-reality-plan-projection.js';
import {
  resetTestStateStore,
  setupTestStateStore,
  teardownTestStateStore,
} from './test-state.js';
import { getPersistedSystemStateStore } from './state/persisted-system-state-store.js';
import { systemStateCoordinator } from './state/system-state-coordinator.js';
import type { UserContextV1 } from '@arrival-atlas/product-contract';

async function createSession(app: Awaited<ReturnType<typeof buildApp>>): Promise<string> {
  const sessionRes = await app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: { context: { userProfile: { language: 'en' } } },
  });
  return (sessionRes.json() as { sessionId: string }).sessionId;
}

async function seedSessionUserContext(
  sessionId: string,
  userContext: UserContextV1
): Promise<void> {
  const state = await systemStateCoordinator.getState(sessionId);
  if (!state) {
    throw new Error(`Session ${sessionId} not found`);
  }

  const store = getPersistedSystemStateStore();
  await store.save({ ...state, userContext });
  systemStateCoordinator.resetCache();
}

describe('POST /api/modules/economic-reality/action/execute', () => {
  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
  });

  afterEach(() => {
    teardownTestStateStore();
  });

  it('accepts actions from the current deterministic action set', async () => {
    const app = await buildApp();
    const sessionId = await createSession(app);
    await seedSessionUserContext(sessionId, ECONOMIC_FIXTURES[2]!.userContext);

    const state = await systemStateCoordinator.getState(sessionId);
    const plan = buildEconomicRealityPlanFromState(state!, 'req-action');
    const actionId = plan.actionSet.actions[0]!.id;

    const response = await app.inject({
      method: 'POST',
      url: '/api/modules/economic-reality/action/execute',
      headers: { 'x-session-id': sessionId },
      payload: {
        actionId,
        deterministicHash: plan.meta.deterministicHash,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      accepted: boolean;
      actionId: string;
      previousDeterministicHash: string;
      deterministicHash: string;
      planChanged: boolean;
    };
    expect(body.accepted).toBe(true);
    expect(body.actionId).toBe(actionId);
    expect(body.previousDeterministicHash).toBe(plan.meta.deterministicHash);
    expect(body.deterministicHash).toBeTypeOf('string');

    const updatedState = await systemStateCoordinator.getState(sessionId);
    expect(updatedState?.economicRealityEvents).toHaveLength(1);
    expect(updatedState?.economicRealityEvents[0]?.actionId).toBe(actionId);
    expect(updatedState?.userContext).toEqual(state!.userContext);
  });

  it('returns E_STALE_ACTION_SET when deterministicHash mismatches', async () => {
    const app = await buildApp();
    const sessionId = await createSession(app);
    await seedSessionUserContext(sessionId, ECONOMIC_FIXTURES[2]!.userContext);

    const plan = buildEconomicRealityPlanFromState(
      (await systemStateCoordinator.getState(sessionId))!,
      'req-action'
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/modules/economic-reality/action/execute',
      headers: { 'x-session-id': sessionId },
      payload: {
        actionId: plan.actionSet.actions[0]!.id,
        deterministicHash: 'stale-hash',
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: 'E_STALE_ACTION_SET' });
  });
});
