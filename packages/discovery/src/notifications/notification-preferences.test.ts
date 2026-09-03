import { describe, expect, it } from 'vitest';
import {
  buildDiscoveryDigest,
  buildNotificationPlan,
  createDiscoveryExecutionWorker,
  createDiscoveryNotificationService,
  createFakeClock,
  createFakeNotificationAdapter,
  createInMemoryExecutionQueue,
  createInMemoryNotificationStore,
  createInMemoryProfileStore,
  createInMemoryRunStore,
  createInMemoryScheduleStore,
  type DiscoveryDigest,
  type DiscoveryRunExecutor,
  type PipelineExecuteResult,
} from '../index.js';

const recipient = { userId: 'user-1', address: 'user-1@example.com' };

function emptyDigest(overrides: Partial<DiscoveryDigest['summary']> = {}): DiscoveryDigest {
  const base = buildDiscoveryDigest({
    runId: 'run-1',
    profileId: 'profile-job',
    strategyId: 'job-discovery',
    strategyVersion: '1',
    generatedAt: '2026-08-31T10:05:00.000Z',
    periodFrom: '2026-08-31T10:00:00.000Z',
    sources: [],
  });
  return {
    ...base,
    entries: [],
    resultIds: [],
    newResultIds: [],
    updatedResultIds: [],
    summary: {
      totalResults: 0,
      newResults: 0,
      updatedResults: 0,
      unchangedResults: 0,
      notifiedResults: 0,
      ...overrides,
    },
  };
}

function sampleDigest(): DiscoveryDigest {
  const base = buildDiscoveryDigest({
    runId: 'run-1',
    profileId: 'profile-job',
    strategyId: 'job-discovery',
    strategyVersion: '1',
    generatedAt: '2026-08-31T10:05:00.000Z',
    periodFrom: '2026-08-31T10:00:00.000Z',
    sources: [],
  });
  return {
    ...base,
    entries: [
      {
        resultId: 'result-a',
        rank: 1,
        rankValue: 0.9,
        novelty: 'NEW',
        userState: 'NEW',
        lifecycle: 'ACTIVE',
        shouldNotify: true,
      },
    ],
    resultIds: ['result-a'],
    newResultIds: ['result-a'],
    updatedResultIds: [],
    summary: {
      totalResults: 1,
      newResults: 1,
      updatedResults: 0,
      unchangedResults: 0,
      notifiedResults: 1,
    },
  };
}

