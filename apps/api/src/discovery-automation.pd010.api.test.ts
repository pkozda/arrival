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

const PD010_STATE_DIR = `${process.cwd()}/.arrival-atlas-state-pd010-test`;

describe('PD-010 Discovery automation API', () => {
  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
    rmSync(PD010_STATE_DIR, { recursive: true, force: true });
    process.env.ARRIVAL_ATLAS_STATE_DIR = PD010_STATE_DIR;
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

  it('A/B/C/D — enable/disable daily automation persists with nextRunAt', async () => {
    const app = await buildApp();
    const session = await createSession(app);
    const id = `pd010-sched-${Date.now()}`;
    const headers = { 'x-session-id': session.sessionId };

    const created = await app.inject({
      method: 'POST',
      url: '/api/modules/discovery/profiles',
      headers,
      payload: jobsCreatePayload(id, 'PD010 Sched'),
    });
    expect(created.statusCode).toBe(201);

    const enabled = await app.inject({
      method: 'PATCH',
      url: `/api/modules/discovery/profiles/${id}`,
      headers,
      payload: { schedule: { cadence: 'daily', hourUtc: 6 } },
    });
    expect(enabled.statusCode).toBe(200);
    expect(enabled.json()).toMatchObject({
      profile: { schedule: { cadence: 'daily', hourUtc: 6 } },
    });

    const summaryOn = await app.inject({
      method: 'GET',
      url: `/api/modules/discovery/profiles/${id}/run-summary`,
      headers,
    });
    expect(summaryOn.statusCode).toBe(200);
    const bodyOn = summaryOn.json() as {
      automation: {
        automaticExecution: boolean;
        cadence: string;
        nextRunAt: string | null;
        delivery: { emailEnabled: boolean; skipEmptyDigest: boolean };
      };
    };
    expect(bodyOn.automation.cadence).toBe('daily');
    expect(bodyOn.automation.automaticExecution).toBe(true);
    expect(bodyOn.automation.nextRunAt).toBeTruthy();
    expect(bodyOn.automation.delivery.skipEmptyDigest).toBe(true);

    const reloaded = await app.inject({
      method: 'GET',
      url: `/api/modules/discovery/profiles/${id}`,
      headers,
    });
    expect(reloaded.json()).toMatchObject({
      profile: { schedule: { cadence: 'daily', hourUtc: 6 } },
    });

    const disabled = await app.inject({
      method: 'PATCH',
      url: `/api/modules/discovery/profiles/${id}`,
      headers,
      payload: { schedule: { cadence: 'manual' } },
    });
    expect(disabled.statusCode).toBe(200);

    const summaryOff = await app.inject({
      method: 'GET',
      url: `/api/modules/discovery/profiles/${id}/run-summary`,
      headers,
    });
    expect(summaryOff.json()).toMatchObject({
      automation: {
        cadence: 'manual',
        automaticExecution: false,
        nextRunAt: null,
      },
    });
  });

  it('G — manual Run Now remains available with automation off', async () => {
    const app = await buildApp();
    const session = await createSession(app);
    const id = `pd010-run-${Date.now()}`;
    const headers = { 'x-session-id': session.sessionId };
    await app.inject({
      method: 'POST',
      url: '/api/modules/discovery/profiles',
      headers,
      payload: jobsCreatePayload(id, 'PD010 Run'),
    });

    const run = await app.inject({
      method: 'POST',
      url: `/api/modules/discovery/profiles/${id}/run-now`,
      headers,
    });
    expect([200, 202]).toContain(run.statusCode);
    const body = run.json() as { lifecycle?: string; status?: string };
    expect(body.lifecycle || body.status).toBeTruthy();
  });

  it('P — delivery preference persists independently', async () => {
    const app = await buildApp();
    const session = await createSession(app);
    const id = `pd010-deliv-${Date.now()}`;
    const headers = { 'x-session-id': session.sessionId };
    await app.inject({
      method: 'POST',
      url: '/api/modules/discovery/profiles',
      headers,
      payload: {
        ...jobsCreatePayload(id, 'PD010 Delivery'),
        schedule: { cadence: 'daily', hourUtc: 8 },
      },
    });

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/modules/discovery/profiles/${id}`,
      headers,
      payload: { notification: { emailEnabled: false, skipEmptyDigest: true } },
    });
    expect(patched.statusCode).toBe(200);

    const summary = await app.inject({
      method: 'GET',
      url: `/api/modules/discovery/profiles/${id}/run-summary`,
      headers,
    });
    expect(summary.json()).toMatchObject({
      automation: {
        automaticExecution: true,
        delivery: { emailEnabled: false, skipEmptyDigest: true },
      },
    });
  });

  it('R — foreign session cannot enable automation', async () => {
    const app = await buildApp();
    const owner = await createSession(app);
    const stranger = await createSession(app);
    const id = `pd010-own-${Date.now()}`;
    await app.inject({
      method: 'POST',
      url: '/api/modules/discovery/profiles',
      headers: { 'x-session-id': owner.sessionId },
      payload: jobsCreatePayload(id, 'Owned'),
    });

    const denied = await app.inject({
      method: 'PATCH',
      url: `/api/modules/discovery/profiles/${id}`,
      headers: { 'x-session-id': stranger.sessionId },
      payload: { schedule: { cadence: 'daily', hourUtc: 6 } },
    });
    expect(denied.statusCode).toBe(404);
  });

  it('S — session-scoped profiles can set schedule but remain session-owned', async () => {
    const app = await buildApp();
    const session = await createSession(app);
    const id = `pd010-sess-${Date.now()}`;
    const headers = { 'x-session-id': session.sessionId };
    const created = await app.inject({
      method: 'POST',
      url: '/api/modules/discovery/profiles',
      headers,
      payload: {
        ...jobsCreatePayload(id, 'Session auto'),
        schedule: { cadence: 'daily', hourUtc: 6 },
      },
    });
    expect(created.statusCode).toBe(201);
    const body = created.json() as { profile: { userId: string } };
    expect(body.profile.userId).toBe(session.sessionId);

    const summary = await app.inject({
      method: 'GET',
      url: `/api/modules/discovery/profiles/${id}/run-summary`,
      headers,
    });
    expect(summary.json()).toMatchObject({
      automation: { automaticExecution: true, cadence: 'daily' },
    });
  });
});
