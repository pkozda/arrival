import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scheduleIdForProfile } from '@arrival-atlas/discovery';
import { buildApp } from './build-app.js';
import { executeDiscoveryHostTick } from './discovery/discovery-host-tick.js';
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

const HEALTH_URL = '/api/ops/discovery/health';

describe('E11.1 Atlas discovery ops health', () => {
  const dirs: string[] = [];
  const OPS_TOKEN = 'test-arrival-ops-token-health';
  let previousOpsToken: string | undefined;

  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
    resetDiscoveryRuntimeForTests();
    resetDiscoveryExecutionForTests();
    process.env.DISCOVERY_USE_SMOKE_TRANSPORT = 'true';
    previousOpsToken = process.env.ARRIVAL_ATLAS_OPS_TOKEN;
    process.env.ARRIVAL_ATLAS_OPS_TOKEN = OPS_TOKEN;
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
    if (previousOpsToken === undefined) {
      delete process.env.ARRIVAL_ATLAS_OPS_TOKEN;
    } else {
      process.env.ARRIVAL_ATLAS_OPS_TOKEN = previousOpsToken;
    }
    teardownTestStateStore();
  });

  function isolateDiscoveryState() {
    const dir = mkdtempSync(path.join(tmpdir(), 'discovery-e111-'));
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
    const claimBody = claimRes.json() as { token?: string };
    return {
      sessionId,
      token: claimBody.token ?? initialToken ?? '',
    };
  }

  async function createDailyProfile(sessionId: string, profileId: string) {
    const userId = resolveDiscoveryUserId({ sessionId, accountId: null });
    await getDiscoveryUserService().createProfile(userId, {
      id: profileId,
      name: 'Daily Health',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      criteria: {
        required: [{ key: 'country', value: 'DE' }],
        preferred: [],
        excluded: [],
        flexible: [],
      },
      schedule: { cadence: 'daily', hourUtc: 9 },
      notification: { emailEnabled: true, skipEmptyDigest: true },
      enabled: true,
    });
  }

  async function markScheduleDue(profileId: string, nextRunAt: string) {
    const { getDiscoveryExecutionService } = await import(
      './discovery/discovery-execution-runtime.js'
    );
    const discoveryService = getDiscoveryExecutionService();
    await discoveryService.start();
    await discoveryService.registerSchedule({
      scheduleId: scheduleIdForProfile(profileId),
      profileId,
      strategyId: 'job-discovery',
      strategyVersion: '1',
      intervalSeconds: 86_400,
      nextRunAt,
      enabled: true,
    });
  }

  it('requires ops token; ordinary accounts are rejected', async () => {
    isolateDiscoveryState();
    const app = await buildApp({ logger: false });

    const unauthenticated = await app.inject({ method: 'GET', url: HEALTH_URL });
    expect(unauthenticated.statusCode).toBe(403);
    expect(unauthenticated.json()).toMatchObject({ code: 'OPS_FORBIDDEN' });

    const { sessionId } = await createSession(app);
    const sessionOnly = await app.inject({
      method: 'GET',
      url: HEALTH_URL,
      headers: { 'x-session-id': sessionId },
    });
    expect(sessionOnly.statusCode).toBe(403);

    const { sessionId: claimedSessionId, token } = await createClaimedSession(app);
    const ordinaryAccount = await app.inject({
      method: 'GET',
      url: HEALTH_URL,
      headers: {
        Authorization: `Bearer ${token}`,
        'x-session-id': claimedSessionId,
      },
    });
    expect(ordinaryAccount.statusCode).toBe(403);
    expect(ordinaryAccount.json()).toMatchObject({ code: 'OPS_FORBIDDEN' });

    const authorized = await app.inject({
      method: 'GET',
      url: HEALTH_URL,
      headers: {
        Authorization: `Bearer ${OPS_TOKEN}`,
      },
    });
    expect(authorized.statusCode).toBe(200);

    await app.close();
  });

  it('returns operational health fields for authorized ops caller', async () => {
    isolateDiscoveryState();
    const app = await buildApp({ logger: false });

    const res = await app.inject({
      method: 'GET',
      url: HEALTH_URL,
      headers: {
        Authorization: `Bearer ${OPS_TOKEN}`,
      },
    });
    expect(res.statusCode).toBe(200);

    const body = res.json() as {
      status: string;
      queue: { queuedCount: number };
      recentRuns: unknown[];
      warnings: unknown[];
      runtimeOpen: boolean;
      canAcceptWork: boolean;
    };

    expect(['HEALTHY', 'DEGRADED', 'UNAVAILABLE']).toContain(body.status);
    expect(typeof body.queue.queuedCount).toBe('number');
    expect(Array.isArray(body.recentRuns)).toBe(true);
    expect(Array.isArray(body.warnings)).toBe(true);
    expect(body.runtimeOpen).toBe(true);
    expect(body.canAcceptWork).toBe(true);

    await app.close();
  });

  it('reflects runtime state after a processed host tick', async () => {
    isolateDiscoveryState();
    const app = await buildApp({ logger: false });
    const { sessionId } = await createSession(app);
    await createDailyProfile(sessionId, 'profile-health-run');
    await markScheduleDue('profile-health-run', '2026-09-01T08:00:00.000Z');

    await executeDiscoveryHostTick();

    const res = await app.inject({
      method: 'GET',
      url: HEALTH_URL,
      headers: {
        Authorization: `Bearer ${OPS_TOKEN}`,
      },
    });
    expect(res.statusCode).toBe(200);

    const body = res.json() as {
      recentRuns: Array<{ profileId: string; status: string }>;
    };
    expect(body.recentRuns.length).toBeGreaterThan(0);
    expect(body.recentRuns.some((r) => r.profileId === 'profile-health-run')).toBe(true);
    expect(body.recentRuns.some((r) => r.status === 'SUCCESS')).toBe(true);

    await app.close();
  });

  it('does not expose secrets or sensitive fields in the HTTP payload', async () => {
    isolateDiscoveryState();
    const app = await buildApp({ logger: false });

    const res = await app.inject({
      method: 'GET',
      url: HEALTH_URL,
      headers: {
        Authorization: `Bearer ${OPS_TOKEN}`,
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
    expect(body).not.toHaveProperty('databasePath');
    expect(body).not.toHaveProperty('secrets');
    expect(body).not.toHaveProperty('apiKey');

    await app.close();
  });
});
