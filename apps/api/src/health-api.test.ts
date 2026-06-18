import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './build-app.js';
import { resetObservabilityStateForTests } from './observability-runtime.js';
import {
  resetTestStateStore,
  setupTestStateStore,
  teardownTestStateStore,
} from './test-state.js';

describe('health API endpoints', () => {
  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
    resetObservabilityStateForTests();
  });

  afterEach(() => {
    teardownTestStateStore();
    resetObservabilityStateForTests();
  });

  async function createClaimedSession(app: Awaited<ReturnType<typeof buildApp>>) {
    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { context: { userProfile: { language: 'en' } } },
    });
    const { sessionId, token } = sessionRes.json() as { sessionId: string; token?: string };

    const claimRes = await app.inject({
      method: 'POST',
      url: '/api/account/claim',
      headers: {
        'x-session-id': sessionId,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    expect(claimRes.statusCode).toBe(200);
    const claimBody = claimRes.json() as { token?: string };

    return {
      sessionId,
      token: claimBody.token ?? token ?? '',
    };
  }

  it('returns governance health for ops account sessions', async () => {
    const app = await buildApp();
    const { sessionId, token } = await createClaimedSession(app);

    const res = await app.inject({
      method: 'GET',
      url: '/api/health/governance',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-session-id': sessionId,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      healthy: boolean;
      registryFrozen: boolean;
      registeredModules: number;
      contractSnapshots: number;
      governanceVersion: string;
      moduleResult?: unknown;
      contracts?: unknown;
    };

    expect(body.healthy).toBe(true);
    expect(body.registryFrozen).toBe(true);
    expect(body.registeredModules).toBe(6);
    expect(body.contractSnapshots).toBe(6);
    expect(body.governanceVersion).toBe('1.0');
    expect(body.moduleResult).toBeUndefined();
    expect(body.contracts).toBeUndefined();
  });

  it('returns module health summary for ops account sessions', async () => {
    const app = await buildApp();
    const { sessionId, token } = await createClaimedSession(app);

    const res = await app.inject({
      method: 'GET',
      url: '/api/health/modules',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-session-id': sessionId,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      totalModules: number;
      modules: Array<{ moduleId: string; version: string; status: string }>;
    };

    expect(body.totalModules).toBe(6);
    expect(body.modules.every((module) => module.status === 'healthy')).toBe(true);
  });

  it('rejects unauthenticated health access', async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: 'GET',
      url: '/api/health/governance',
    });

    expect(res.statusCode).toBe(401);
  });
});
