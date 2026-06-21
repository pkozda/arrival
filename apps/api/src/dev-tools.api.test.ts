import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { buildApp } from './build-app.js';
import { setupTestStateStore, teardownTestStateStore } from './test-state.js';

describe('dev tools routes', () => {
  beforeEach(() => {
    setupTestStateStore();
  });

  afterEach(() => {
    teardownTestStateStore();
  });

  async function createSession(app: Awaited<ReturnType<typeof buildApp>>) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: {
        context: {
          userProfile: {
            language: 'en',
          },
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { sessionId: string; token: string };
    return body;
  }

  it('POST /api/dev/reset-user-data deletes current session state', async () => {
    const app = await buildApp({ logger: false });
    const { sessionId, token } = await createSession(app);

    const createProfileRes = await app.inject({
      method: 'POST',
      url: '/api/profile',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: { preferredLanguage: 'de' },
    });
    expect(createProfileRes.statusCode).toBe(201);

    const beforeProfile = await app.inject({
      method: 'GET',
      url: '/api/profile',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect(beforeProfile.statusCode).toBe(200);

    const resetRes = await app.inject({
      method: 'POST',
      url: '/api/dev/reset-user-data',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(resetRes.statusCode).toBe(200);
    expect(resetRes.json()).toEqual({
      scope: 'session',
      sessionId,
      deleted: true,
    });

    const afterProfile = await app.inject({
      method: 'GET',
      url: '/api/profile',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect(afterProfile.statusCode).toBe(404);
  });

  it('POST /api/dev/reset-all-state clears persisted store', async () => {
    const app = await buildApp({ logger: false });
    const first = await createSession(app);
    const second = await createSession(app);

    const resetRes = await app.inject({
      method: 'POST',
      url: '/api/dev/reset-all-state',
      headers: {
        authorization: `Bearer ${second.token}`,
      },
    });

    expect(resetRes.statusCode).toBe(200);
    expect(resetRes.json()).toEqual({
      scope: 'all',
      cleared: true,
    });

    const firstSession = await app.inject({
      method: 'GET',
      url: `/api/sessions/${first.sessionId}`,
      headers: {
        authorization: `Bearer ${first.token}`,
      },
    });
    expect(firstSession.statusCode).toBe(404);

    const secondSession = await app.inject({
      method: 'GET',
      url: `/api/sessions/${second.sessionId}`,
      headers: {
        authorization: `Bearer ${second.token}`,
      },
    });
    expect(secondSession.statusCode).toBe(404);
  });
});
