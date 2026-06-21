import { expect } from 'vitest';
import type { UserContextV1 } from '@arrival-atlas/product-contract';
import { buildApp } from '../../../src/build-app.js';
import { validateEconomicRealityPlanResponse } from '../../../src/economic-reality-plan-validation.js';
import { getPersistedSystemStateStore } from '../../../src/state/persisted-system-state-store.js';
import { systemStateCoordinator } from '../../../src/state/system-state-coordinator.js';

export async function createE2eSession(
  app: Awaited<ReturnType<typeof buildApp>>
): Promise<string> {
  const sessionRes = await app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: { context: { userProfile: { language: 'en' } } },
  });

  expect(sessionRes.statusCode).toBe(200);
  return (sessionRes.json() as { sessionId: string }).sessionId;
}

export async function seedE2eUserContext(
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

export async function fetchE2eEconomicPlan(
  app: Awaited<ReturnType<typeof buildApp>>,
  sessionId: string
) {
  const response = await app.inject({
    method: 'GET',
    url: '/api/modules/economic-reality/plan',
    headers: { 'x-session-id': sessionId },
  });

  return {
    statusCode: response.statusCode,
    headers: response.headers,
    body: response.statusCode === 200 ? validateEconomicRealityPlanResponse(response.json()) : response.json(),
  };
}

export async function fetchE2eLifeEventPlan(
  app: Awaited<ReturnType<typeof buildApp>>,
  sessionId: string
) {
  const response = await app.inject({
    method: 'GET',
    url: '/api/modules/life-event/plan',
    headers: { 'x-session-id': sessionId },
  });

  return {
    statusCode: response.statusCode,
    body: response.json(),
  };
}
