import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './build-app.js';
import {
  resetDiscoveryExecutionForTests,
} from './discovery/discovery-execution-runtime.js';
import { resetDiscoveryRuntimeForTests } from './discovery/discovery-user-runtime.js';

describe('Discovery user API (E9.2 gateway)', () => {
  const dirs: string[] = [];

  beforeEach(() => {
    process.env.DISCOVERY_USE_SMOKE_TRANSPORT = 'true';
    resetDiscoveryRuntimeForTests();
    resetDiscoveryExecutionForTests();
  });

  afterEach(() => {
    for (const dir of dirs) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
    delete process.env.DISCOVERY_USE_SMOKE_TRANSPORT;
  });

  async function startApp() {
    const dir = mkdtempSync(path.join(tmpdir(), 'discovery-api-'));
    dirs.push(dir);
    process.env.ARRIVAL_ATLAS_STATE_DIR = dir;
    const app = await buildApp({ logger: false });
    return app;
  }

  it('lists profiles for an authenticated session', async () => {
    const app = await startApp();

    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { context: { userProfile: { language: 'en' } } },
    });
    expect(sessionRes.statusCode).toBe(200);
    const { sessionId } = sessionRes.json() as { sessionId: string };

    const seedRes = await app.inject({
      method: 'POST',
      url: '/api/dev/discovery/seed-fixture',
      headers: { 'x-session-id': sessionId },
    });
    expect(seedRes.statusCode).toBe(200);

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/modules/discovery/profiles',
      headers: { 'x-session-id': sessionId },
    });
    expect(listRes.statusCode).toBe(200);
    const body = listRes.json() as { profiles: Array<{ id: string }> };
    expect(body.profiles.some((p) => p.id === 'profile-e2e-jobs')).toBe(true);

    await app.close();
  });

  it('run-now requires authentication', async () => {
    const app = await startApp();

    const res = await app.inject({
      method: 'POST',
      url: '/api/modules/discovery/profiles/profile-e2e-jobs/run-now',
    });
    expect(res.statusCode).toBe(401);

    await app.close();
  });

  it('run-now executes smoke discovery for owned profile', async () => {
    const app = await startApp();

    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { context: { userProfile: { language: 'en' } } },
    });
    const { sessionId } = sessionRes.json() as { sessionId: string };

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/modules/discovery/profiles',
      headers: { 'x-session-id': sessionId },
      payload: {
        id: 'profile-api-run-now',
        name: 'API Run Now Jobs',
        strategyId: 'job-discovery',
        strategyVersion: '1',
        criteria: {
          required: [{ key: 'country', value: 'DE' }],
          preferred: [{ key: 'role', value: 'Frontend Engineer' }],
          excluded: [],
          flexible: [],
        },
        schedule: { cadence: 'manual' },
        notification: { emailEnabled: true, skipEmptyDigest: true },
        enabled: true,
      },
    });
    expect(createRes.statusCode).toBe(201);

    const runRes = await app.inject({
      method: 'POST',
      url: '/api/modules/discovery/profiles/profile-api-run-now/run-now',
      headers: { 'x-session-id': sessionId },
    });
    expect(runRes.statusCode).toBe(202);
    const runBody = runRes.json() as { status: string };
    expect(['success', 'partial_success']).toContain(runBody.status);

    const resultsRes = await app.inject({
      method: 'GET',
      url: '/api/modules/discovery/profiles/profile-api-run-now/results',
      headers: { 'x-session-id': sessionId },
    });
    expect(resultsRes.statusCode).toBe(200);
    const results = (resultsRes.json() as { results: unknown[] }).results;
    expect(results.length).toBeGreaterThan(0);

    await app.close();
  });

  it('exposes emailRecipientConfigured without revealing the address', async () => {
    const previous = process.env.DISCOVERY_NOTIFICATION_EMAIL;
    delete process.env.DISCOVERY_NOTIFICATION_EMAIL;

    const app = await startApp();
    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { context: { userProfile: { language: 'en' } } },
    });
    const { sessionId } = sessionRes.json() as { sessionId: string };

    await app.inject({
      method: 'POST',
      url: '/api/dev/discovery/seed-fixture',
      headers: { 'x-session-id': sessionId },
    });

    const unsetRes = await app.inject({
      method: 'GET',
      url: '/api/modules/discovery/profiles',
      headers: { 'x-session-id': sessionId },
    });
    expect(unsetRes.statusCode).toBe(200);
    const unsetBody = unsetRes.json() as {
      profiles: unknown[];
      emailRecipientConfigured: boolean;
    };
    expect(unsetBody.emailRecipientConfigured).toBe(false);
    expect(JSON.stringify(unsetBody)).not.toMatch(/DISCOVERY_NOTIFICATION_EMAIL/);

    process.env.DISCOVERY_NOTIFICATION_EMAIL = 'ops@example.com';
    const setRes = await app.inject({
      method: 'GET',
      url: '/api/modules/discovery/profiles',
      headers: { 'x-session-id': sessionId },
    });
    const setBody = setRes.json() as { emailRecipientConfigured: boolean };
    expect(setBody.emailRecipientConfigured).toBe(true);
    expect(JSON.stringify(setBody)).not.toContain('ops@example.com');

    await app.close();
    if (previous === undefined) {
      delete process.env.DISCOVERY_NOTIFICATION_EMAIL;
    } else {
      process.env.DISCOVERY_NOTIFICATION_EMAIL = previous;
    }
  });
});