describe('E10.4 notification preferences — delivery behavior', () => {
  it('emailEnabled=false → resolver returns null and worker sends nothing', async () => {
    const clock = createFakeClock('2026-08-31T10:00:00.000Z');
    const queue = createInMemoryExecutionQueue();
    const runStore = createInMemoryRunStore();
    const scheduleStore = createInMemoryScheduleStore();
    const adapter = createFakeNotificationAdapter();
    const service = createDiscoveryNotificationService({
      store: createInMemoryNotificationStore(),
      adapter,
      clock,
    });

    const profileStore = createInMemoryProfileStore([
      {
        id: 'profile-job',
        userId: 'user-1',
        name: 'Jobs',
        strategyId: 'job-discovery',
        strategyVersion: '1',
        criteria: { required: [], preferred: [], excluded: [], flexible: [] },
        schedule: { cadence: 'manual' },
        notification: { emailEnabled: false, skipEmptyDigest: true },
        enabled: true,
        createdAt: '2026-08-31T09:00:00.000Z',
        updatedAt: '2026-08-31T09:00:00.000Z',
      },
    ]);

    const resolveNotificationTarget = async ({ profileId }: { profileId: string }) => {
      const profile = await profileStore.get(profileId);
      if (!profile || profile.notification.emailEnabled === false) return null;
      return {
        channel: 'EMAIL' as const,
        recipient,
        skipEmptyDigest: profile.notification.skipEmptyDigest,
      };
    };

    const executor: DiscoveryRunExecutor = {
      async execute(req) {
        return {
          run: {
            id: req.runId,
            profileId: req.profileId,
            strategyId: 'job-discovery',
            strategyVersion: '1',
            criteriaSnapshot: { required: [], preferred: [], excluded: [], flexible: [] },
            startedAt: '2026-08-31T10:00:00.000Z',
            finishedAt: '2026-08-31T10:05:00.000Z',
            status: 'SUCCESS',
            stats: {
              candidatesFound: 0,
              candidatesRejected: 0,
              candidatesVerified: 0,
              resultsCreated: 0,
              resultsUpdated: 0,
            },
          },
          batch: { active: [], rejected: [] },
          stageOrder: ['resolve_snapshot'],
          stageDiagnostics: [],
          queries: [],
          digest: sampleDigest(),
        } satisfies PipelineExecuteResult;
      },
    };

    await scheduleStore.upsert({
      scheduleId: 'sched-1',
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      enabled: true,
      interval: { kind: 'fixed_interval', intervalSeconds: 3600 },
      timezone: 'UTC',
      nextRunAt: '2026-08-31T11:00:00.000Z',
      createdAt: '2026-08-31T09:00:00.000Z',
      updatedAt: '2026-08-31T10:00:00.000Z',
      runningRunId: 'run-1',
    });
    await runStore.insert({
      runId: 'run-1',
      scheduleId: 'sched-1',
      profileId: 'profile-job',
      trigger: 'scheduled',
      startedAt: '2026-08-31T10:00:00.000Z',
      status: 'PENDING',
    });
    await queue.enqueue({
      jobId: 'job-1',
      runId: 'run-1',
      scheduleId: 'sched-1',
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      trigger: 'scheduled',
      requestedAt: '2026-08-31T10:00:00.000Z',
    });

    const worker = createDiscoveryExecutionWorker({
      queue,
      executor,
      runStore,
      scheduleStore,
      clock,
      notificationService: service,
      resolveNotificationTarget,
    });

    await worker.processNext();
    expect(adapter.sent).toHaveLength(0);
  });

  it('emailEnabled=true + non-empty digest → delivery occurs', async () => {
    const adapter = createFakeNotificationAdapter();
    const service = createDiscoveryNotificationService({
      store: createInMemoryNotificationStore(),
      adapter,
      clock: createFakeClock('2026-08-31T10:10:00.000Z'),
    });
    const outcome = await service.deliverDigest({
      digest: sampleDigest(),
      recipient,
      channel: 'EMAIL',
      skipEmptyDigest: true,
    });
    expect(outcome.kind).toBe('delivered');
    expect(adapter.sent).toHaveLength(1);
  });

  it('skipEmptyDigest=true + empty digest → no delivery', async () => {
    const adapter = createFakeNotificationAdapter();
    const service = createDiscoveryNotificationService({
      store: createInMemoryNotificationStore(),
      adapter,
      clock: createFakeClock('2026-08-31T10:10:00.000Z'),
    });
    const outcome = await service.deliverDigest({
      digest: emptyDigest(),
      recipient,
      channel: 'EMAIL',
      skipEmptyDigest: true,
    });
    expect(outcome).toEqual({ kind: 'skipped', reason: 'empty_digest' });
    expect(adapter.sent).toHaveLength(0);
  });

  it('skipEmptyDigest=false + zero-new scan → empty digest notification delivered', async () => {
    const adapter = createFakeNotificationAdapter();
    const service = createDiscoveryNotificationService({
      store: createInMemoryNotificationStore(),
      adapter,
      clock: createFakeClock('2026-08-31T10:10:00.000Z'),
    });
    const plan = buildNotificationPlan({
      digest: emptyDigest(),
      recipient,
      channel: 'EMAIL',
      skipEmptyDigest: false,
    });
    expect(plan?.payload.resultIds).toEqual([]);
    expect(plan?.payload.title).toMatch(/no new updates/i);

    const outcome = await service.deliverDigest({
      digest: emptyDigest(),
      recipient,
      channel: 'EMAIL',
      skipEmptyDigest: false,
    });
    expect(outcome.kind).toBe('delivered');
    expect(adapter.sent).toHaveLength(1);
    expect(adapter.sent[0]?.payload.resultIds).toEqual([]);
  });

  it('skipEmptyDigest=false + unchanged-only rerun → still no delivery', async () => {
    const adapter = createFakeNotificationAdapter();
    const service = createDiscoveryNotificationService({
      store: createInMemoryNotificationStore(),
      adapter,
      clock: createFakeClock('2026-08-31T10:10:00.000Z'),
    });
    const digest = emptyDigest({
      totalResults: 3,
      unchangedResults: 3,
    });
    expect(
      buildNotificationPlan({
        digest,
        recipient,
        channel: 'EMAIL',
        skipEmptyDigest: false,
      })
    ).toBeNull();

    const outcome = await service.deliverDigest({
      digest,
      recipient,
      channel: 'EMAIL',
      skipEmptyDigest: false,
    });
    expect(outcome).toEqual({ kind: 'skipped', reason: 'empty_digest' });
    expect(adapter.sent).toHaveLength(0);
  });
});
