import { rmSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './build-app.js';
import { resetDiscoveryRuntimeForTests } from './discovery/discovery-user-runtime.js';
import {
  resetTestStateStore,
  setupTestStateStore,
  teardownTestStateStore,
} from './test-state.js';

function jobsCreatePayload(id: string, name: string) {
  return {
    id,
    name,
    strategyId: 'job-discovery',
    strategyVersion: '1',
    criteria: {
      required: [{ key: 'country', value: 'DE' }],
      preferred: [{ key: 'role', value: 'Engineer' }],
      excluded: [],
      flexible: [],
    },
    schedule: { cadence: 'manual' },
    notification: { emailEnabled: true, skipEmptyDigest: true },
    enabled: true,
  };
}

const PD007_STATE_DIR = `${process.cwd()}/.arrival-atlas-state-pd007-test`;

describe('PD-007 Discovery execution lifecycle API', () => {
  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
    rmSync(PD007_STATE_DIR, { recursive: true, force: true });
    process.env.ARRIVAL_ATLAS_STATE_DIR = PD007_STATE_DIR;
    resetDiscoveryRuntimeForTests();
  });

  afterEach(() => {
    resetDiscoveryRuntimeForTests();
    teardownTestStateStore();
  });

  async function createSession(app: Awaited<ReturnType<typeof buildApp>>) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { context: { userProfile: { language: 'en' } } },
    });
    expect(res.statusCode).toBe(200);
    return res.json() as { sessionId: string; token?: string };
  }

  it('A/K — newly created profile run-summary is IDLE (create ≠ run)', async () => {
    const app = await buildApp();
    const session = await createSession(app);
    const id = `pd007-idle-${Date.now()}`;
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/modules/discovery/profiles',
      headers: { 'x-session-id': session.sessionId },
      payload: jobsCreatePayload(id, 'PD007 Idle'),
    });
    expect(createRes.statusCode).toBe(201);

    const summary = await app.inject({
      method: 'GET',
      url: `/api/modules/discovery/profiles/${id}/run-summary`,
      headers: { 'x-session-id': session.sessionId },
    });
    expect(summary.statusCode).toBe(200);
    expect(summary.json()).toMatchObject({
      profileId: id,
      lastRun: null,
      lifecycle: 'IDLE',
      applicableResultCount: 0,
    });
  });

  it('J — foreign session cannot read run-summary', async () => {
    const app = await buildApp();
    const owner = await createSession(app);
    const stranger = await createSession(app);
    const id = `pd007-owned-${Date.now()}`;
    const created = await app.inject({
      method: 'POST',
      url: '/api/modules/discovery/profiles',
      headers: { 'x-session-id': owner.sessionId },
      payload: jobsCreatePayload(id, 'Owned'),
    });
    expect(created.statusCode).toBe(201);

    const denied = await app.inject({
      method: 'GET',
      url: `/api/modules/discovery/profiles/${id}/run-summary`,
      headers: { 'x-session-id': stranger.sessionId },
    });
    expect(denied.statusCode).toBe(404);

    const deniedRun = await app.inject({
      method: 'POST',
      url: `/api/modules/discovery/profiles/${id}/run-now`,
      headers: { 'x-session-id': stranger.sessionId },
    });
    expect(deniedRun.statusCode).toBe(404);
  });

  it('precondition: disabled profile does not invent RUNNING', async () => {
    const app = await buildApp();
    const session = await createSession(app);
    const id = `pd007-disabled-${Date.now()}`;
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/modules/discovery/profiles',
      headers: { 'x-session-id': session.sessionId },
      payload: jobsCreatePayload(id, 'Disabled'),
    });
    expect(createRes.statusCode).toBe(201);
    const disableRes = await app.inject({
      method: 'POST',
      url: `/api/modules/discovery/profiles/${id}/disable`,
      headers: { 'x-session-id': session.sessionId },
    });
    expect(disableRes.statusCode).toBe(200);

    const run = await app.inject({
      method: 'POST',
      url: `/api/modules/discovery/profiles/${id}/run-now`,
      headers: { 'x-session-id': session.sessionId },
    });
    expect(run.statusCode).toBeGreaterThanOrEqual(400);
    const summary = await app.inject({
      method: 'GET',
      url: `/api/modules/discovery/profiles/${id}/run-summary`,
      headers: { 'x-session-id': session.sessionId },
    });
    expect(summary.statusCode).toBe(200);
    expect(summary.json()).toMatchObject({ lifecycle: 'IDLE' });
  });
});
