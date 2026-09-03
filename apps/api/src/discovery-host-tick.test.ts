import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createSqliteNotificationPersistence,
  notificationIdentityKey,
  scheduleIdForProfile,
} from '@arrival-atlas/discovery';
import { buildApp } from './build-app.js';
import { executeDiscoveryHostTick } from './discovery/discovery-host-tick.js';
import {
  resetDiscoveryExecutionForTests,
} from './discovery/discovery-execution-runtime.js';
import {
  clearDiscoveryNotificationEmailOverrides,
  setDiscoveryNotificationEmailForUser,
} from './discovery/resolve-discovery-notification-email.js';
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

describe('E10.3 Atlas discovery host tick', () => {
  const dirs: string[] = [];
  const OPS_TOKEN = 'test-arrival-ops-token-h3';
  let previousOpsToken: string | undefined;

  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
    resetDiscoveryRuntimeForTests();
    resetDiscoveryExecutionForTests();
    clearDiscoveryNotificationEmailOverrides();
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
    const dir = mkdtempSync(path.join(tmpdir(), 'discovery-e103-'));
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

  async function createDailyProfile(
    sessionId: string,
    profileId: string,
    hourUtc: number
  ) {
    const userId = resolveDiscoveryUserId({ sessionId, accountId: null });
    const userService = getDiscoveryUserService();
    await userService.createProfile(userId, {
      id: profileId,
      name: 'Daily Host Tick',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      criteria: {
        required: [{ key: 'country', value: 'DE' }],
        preferred: [{ key: 'role', value: 'Frontend Engineer' }],
        excluded: [],
        flexible: [],
      },
      schedule: { cadence: 'daily', hourUtc },
      notification: { emailEnabled: true, skipEmptyDigest: true },
      enabled: true,
    });
    return userId;
  }

  async function markScheduleDue(profileId: string, nextRunAt: string) {
    const { getDiscoveryExecutionService } = await import(
      './discovery/discovery-execution-runtime.js'
    );
    const discoveryService = getDiscoveryExecutionService();
    await discoveryService.start();
    const scheduleId = scheduleIdForProfile(profileId);
    await discoveryService.registerSchedule({
      scheduleId,
      profileId,
      strategyId: 'job-discovery',
      strategyVersion: '1',
      intervalSeconds: 86_400,
      nextRunAt,
      enabled: true,
    });
  }

  it('host tick triggers a due daily profile through scheduler + worker', async () => {
    isolateDiscoveryState();
    const app = await buildApp({ logger: false });
    const { sessionId } = await createSession(app);
    await createDailyProfile(sessionId, 'profile-due-daily', 9);
    await markScheduleDue('profile-due-daily', '2026-09-01T08:00:00.000Z');

    const tick = await executeDiscoveryHostTick();
    expect(tick.enqueued).toBe(1);
    expect(tick.processedJobs.some((j) => j.kind === 'processed')).toBe(true);
    expect(tick.outcomes[0]).toMatchObject({
      kind: 'enqueued',
      scheduleId: scheduleIdForProfile('profile-due-daily'),
    });

    await app.close();
  });

  it('manual profile is not triggered by host tick', async () => {
    isolateDiscoveryState();
    const app = await buildApp({ logger: false });
    const { sessionId } = await createSession(app);
    const userId = resolveDiscoveryUserId({ sessionId, accountId: null });
    await getDiscoveryUserService().createProfile(userId, {
      id: 'profile-manual-tick',
      name: 'Manual',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      criteria: {
        required: [{ key: 'country', value: 'DE' }],
        preferred: [],
        excluded: [],
        flexible: [],
      },
      schedule: { cadence: 'manual' },
      notification: { emailEnabled: true, skipEmptyDigest: true },
      enabled: true,
    });

    const tick = await executeDiscoveryHostTick();
    expect(
      tick.outcomes.some(
        (o) => 'scheduleId' in o && o.scheduleId === scheduleIdForProfile('profile-manual-tick')
      )
    ).toBe(false);
    expect(tick.enqueued).toBe(0);

    await app.close();
  });

  it('disabled daily profile is not enqueued', async () => {
    isolateDiscoveryState();
    const app = await buildApp({ logger: false });
    const { sessionId } = await createSession(app);
    const userId = resolveDiscoveryUserId({ sessionId, accountId: null });
    await getDiscoveryUserService().createProfile(userId, {
      id: 'profile-disabled-tick',
      name: 'Disabled Daily',
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
      enabled: false,
    });
    const tick = await executeDiscoveryHostTick();
    expect(tick.enqueued).toBe(0);

    await app.close();
  });

  it('repeated host tick does not duplicate execution for the same due slot', async () => {
    isolateDiscoveryState();
    const app = await buildApp({ logger: false });
    const { sessionId } = await createSession(app);
    await createDailyProfile(sessionId, 'profile-idempotent-tick', 9);
    await markScheduleDue('profile-idempotent-tick', '2026-09-01T08:00:00.000Z');

    const first = await executeDiscoveryHostTick();
    expect(first.enqueued).toBe(1);

    const second = await executeDiscoveryHostTick();
    expect(second.enqueued).toBe(0);
    expect(second.processedJobs).toHaveLength(0);

    await app.close();
  });

  it('HTTP ops trigger requires ops token, not ordinary account auth', async () => {
    isolateDiscoveryState();
    const app = await buildApp({ logger: false });

    const unauthenticated = await app.inject({
      method: 'POST',
      url: '/api/ops/discovery/trigger-due-runs',
    });
    expect(unauthenticated.statusCode).toBe(403);
    expect(unauthenticated.json()).toMatchObject({ code: 'OPS_FORBIDDEN' });

    const { sessionId } = await createSession(app);
    const sessionOnly = await app.inject({
      method: 'POST',
      url: '/api/ops/discovery/trigger-due-runs',
      headers: { 'x-session-id': sessionId },
    });
    expect(sessionOnly.statusCode).toBe(403);

    const { sessionId: claimedSessionId, token: claimedToken } =
      await createClaimedSession(app);
    const ordinaryAccount = await app.inject({
      method: 'POST',
      url: '/api/ops/discovery/trigger-due-runs',
      headers: {
        Authorization: `Bearer ${claimedToken}`,
        'x-session-id': claimedSessionId,
      },
    });
    expect(ordinaryAccount.statusCode).toBe(403);
    expect(ordinaryAccount.json()).toMatchObject({ code: 'OPS_FORBIDDEN' });

    const authorized = await app.inject({
      method: 'POST',
      url: '/api/ops/discovery/trigger-due-runs',
      headers: {
        Authorization: `Bearer ${OPS_TOKEN}`,
      },
    });
    expect(authorized.statusCode).toBe(200);
    expect(authorized.json()).toMatchObject({
      enqueued: expect.any(Number),
      skipped: expect.any(Number),
      outcomes: expect.any(Array),
      processedJobs: expect.any(Array),
    });

    await app.close();
  });

  it('host tick can reach notification delivery when recipient is configured', async () => {
    const dir = isolateDiscoveryState();
    const app = await buildApp({ logger: false });
    const { sessionId } = await createSession(app);
    const userId = resolveDiscoveryUserId({ sessionId, accountId: null });
    setDiscoveryNotificationEmailForUser(userId, 'host-tick@example.com');
    await createDailyProfile(sessionId, 'profile-notify-tick', 9);
    await markScheduleDue('profile-notify-tick', '2026-09-01T08:00:00.000Z');

    const tick = await executeDiscoveryHostTick();
    expect(tick.enqueued).toBe(1);
    const processed = tick.processedJobs.find((j) => j.kind === 'processed');
    expect(processed?.runId).toBeTruthy();

    const notificationStore = createSqliteNotificationPersistence({
      databasePath: path.join(dir, 'discovery.sqlite'),
    });
    const record = await notificationStore.findById(
      notificationIdentityKey({
        profileId: 'profile-notify-tick',
        digestId: `digest:${processed!.runId}`,
        channel: 'EMAIL',
        recipient: { userId, address: 'host-tick@example.com' },
      })
    );
    expect(record?.status).toBe('SENT');
    notificationStore.close();

    await app.close();
  });
});
