import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './build-app.js';
import { resetDiscoveryExecutionForTests } from './discovery/discovery-execution-runtime.js';
import {
  getDiscoveryUserService,
  resetDiscoveryRuntimeForTests,
  resolveDiscoveryUserId,
} from './discovery/discovery-user-runtime.js';
import {
  resetTestStateStore,
  setupTestStateStore,
  teardownTestStateStore,
} from './test-state.js';

function diagnosticsUrl(runId: string) {
  return `/api/ops/discovery/runs/${encodeURIComponent(runId)}/diagnostics`;
}

describe('E11.2 Atlas discovery run diagnostics', () => {
  const dirs: string[] = [];

  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
    resetDiscoveryRuntimeForTests();
    resetDiscoveryExecutionForTests();
    process.env.DISCOVERY_USE_SMOKE_TRANSPORT = 'true';
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
    teardownTestStateStore();
  });

  function isolateDiscoveryState() {
    const dir = mkdtempSync(path.join(tmpdir(), 'discovery-e112-'));
    dirs.push(dir);
    process.env.ARRIVAL_ATLAS_STATE_DIR = dir;
    resetDiscoveryRuntimeForTests();
    resetDiscoveryExecutionForTests();
    return dir;
  }

  async function createSession(app: Awaited<ReturnType<typeof buildApp>>) {
    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { context: { userProfile: { language: 'en' } } },
    });
    expect(sessionRes.statusCode).toBe(200);
    return sessionRes.json() as { sessionId: string; token?: string };
  }

  async function createClaimedSession(app: Awaited<ReturnType<typeof buildApp>>) {
    const { sessionId, token: initialToken } = await createSession(app);
    const claimRes = await app.inject({
      method: 'POST',
      url: '/api/account/claim',
      headers: {
        'x-session-id': sessionId,
        ...(initialToken ? { Authorization: `Bearer ${initialToken}` } : {}),
      },
    });
    expect(claimRes.statusCode).toBe(200);
    const claimBody = claimRes.json() as { token?: string; accountId?: string };
    return {
      sessionId,
      accountId: claimBody.accountId ?? null,
      token: claimBody.token ?? initialToken ?? '',
    };
  }

  async function createProfile(
    sessionId: string,
    profileId: string,
    accountId: string | null = null
  ) {
    const userId = resolveDiscoveryUserId({ sessionId, accountId });
    await getDiscoveryUserService().createProfile(userId, {
      id: profileId,
      name: 'Diagnostics Profile',
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
    });
  }

  async function runProfile(
    sessionId: string,
    profileId: string,
    accountId: string | null = null
  ) {
    const userId = resolveDiscoveryUserId({ sessionId, accountId });
    return getDiscoveryUserService().runProfileNow(userId, profileId);
  }

  it('requires authentication', async () => {
    isolateDiscoveryState();
    const app = await buildApp({ logger: false });

    const unauthenticated = await app.inject({
      method: 'GET',
      url: diagnosticsUrl('run-missing'),
    });
    expect(unauthenticated.statusCode).toBe(401);

    const { sessionId } = await createSession(app);
    const sessionOnly = await app.inject({
      method: 'GET',
      url: diagnosticsUrl('run-missing'),
      headers: { 'x-session-id': sessionId },
    });
    expect(sessionOnly.statusCode).toBe(403);

    const { sessionId: claimedSessionId, token } = await createClaimedSession(app);
    const authorized = await app.inject({
      method: 'GET',
      url: diagnosticsUrl('run-missing'),
      headers: {
        Authorization: `Bearer ${token}`,
        'x-session-id': claimedSessionId,
      },
    });
    expect(authorized.statusCode).toBe(404);

    await app.close();
  });

  it('returns 404 for unknown run and other users run', async () => {
    isolateDiscoveryState();
    const app = await buildApp({ logger: false });
    const owner = await createClaimedSession(app);
    const other = await createClaimedSession(app);

    await createProfile(owner.sessionId, 'profile-owner', owner.accountId);
    const outcome = await runProfile(owner.sessionId, 'profile-owner', owner.accountId);
    expect(outcome.runId).toBeTruthy();

    const unknown = await app.inject({
      method: 'GET',
      url: diagnosticsUrl('run-does-not-exist'),
      headers: {
        Authorization: `Bearer ${other.token}`,
        'x-session-id': other.sessionId,
      },
    });
    expect(unknown.statusCode).toBe(404);

    const foreign = await app.inject({
      method: 'GET',
      url: diagnosticsUrl(outcome.runId!),
      headers: {
        Authorization: `Bearer ${other.token}`,
        'x-session-id': other.sessionId,
      },
    });
    expect(foreign.statusCode).toBe(404);

    await app.close();
  });

  it('returns durable diagnostics for an owned run', async () => {
    isolateDiscoveryState();
    const app = await buildApp({ logger: false });
    const { sessionId, token, accountId } = await createClaimedSession(app);
    await createProfile(sessionId, 'profile-diagnostics', accountId);
    const outcome = await runProfile(sessionId, 'profile-diagnostics', accountId);
    expect(outcome.runId).toBeTruthy();

    const res = await app.inject({
      method: 'GET',
      url: diagnosticsUrl(outcome.runId!),
      headers: {
        Authorization: `Bearer ${token}`,
        'x-session-id': sessionId,
      },
    });
    expect(res.statusCode).toBe(200);

    const body = res.json() as {
      runId: string;
      profileId: string;
      status: string;
      startedAt: string;
      trigger?: string;
      summary?: { newResults?: number; updatedResults?: number };
      ai?: { maxEvaluations?: number };
      notification?: { status?: string };
      error?: { message?: string };
    };

    expect(body.runId).toBe(outcome.runId);
    expect(body.profileId).toBe('profile-diagnostics');
    expect(body.startedAt).toBeTruthy();
    expect(body.trigger).toBe('manual');
    expect(['SUCCESS', 'PARTIAL_SUCCESS', 'RUNNING', 'PENDING', 'FAILED']).toContain(
      body.status
    );
    if (body.summary) {
      expect(typeof body.summary.newResults === 'number' || body.summary.updatedResults !== undefined).toBe(true);
    }
    expect(body.ai?.maxEvaluations).toBe(100);

    await app.close();
  });

  it('does not expose secrets or sensitive fields in the HTTP payload', async () => {
    isolateDiscoveryState();
    const app = await buildApp({ logger: false });
    const { sessionId, token, accountId } = await createClaimedSession(app);
    await createProfile(sessionId, 'profile-redact', accountId);
    const outcome = await runProfile(sessionId, 'profile-redact', accountId);
    expect(outcome.runId).toBeTruthy();

    const res = await app.inject({
      method: 'GET',
      url: diagnosticsUrl(outcome.runId!),
      headers: {
        Authorization: `Bearer ${token}`,
        'x-session-id': sessionId,
      },
    });
    expect(res.statusCode).toBe(200);

    const raw = res.body;
    expect(raw).not.toMatch(/api[_-]?key/i);
    expect(raw).not.toMatch(/authorization/i);
    expect(raw).not.toMatch(/bearer\s+/i);
    expect(raw).not.toMatch(/@/);
    expect(raw).not.toMatch(/discovery\.sqlite/);
    expect(raw).not.toMatch(/stack/i);

    const body = res.json() as Record<string, unknown>;
    expect(body).not.toHaveProperty('recipient');
    expect(body).not.toHaveProperty('payload');
    expect(body).not.toHaveProperty('secrets');

    await app.close();
  });
});
