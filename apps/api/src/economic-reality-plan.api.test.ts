import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ECONOMIC_FIXTURES } from '@arrival-atlas/modules/economic-reality';
import type { UserContextV1 } from '@arrival-atlas/product-contract';
import { validateEconomicRealityPlanResponse } from './economic-reality-plan-validation.js';
import { buildApp } from './build-app.js';
import { buildEconomicRealityPlanFromState } from './state/economic-reality-plan-projection.js';
import { getPersistedSystemStateStore } from './state/persisted-system-state-store.js';
import { systemStateCoordinator } from './state/system-state-coordinator.js';
import {
  resetTestStateStore,
  setupTestStateStore,
  teardownTestStateStore,
} from './test-state.js';

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

describe('GET /api/modules/economic-reality/plan', () => {
  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
  });

  afterEach(() => {
    teardownTestStateStore();
  });

  it('returns EconomicRealityPlanResponseV1 with contract authority headers', async () => {
    const app = await buildApp();
    const sessionId = await createSession(app);
    await seedSessionUserContext(sessionId, ECONOMIC_FIXTURES[0]!.userContext);

    const response = await app.inject({
      method: 'GET',
      url: '/api/modules/economic-reality/plan',
      headers: { 'x-session-id': sessionId },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-module-id']).toBe('economic-reality');
    expect(response.headers['x-module-version']).toBe('v1');
    expect(response.headers['x-read-model']).toBe('EconomicRealityPlanResponseV1');
    expect(response.headers['x-plan-authority']).toBe('derived-deterministic');
    expect(response.headers['x-pipeline-version']).toBe('ep1-ep6-v1');

    const body = validateEconomicRealityPlanResponse(response.json());
    expect(body.version).toBe('1.0');
    expect(body.evaluation.economicState).toBe('self_sustained');
    expect(body.graph.graphId).toBe('G1');
    expect(body.actionSet.actions.length).toBeGreaterThan(0);
    const planActionCount =
      body.plan.primaryTrack.actions.length +
      (body.plan.secondaryTrack?.actions.length ?? 0) +
      body.plan.systemTrack.actions.length;
    expect(planActionCount).toBeGreaterThan(0);
    expect(body.presentation.sections.length).toBeGreaterThan(0);
    expect(body.meta.pipelineVersion).toBe('ep1-ep6-v1');
    expect(body.meta.deterministicHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns 400 when UserContext profile is missing', async () => {
    const app = await buildApp();
    const sessionId = await createSession(app);

    const response = await app.inject({
      method: 'GET',
      url: '/api/modules/economic-reality/plan',
      headers: { 'x-session-id': sessionId },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'UserContext profile required for economic reality planning',
      code: 'ECONOMIC_CONTEXT_INVALID',
    });
  });

  it('is deterministic for identical session state', async () => {
    const app = await buildApp();
    const sessionId = await createSession(app);
    await seedSessionUserContext(sessionId, ECONOMIC_FIXTURES[4]!.userContext);

    const first = await app.inject({
      method: 'GET',
      url: '/api/modules/economic-reality/plan',
      headers: { 'x-session-id': sessionId },
    });
    const second = await app.inject({
      method: 'GET',
      url: '/api/modules/economic-reality/plan',
      headers: { 'x-session-id': sessionId },
    });

    expect(first.statusCode).toBe(200);
    const firstBody = validateEconomicRealityPlanResponse(first.json());
    const secondBody = validateEconomicRealityPlanResponse(second.json());
    expect(secondBody.evaluation).toEqual(firstBody.evaluation);
    expect(secondBody.graph).toEqual(firstBody.graph);
    expect(secondBody.execution).toEqual(firstBody.execution);
    expect(secondBody.actionSet).toEqual(firstBody.actionSet);
    expect(secondBody.plan).toEqual(firstBody.plan);
    expect(secondBody.presentation).toEqual(firstBody.presentation);
    expect(secondBody.meta.deterministicHash).toBe(firstBody.meta.deterministicHash);
  });

  it('does not mutate state when called read-only', async () => {
    const app = await buildApp();
    const sessionId = await createSession(app);
    await seedSessionUserContext(sessionId, ECONOMIC_FIXTURES[2]!.userContext);

    const before = await app.inject({
      method: 'GET',
      url: '/api/user-context',
      headers: { 'x-session-id': sessionId },
    });

    await app.inject({
      method: 'GET',
      url: '/api/modules/economic-reality/plan',
      headers: { 'x-session-id': sessionId },
    });

    const after = await app.inject({
      method: 'GET',
      url: '/api/user-context',
      headers: { 'x-session-id': sessionId },
    });

    expect(after.json()).toEqual(before.json());
  });

  describe('fixture parity EF01–EF24', () => {
    for (const fixture of ECONOMIC_FIXTURES) {
      it(`${fixture.id} matches buildEconomicRealityPlanFromState output`, async () => {
        const app = await buildApp();
        const sessionId = await createSession(app);
        await seedSessionUserContext(sessionId, fixture.userContext);

        const response = await app.inject({
          method: 'GET',
          url: '/api/modules/economic-reality/plan',
          headers: { 'x-session-id': sessionId },
        });

        expect(response.statusCode).toBe(200);

        const state = await systemStateCoordinator.getState(sessionId);
        expect(state).not.toBeNull();

        const expected = buildEconomicRealityPlanFromState(state!, 'fixture-request');
        const actual = validateEconomicRealityPlanResponse(response.json());

        expect(actual.evaluation.economicState).toBe(fixture.expected.economicState);
        expect(actual.evaluation).toEqual(expected.evaluation);
        expect(actual.graph).toEqual(expected.graph);
        expect(actual.execution).toEqual(expected.execution);
        expect(actual.actionSet).toEqual(expected.actionSet);
        expect(actual.plan).toEqual(expected.plan);
        expect(actual.presentation).toEqual(expected.presentation);
        expect(actual.meta.deterministicHash).toBe(expected.meta.deterministicHash);
      });
    }
  });
});
