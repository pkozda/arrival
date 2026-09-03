import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildDiscoveryRunDiagnostics,
  summarizeRunPromotions,
  createDiscoveryService,
  createDiscoveryUserService,
  createInMemoryExecutionQueue,
  createInMemoryRateLimiter,
  createResultStateWriter,
  createSqliteProfilePersistence,
  createSqliteResultPersistence,
  createSqliteSchedulerPersistence,
  emptyCriteria,
  happyPathTransport,
  serializeDiscoveryRunFunnelDiagnostics,
  smokeRegistry,
  type DiscoveryProfile,
  type ScheduledRunRecord,
} from '../index.js';
import { createInMemoryNotificationStore } from '../notifications/fakes/in-memory-notification-store.js';
import { createInMemoryResultStore } from '../pipeline/fakes/in-memory-result-store.js';

const NOW = '2026-09-01T09:00:00.000Z';
const USER_A = 'user-a';

function jobProfile(overrides: Partial<DiscoveryProfile> = {}): DiscoveryProfile {
  return {
    id: 'profile-job',
    userId: USER_A,
    name: 'Jobs',
    strategyId: 'job-discovery',
    strategyVersion: '1',
    criteria: {
      ...emptyCriteria(),
      required: [{ key: 'country', value: 'DE' }],
    },
    schedule: { cadence: 'manual' },
    notification: { emailEnabled: true, skipEmptyDigest: true },
    enabled: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function tempDb(prefix: string): { path: string; cleanup: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  return {
    path: path.join(dir, 'discovery.sqlite'),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

describe('E11.2 run diagnostics', () => {
  it('summarizeRunPromotions counts new and updated promotions for a run', () => {
    const run = { runId: 'run-1', startedAt: NOW };
    const summary = summarizeRunPromotions(
      [
        {
          promotedFromRunId: 'run-1',
          firstSeenAt: NOW,
          lastChangedAt: NOW,
        },
        {
          promotedFromRunId: 'run-1',
          firstSeenAt: '2026-08-01T09:00:00.000Z',
          lastChangedAt: NOW,
        },
        {
          promotedFromRunId: 'run-other',
          firstSeenAt: NOW,
          lastChangedAt: NOW,
        },
      ],
      run
    );
    expect(summary).toEqual({ newResults: 1, updatedResults: 1 });
  });

  it('buildDiscoveryRunDiagnostics redacts notification recipient details', async () => {
    const run: ScheduledRunRecord = {
      runId: 'run-dx-1',
      scheduleId: 'sched:profile-dx',
      profileId: 'profile-dx',
      trigger: 'manual',
      startedAt: NOW,
      finishedAt: '2026-09-01T09:01:00.000Z',
      status: 'FAILED',
      errorMessage: 'Pipeline adapter timeout',
    };
    const resultStore = createInMemoryResultStore();
    const notificationStore = createInMemoryNotificationStore([
      {
        id: 'notif-dx-1',
        profileId: 'profile-dx',
        digestId: 'digest-dx-1',
        runId: 'run-dx-1',
        channel: 'EMAIL',
        recipient: { userId: USER_A, address: 'secret@example.com' },
        payload: {
          title: '1 new opportunity',
          summary: 'Discovery run completed.',
          resultIds: ['result:profile-dx:abc'],
          items: [],
          runId: 'run-dx-1',
          strategyId: 'job-discovery',
          strategyVersion: '1',
          period: { from: NOW, to: '2026-09-01T09:01:00.000Z' },
        },
        status: 'FAILED',
        createdAt: NOW,
        failure: { code: 'DELIVERY_FAILED', message: 'Transport rejected request' },
      },
    ]);

    const diagnostics = await buildDiscoveryRunDiagnostics({
      run,
      resultStore,
      notificationStore,
    });

    expect(diagnostics).toMatchObject({
      runId: 'run-dx-1',
      profileId: 'profile-dx',
      status: 'FAILED',
      error: { message: 'Pipeline adapter timeout' },
      notification: { status: 'FAILED', channel: 'EMAIL', failureCode: 'DELIVERY_FAILED' },
      ai: { maxEvaluations: 100 },
    });
    expect(JSON.stringify(diagnostics)).not.toMatch(/secret@example.com/);
    expect(diagnostics).not.toHaveProperty('recipient');
  });

  it('buildDiscoveryRunDiagnostics includes funnel when provided', async () => {
    const run: ScheduledRunRecord = {
      runId: 'run-funnel-1',
      scheduleId: 'sched:profile-funnel',
      profileId: 'profile-funnel',
      trigger: 'manual',
      startedAt: NOW,
      finishedAt: '2026-09-01T09:01:00.000Z',
      status: 'SUCCESS',
    };
    const funnel = {
      queries: [{ id: 'q1', text: 'engineer hiring DE' }],
      stats: {
        candidatesFound: 2,
        candidatesRejected: 1,
        candidatesVerified: 1,
        resultsCreated: 1,
        resultsUpdated: 0,
      },
      status: 'SUCCESS' as const,
      partialFailureCount: 0,
      stages: [{ stage: 'search', outcome: 'ok' }],
      discovered: [{ candidateId: 'run-funnel-1:cand:0', url: 'https://example.com/jobs/1' }],
      rejected: [
        {
          candidateId: 'run-funnel-1:cand:1',
          atStage: 'VERIFYING',
          reasonCode: 'REJECTED_VERIFICATION_FAIL',
        },
      ],
      promoted: { created: 1, updated: 0, denied: 0, unchanged: 0 },
    };

    const diagnostics = await buildDiscoveryRunDiagnostics({
      run,
      resultStore: createInMemoryResultStore(),
      notificationStore: createInMemoryNotificationStore(),
      funnel,
    });

    expect(diagnostics.funnel).toEqual(funnel);
  });

  it('getRunDiagnostics returns stored funnel from execution job metadata', async () => {
    const queue = createInMemoryExecutionQueue([
      {
        jobId: 'job-funnel-dx',
        runId: 'run-funnel-dx',
        scheduleId: 'sched:profile-funnel-dx',
        profileId: 'profile-funnel-dx',
        strategyId: 'job-discovery',
        strategyVersion: '1',
        trigger: 'manual',
        requestedAt: NOW,
        attempt: 1,
        status: 'COMPLETED',
        finishedAt: '2026-09-01T09:01:00.000Z',
        metadata: {
          funnel: serializeDiscoveryRunFunnelDiagnostics({
            queries: [{ id: 'q1', text: 'test query' }],
            stats: {
              candidatesFound: 0,
              candidatesRejected: 0,
              candidatesVerified: 0,
              resultsCreated: 0,
              resultsUpdated: 0,
            },
            status: 'SUCCESS',
            partialFailureCount: 0,
            stages: [],
            discovered: [],
            rejected: [],
            promoted: { created: 0, updated: 0, denied: 0, unchanged: 0 },
          }),
        },
      },
    ]);
    const db = tempDb('e128-funnel-dx-');
    const profileStore = createSqliteProfilePersistence({ databasePath: db.path });
    const resultStore = createSqliteResultPersistence({ databasePath: db.path });
    const scheduler = createSqliteSchedulerPersistence({ databasePath: db.path });
    await profileStore.upsert(jobProfile({ id: 'profile-funnel-dx', userId: USER_A }));
    await scheduler.runStore.insert({
      runId: 'run-funnel-dx',
      scheduleId: 'sched:profile-funnel-dx',
      profileId: 'profile-funnel-dx',
      trigger: 'manual',
      startedAt: NOW,
      finishedAt: '2026-09-01T09:01:00.000Z',
      status: 'SUCCESS',
    });

    const discoveryService = createDiscoveryService({
      production: {
        brave: { apiKey: 'smoke-brave-key' },
        openai: { apiKey: 'smoke-openai-key', model: 'gpt-4o-mini' },
        email: {
          apiKey: 'smoke-resend-key',
          from: 'Arrival Atlas <noreply@example.com>',
        },
        transport: happyPathTransport(),
        rateLimiter: createInMemoryRateLimiter(),
      },
      persistence: {
        resultsDatabasePath: db.path,
        schedulerDatabasePath: db.path,
        notificationsDatabasePath: db.path,
        queueDatabasePath: db.path,
        profilesDatabasePath: db.path,
      },
      registry: smokeRegistry(),
      queue,
    });

    await discoveryService.start();
    const diagnostics = await discoveryService.getRunDiagnostics('run-funnel-dx');
    expect(diagnostics?.funnel?.queries).toEqual([{ id: 'q1', text: 'test query' }]);

    await discoveryService.stop();
    profileStore.close();
    resultStore.close();
    scheduler.close();
    db.cleanup();
  });

  it('getRunDiagnostics omits funnel for historical runs without metadata', async () => {
    const db = tempDb('e128-historical-');
    const profileStore = createSqliteProfilePersistence({ databasePath: db.path });
    const resultStore = createSqliteResultPersistence({ databasePath: db.path });
    const scheduler = createSqliteSchedulerPersistence({ databasePath: db.path });
    await profileStore.upsert(jobProfile({ id: 'profile-historical', userId: USER_A }));
    await scheduler.runStore.insert({
      runId: 'run-historical',
      scheduleId: 'sched:profile-historical',
      profileId: 'profile-historical',
      trigger: 'manual',
      startedAt: NOW,
      finishedAt: '2026-09-01T09:01:00.000Z',
      status: 'SUCCESS',
    });

    const discoveryService = createDiscoveryService({
      production: {
        brave: { apiKey: 'smoke-brave-key' },
        openai: { apiKey: 'smoke-openai-key', model: 'gpt-4o-mini' },
        email: {
          apiKey: 'smoke-resend-key',
          from: 'Arrival Atlas <noreply@example.com>',
        },
        transport: happyPathTransport(),
        rateLimiter: createInMemoryRateLimiter(),
      },
      persistence: {
        resultsDatabasePath: db.path,
        schedulerDatabasePath: db.path,
        notificationsDatabasePath: db.path,
        queueDatabasePath: db.path,
        profilesDatabasePath: db.path,
      },
      registry: smokeRegistry(),
    });

    await discoveryService.start();
    const diagnostics = await discoveryService.getRunDiagnostics('run-historical');
    expect(diagnostics).toMatchObject({
      runId: 'run-historical',
      profileId: 'profile-historical',
      status: 'SUCCESS',
    });
    expect(diagnostics?.funnel).toBeUndefined();

    await discoveryService.stop();
    profileStore.close();
    resultStore.close();
    scheduler.close();
    db.cleanup();
  });

  it('getRunDiagnostics reflects persisted run execution after runProfileNow', async () => {
    const db = tempDb('e112-run-dx-');
    const profileStore = createSqliteProfilePersistence({ databasePath: db.path });
    const resultStore = createSqliteResultPersistence({ databasePath: db.path });
    const scheduler = createSqliteSchedulerPersistence({ databasePath: db.path });
    await profileStore.upsert(jobProfile({ id: 'profile-run-dx', userId: USER_A }));

    const discoveryService = createDiscoveryService({
      production: {
        brave: { apiKey: 'smoke-brave-key' },
        openai: { apiKey: 'smoke-openai-key', model: 'gpt-4o-mini' },
        email: {
          apiKey: 'smoke-resend-key',
          from: 'Arrival Atlas <noreply@example.com>',
        },
        transport: happyPathTransport(),
        rateLimiter: createInMemoryRateLimiter(),
      },
      persistence: {
        resultsDatabasePath: db.path,
        schedulerDatabasePath: db.path,
        notificationsDatabasePath: db.path,
        queueDatabasePath: db.path,
        profilesDatabasePath: db.path,
      },
      registry: smokeRegistry(),
      resolveNotificationTarget: () => ({
        recipient: { userId: USER_A, address: 'ops@example.com' },
        channel: 'EMAIL',
        skipEmptyDigest: true,
      }),
    });

    const userService = createDiscoveryUserService({
      profileStore,
      resultStore,
      resultStateWriter: createResultStateWriter({
        store: resultStore,
        writer: resultStore,
      }),
      runStore: scheduler.runStore,
      registry: smokeRegistry(),
      discoveryService,
    });

    const outcome = await userService.runProfileNow(USER_A, 'profile-run-dx');
    expect(outcome.runId).toBeTruthy();

    await discoveryService.start();
    const diagnostics = await discoveryService.getRunDiagnostics(outcome.runId!);
    expect(diagnostics).toMatchObject({
      runId: outcome.runId,
      profileId: 'profile-run-dx',
      status: expect.stringMatching(/SUCCESS|PARTIAL_SUCCESS|RUNNING|PENDING/),
      trigger: 'manual',
      ai: { maxEvaluations: 100 },
    });
    expect(diagnostics?.startedAt).toBeTruthy();
    if (diagnostics?.summary) {
      expect(typeof diagnostics.summary.newResults).toBe('number');
    }
    expect(JSON.stringify(diagnostics)).not.toMatch(/ops@example.com/);

    await discoveryService.stop();
    profileStore.close();
    resultStore.close();
    scheduler.close();
    db.cleanup();
  });
});
