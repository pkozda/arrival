import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CLASSIFIER_FIXTURES } from '@arrival-atlas/modules/life-event';
import type { UserContextV1 } from '@arrival-atlas/product-contract';
import { parseLifeEventPlanV1 } from '@arrival-atlas/product-contract';
import { buildApp } from './build-app.js';
import { buildLifeEventPlanFromState } from './state/life-event-plan-projection.js';
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

describe('GET /api/modules/life-event/plan', () => {
  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
  });

  afterEach(() => {
    teardownTestStateStore();
  });

  it('returns LifeEventPlanV1 with contract authority headers', async () => {
    const app = await buildApp();
    const sessionId = await createSession(app);
    await seedSessionUserContext(sessionId, CLASSIFIER_FIXTURES[0]!.userContext);

    const response = await app.inject({
      method: 'GET',
      url: '/api/modules/life-event/plan',
      headers: { 'x-session-id': sessionId },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-module-id']).toBe('life-event');
    expect(response.headers['x-module-version']).toBe('v2');
    expect(response.headers['x-read-model']).toBe('LifeEventPlanV1');
    expect(response.headers['x-plan-authority']).toBe('derived-deterministic');

    const body = parseLifeEventPlanV1(response.json());
    expect(body.moduleId).toBe('life-event');
    expect(body.currentFocus).toBeDefined();
    expect(body.reasoning.whyThisNow.length).toBeGreaterThan(0);
    expect(Array.isArray(body.reasoning.whatIsBlocking)).toBe(true);
    expect(body.reasoning.planConfidence).toBeDefined();
  });

  it('returns 400 when UserContext profile is missing', async () => {
    const app = await buildApp();
    const sessionId = await createSession(app);

    const response = await app.inject({
      method: 'GET',
      url: '/api/modules/life-event/plan',
      headers: { 'x-session-id': sessionId },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'UserContext profile required for life event planning',
    });
  });

  it('is deterministic for identical session state', async () => {
    const app = await buildApp();
    const sessionId = await createSession(app);
    await seedSessionUserContext(sessionId, CLASSIFIER_FIXTURES[1]!.userContext);

    const first = await app.inject({
      method: 'GET',
      url: '/api/modules/life-event/plan',
      headers: { 'x-session-id': sessionId },
    });
    const second = await app.inject({
      method: 'GET',
      url: '/api/modules/life-event/plan',
      headers: { 'x-session-id': sessionId },
    });

    expect(first.statusCode).toBe(200);
    expect(second.json()).toEqual(first.json());
  });

  it('does not mutate state when called read-only', async () => {
    const app = await buildApp();
    const sessionId = await createSession(app);
    await seedSessionUserContext(sessionId, CLASSIFIER_FIXTURES[2]!.userContext);

    const before = await app.inject({
      method: 'GET',
      url: '/api/user-context',
      headers: { 'x-session-id': sessionId },
    });

    await app.inject({
      method: 'GET',
      url: '/api/modules/life-event/plan',
      headers: { 'x-session-id': sessionId },
    });

    const after = await app.inject({
      method: 'GET',
      url: '/api/user-context',
      headers: { 'x-session-id': sessionId },
    });

    expect(after.json()).toEqual(before.json());
  });

  describe('fixture parity F01–F24', () => {
    for (const fixture of CLASSIFIER_FIXTURES) {
      it(`${fixture.id} matches LE-1 buildLifeEventPlan output`, async () => {
        const app = await buildApp();
        const sessionId = await createSession(app);
        await seedSessionUserContext(sessionId, fixture.userContext);

        const response = await app.inject({
          method: 'GET',
          url: '/api/modules/life-event/plan',
          headers: { 'x-session-id': sessionId },
        });

        expect(response.statusCode).toBe(200);

        const state = await systemStateCoordinator.getState(sessionId);
        expect(state).not.toBeNull();

        const expected = buildLifeEventPlanFromState(state!);
        const actual = parseLifeEventPlanV1(response.json());

        expect(actual.currentLifeState).toBe(fixture.expectedPrimary);
        expect(actual).toEqual(expected);
      });
    }
  });
});
