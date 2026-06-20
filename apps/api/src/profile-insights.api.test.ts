import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './build-app.js';
import { resetTestStateStore, setupTestStateStore, teardownTestStateStore } from './test-state.js';

async function createSession(app: Awaited<ReturnType<typeof buildApp>>): Promise<string> {
  const sessionRes = await app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: { context: { userProfile: { language: 'en' } } },
  });
  return (sessionRes.json() as { sessionId: string }).sessionId;
}

describe('GET /api/profile-insights', () => {
  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
  });

  afterEach(() => {
    teardownTestStateStore();
  });

  it('returns derived ProfileInsightViewV1 with authority headers', async () => {
    const app = await buildApp();
    const sessionId = await createSession(app);

    const response = await app.inject({
      method: 'GET',
      url: '/api/profile-insights',
      headers: { 'x-session-id': sessionId },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-profile-insights-authority']).toBe('derived-non-authoritative');
    expect(response.headers['x-read-model']).toBe('ProfileInsightViewV1');

    const body = response.json() as {
      schemaVersion: string;
      globalConfidence: string;
      domainInsights: unknown[];
      missingContext: unknown[];
      profileMutationEvents?: unknown;
      events?: unknown;
    };

    expect(body.schemaVersion).toBe('1.0.0');
    expect(body.domainInsights.length).toBe(7);
    expect(body.missingContext.length).toBeLessThanOrEqual(3);
    expect(body.profileMutationEvents).toBeUndefined();
    expect(body.events).toBeUndefined();
  });

  it('does not mutate state when called read-only', async () => {
    const app = await buildApp();
    const sessionId = await createSession(app);

    const before = await app.inject({
      method: 'GET',
      url: '/api/user-context',
      headers: { 'x-session-id': sessionId },
    });

    await app.inject({
      method: 'GET',
      url: '/api/profile-insights',
      headers: { 'x-session-id': sessionId },
    });

    const after = await app.inject({
      method: 'GET',
      url: '/api/user-context',
      headers: { 'x-session-id': sessionId },
    });

    expect(after.json()).toEqual(before.json());
  });
});
