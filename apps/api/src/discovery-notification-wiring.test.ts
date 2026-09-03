import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createDiscoveryNotificationService,
  createFakeNotificationAdapter,
  createSqliteNotificationPersistence,
  createSystemClock,
  notificationIdentityKey,
  type DiscoveryDigest,
  type NotificationRecord,
} from '@arrival-atlas/discovery';
import { buildApp } from './build-app.js';
import {
  resetDiscoveryExecutionForTests,
} from './discovery/discovery-execution-runtime.js';
import {
  clearDiscoveryNotificationEmailOverrides,
  setDiscoveryNotificationEmailForUser,
} from './discovery/resolve-discovery-notification-email.js';
import { resetDiscoveryRuntimeForTests } from './discovery/discovery-user-runtime.js';
import { resolveDiscoveryUserId } from './discovery/discovery-user-runtime.js';

describe('E10.1 Atlas discovery notification wiring', () => {
  const dirs: string[] = [];
  let previousNotificationEmail: string | undefined;

  beforeEach(() => {
    resetDiscoveryRuntimeForTests();
    resetDiscoveryExecutionForTests();
    clearDiscoveryNotificationEmailOverrides();
    previousNotificationEmail = process.env.DISCOVERY_NOTIFICATION_EMAIL;
    delete process.env.DISCOVERY_NOTIFICATION_EMAIL;
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
    if (previousNotificationEmail === undefined) {
      delete process.env.DISCOVERY_NOTIFICATION_EMAIL;
    } else {
      process.env.DISCOVERY_NOTIFICATION_EMAIL = previousNotificationEmail;
    }
    delete process.env.DISCOVERY_USE_SMOKE_TRANSPORT;
  });

  async function startApp() {
    const dir = mkdtempSync(path.join(tmpdir(), 'discovery-e10-'));
    dirs.push(dir);
    process.env.ARRIVAL_ATLAS_STATE_DIR = dir;
    const app = await buildApp({ logger: false });
    return { app, dir };
  }

  async function createSession(app: Awaited<ReturnType<typeof buildApp>>) {
    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { context: { userProfile: { language: 'en' } } },
    });
    expect(sessionRes.statusCode).toBe(200);
    return sessionRes.json() as { sessionId: string };
  }

  async function createProfile(
    app: Awaited<ReturnType<typeof buildApp>>,
    sessionId: string,
    profileId: string
  ) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/modules/discovery/profiles',
      headers: { 'x-session-id': sessionId },
      payload: {
        id: profileId,
        name: 'E10 Notification Jobs',
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
    expect(res.statusCode).toBe(201);
  }

  async function runProfileNow(
    app: Awaited<ReturnType<typeof buildApp>>,
    sessionId: string,
    profileId: string
  ) {
    return app.inject({
      method: 'POST',
      url: `/api/modules/discovery/profiles/${profileId}/run-now`,
      headers: { 'x-session-id': sessionId },
    });
  }

  function openNotificationStore(dir: string) {
    return createSqliteNotificationPersistence({
      databasePath: path.join(dir, 'discovery.sqlite'),
    });
  }

  async function findSentNotification(
    store: ReturnType<typeof openNotificationStore>,
    profileId: string,
    runId: string,
    recipient: { userId: string; address: string }
  ): Promise<NotificationRecord | null> {
    const id = notificationIdentityKey({
      profileId,
      digestId: `digest:${runId}`,
      channel: 'EMAIL',
      recipient,
    });
    const record = await store.findById(id);
    return record?.status === 'SENT' ? record : null;
  }

  function digestFromNotificationRecord(record: NotificationRecord): DiscoveryDigest {
    const { payload } = record;
    return {
      id: record.digestId,
      runId: record.runId,
      profileId: record.profileId,
      strategyId: payload.strategyId,
      strategyVersion: payload.strategyVersion,
      generatedAt: record.sentAt ?? record.createdAt,
      period: payload.period,
      resultIds: [...payload.resultIds],
      entries: payload.items.map((item) => ({
        resultId: item.resultId,
        rank: item.rank,
        rankValue: item.rankValue,
        novelty: item.novelty,
        userState: 'NEW',
        lifecycle: 'PROMOTED',
        shouldNotify: true,
      })),
      newResultIds: [...payload.resultIds],
      updatedResultIds: [],
      summary: {
        totalResults: payload.resultIds.length,
        newResults: payload.resultIds.length,
        updatedResults: 0,
        unchangedResults: 0,
        notifiedResults: 0,
      },
    };
  }

  it('run-now with resolved email delivers notification SENT', async () => {
    const { app, dir } = await startApp();
    const { sessionId } = await createSession(app);
    const userId = resolveDiscoveryUserId({ sessionId, accountId: null });
    setDiscoveryNotificationEmailForUser(userId, 'user-a@example.com');

    await createProfile(app, sessionId, 'profile-e10-sent');
    const runRes = await runProfileNow(app, sessionId, 'profile-e10-sent');
    expect(runRes.statusCode).toBe(202);

    const runBody = runRes.json() as { status: string; runId?: string };
    expect(runBody.runId).toBeTruthy();

    const notificationStore = openNotificationStore(dir);
    const record = await findSentNotification(
      notificationStore,
      'profile-e10-sent',
      runBody.runId!,
      { userId, address: 'user-a@example.com' }
    );
    expect(record).not.toBeNull();
    expect(record!.status).toBe('SENT');
    expect(record!.channel).toBe('EMAIL');
    expect(record!.recipient.address).toBe('user-a@example.com');
    expect(record!.recipient.userId).toBe(userId);

    notificationStore.close();
    await app.close();
  });

  it('successful delivery marks results NOTIFIED', async () => {
    const { app, dir } = await startApp();
    const { sessionId } = await createSession(app);
    const userId = resolveDiscoveryUserId({ sessionId, accountId: null });
    setDiscoveryNotificationEmailForUser(userId, 'user-a@example.com');

    await createProfile(app, sessionId, 'profile-e10-notified');
    const runRes = await runProfileNow(app, sessionId, 'profile-e10-notified');
    const runBody = runRes.json() as { runId?: string };
    expect(runBody.runId).toBeTruthy();

    const resultsRes = await app.inject({
      method: 'GET',
      url: '/api/modules/discovery/profiles/profile-e10-notified/results',
      headers: { 'x-session-id': sessionId },
    });
    expect(resultsRes.statusCode).toBe(200);
    const results = (resultsRes.json() as { results: Array<{ userState: string }> }).results;
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.userState === 'NOTIFIED')).toBe(true);

    const notificationStore = openNotificationStore(dir);
    expect(
      await findSentNotification(
        notificationStore,
        'profile-e10-notified',
        runBody.runId!,
        { userId, address: 'user-a@example.com' }
      )
    ).not.toBeNull();
    notificationStore.close();
    await app.close();
  });

  it('missing email completes run without notification delivery', async () => {
    const { app, dir } = await startApp();
    const { sessionId } = await createSession(app);

    await createProfile(app, sessionId, 'profile-e10-no-email');
    const runRes = await runProfileNow(app, sessionId, 'profile-e10-no-email');
    expect(runRes.statusCode).toBe(202);
    const runBody = runRes.json() as { status: string; runId?: string };
    expect(['success', 'partial_success']).toContain(runBody.status);
    expect(runBody.runId).toBeTruthy();

    const resultsRes = await app.inject({
      method: 'GET',
      url: '/api/modules/discovery/profiles/profile-e10-no-email/results',
      headers: { 'x-session-id': sessionId },
    });
    const results = (resultsRes.json() as { results: Array<{ userState: string }> }).results;
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.userState === 'NOTIFIED')).toBe(false);

    const notificationStore = openNotificationStore(dir);
    expect(
      await findSentNotification(
        notificationStore,
        'profile-e10-no-email',
        runBody.runId!,
        { userId: resolveDiscoveryUserId({ sessionId, accountId: null }), address: 'unused@example.com' }
      )
    ).toBeNull();
    notificationStore.close();
    await app.close();
  });

  it('repeated delivery for same digest is idempotent', async () => {
    const { app, dir } = await startApp();
    const { sessionId } = await createSession(app);
    const userId = resolveDiscoveryUserId({ sessionId, accountId: null });
    setDiscoveryNotificationEmailForUser(userId, 'user-a@example.com');

    await createProfile(app, sessionId, 'profile-e10-idempotent');
    const runRes = await runProfileNow(app, sessionId, 'profile-e10-idempotent');
    const runBody = runRes.json() as { runId?: string };
    expect(runBody.runId).toBeTruthy();

    const notificationStore = openNotificationStore(dir);
    const recipient = { userId, address: 'user-a@example.com' };
    const record = await findSentNotification(
      notificationStore,
      'profile-e10-idempotent',
      runBody.runId!,
      recipient
    );
    expect(record).not.toBeNull();

    const adapter = createFakeNotificationAdapter();
    const retryService = createDiscoveryNotificationService({
      store: notificationStore,
      adapter,
      clock: createSystemClock(),
    });
    const digest = digestFromNotificationRecord(record!);
    const resolvedRecipient = record!.recipient;

    const second = await retryService.deliverDigest({
      digest,
      recipient: resolvedRecipient,
      channel: 'EMAIL',
    });
    expect(second.kind).toBe('skipped');
    expect(second.reason).toBe('already_delivered');
    expect(adapter.sent).toHaveLength(0);

    const identity = notificationIdentityKey({
      profileId: record!.profileId,
      digestId: record!.digestId,
      channel: 'EMAIL',
      recipient: resolvedRecipient,
    });
    expect(await notificationStore.findById(identity)).toMatchObject({ status: 'SENT' });

    notificationStore.close();
    await app.close();
  });

  it('cross-user isolation keeps notification recipients separate', async () => {
    const { app, dir } = await startApp();

    const sessionA = await createSession(app);
    const userA = resolveDiscoveryUserId({ sessionId: sessionA.sessionId, accountId: null });
    setDiscoveryNotificationEmailForUser(userA, 'user-a@example.com');
    await createProfile(app, sessionA.sessionId, 'profile-user-a');

    const sessionB = await createSession(app);
    const userB = resolveDiscoveryUserId({ sessionId: sessionB.sessionId, accountId: null });
    setDiscoveryNotificationEmailForUser(userB, 'user-b@example.com');
    await createProfile(app, sessionB.sessionId, 'profile-user-b');

    const runA = await runProfileNow(app, sessionA.sessionId, 'profile-user-a');
    const runB = await runProfileNow(app, sessionB.sessionId, 'profile-user-b');
    const runBodyA = runA.json() as { runId?: string };
    const runBodyB = runB.json() as { runId?: string };
    expect(runBodyA.runId).toBeTruthy();
    expect(runBodyB.runId).toBeTruthy();

    const forbidden = await runProfileNow(app, sessionB.sessionId, 'profile-user-a');
    expect(forbidden.statusCode).toBe(404);

    const notificationStore = openNotificationStore(dir);
    const recordA = await findSentNotification(
      notificationStore,
      'profile-user-a',
      runBodyA.runId!,
      { userId: userA, address: 'user-a@example.com' }
    );
    const recordB = await findSentNotification(
      notificationStore,
      'profile-user-b',
      runBodyB.runId!,
      { userId: userB, address: 'user-b@example.com' }
    );
    expect(recordA?.recipient.address).toBe('user-a@example.com');
    expect(recordB?.recipient.address).toBe('user-b@example.com');
    expect(recordA?.recipient.userId).toBe(userA);
    expect(recordB?.recipient.userId).toBe(userB);

    notificationStore.close();
    await app.close();
  });
});
