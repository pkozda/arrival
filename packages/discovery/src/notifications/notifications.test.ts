import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
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
  createInMemoryResultStore,
  createInMemoryRunStore,
  createInMemoryScheduleStore,
  createResultStateWriter,
  createSqliteNotificationPersistence,
  notificationIdentityKey,
  type DiscoveryDigest,
  type DiscoveryResult,
  type DiscoveryRunExecutor,
  type PipelineExecuteResult,
} from '../index.js';

function sampleDigest(overrides: Partial<DiscoveryDigest> = {}): DiscoveryDigest {
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
      {
        resultId: 'result-b',
        rank: 2,
        rankValue: 0.7,
        novelty: 'UPDATED',
        userState: 'NEW',
        lifecycle: 'ACTIVE',
        shouldNotify: true,
      },
    ],
    resultIds: ['result-a', 'result-b'],
    newResultIds: ['result-a'],
    updatedResultIds: ['result-b'],
    summary: {
      totalResults: 2,
      newResults: 1,
      updatedResults: 1,
      unchangedResults: 0,
      notifiedResults: 2,
    },
    ...overrides,
  };
}

const recipient = { userId: 'user-1', address: 'user-1@example.com' };

const IDENTITY_FIELDS = ['title', 'company'] as const;

function sampleResultForDigest(
  resultId: string,
  overrides: Partial<DiscoveryResult> = {}
): DiscoveryResult {
  const identity = {
    externalIds: { url: 'https://employer.example/jobs/1' },
    canonicalUrl: 'https://employer.example/jobs/1',
    fingerprintMaterial: { title: 'Frontend Engineer', company: 'Acme' },
  };
  return {
    id: resultId,
    profileId: 'profile-job',
    strategyId: 'job-discovery',
    strategyVersion: '1',
    identity,
    canonicalPresentation: {
      title: 'Frontend Engineer',
      primaryUrl: 'https://employer.example/jobs/1',
    },
    source: { trust: 'AGGREGATOR', url: 'https://employer.example/jobs/1' },
    verification: {
      status: 'PASS',
      sourceTrust: 'OFFICIAL',
      freshness: 'CURRENT',
      checks: [{ id: 'official_source', outcome: 'TRUE', required: true }],
      verifiedAt: '2026-08-30T14:00:00.000Z',
      evidenceIds: ['ev-1'],
    },
    evidence: [
      {
        id: 'ev-1',
        type: 'OFFICIAL_SOURCE',
        sourceUrl: 'https://employer.example/jobs/1',
        statement: 'Official listing',
        capturedAt: '2026-08-30T14:00:00.000Z',
      },
    ],
    score: {
      matchScore: 82,
      confidenceScore: 88,
      breakdown: {
        dimensions: [
          { id: 'role', labelKey: 'discovery.score.role', value: 80, weight: 0.3 },
        ],
      },
      scoredAt: '2026-08-30T14:00:00.000Z',
      strategyVersion: '1',
    },
    lifecycle: 'ACTIVE',
    userState: 'NEW',
    firstSeenAt: '2026-08-30T14:00:00.000Z',
    lastVerifiedAt: '2026-08-30T14:00:00.000Z',
    lastChangedAt: '2026-08-30T14:00:00.000Z',
    ...overrides,
  };
}

function serviceHarness(opts?: {
  adapter?: ReturnType<typeof createFakeNotificationAdapter>;
  withResultStateWriter?: boolean;
  resultStore?: ReturnType<typeof createInMemoryResultStore>;
}) {
  const clock = createFakeClock('2026-08-31T10:10:00.000Z');
  const store = createInMemoryNotificationStore();
  const adapter = opts?.adapter ?? createFakeNotificationAdapter();
  const resultStore = opts?.resultStore;
  const resultStateWriter =
    opts?.withResultStateWriter && resultStore
      ? createResultStateWriter({ store: resultStore, writer: resultStore })
      : undefined;
  const service = createDiscoveryNotificationService({
    store,
    adapter,
    clock,
    resultStateWriter,
  });
  return { clock, store, adapter, service, resultStore };
}

describe('E4.4 notification eligibility', () => {
  it('empty digest → no notification plan', () => {
    const digest = sampleDigest({ entries: [], resultIds: [], summary: {
      totalResults: 0, newResults: 0, updatedResults: 0, unchangedResults: 0, notifiedResults: 0,
    }});
    expect(buildNotificationPlan({ digest, recipient, channel: 'EMAIL' })).toBeNull();
  });

  it('digest with eligible entries → notification plan', async () => {
    const { service, adapter } = serviceHarness();
    const digest = sampleDigest();
    const outcome = await service.deliverDigest({
      digest,
      recipient,
      channel: 'EMAIL',
    });
    expect(outcome.kind).toBe('delivered');
    expect(adapter.sent).toHaveLength(1);
    expect(adapter.sent[0]?.payload.resultIds).toEqual(['result-a', 'result-b']);
  });

  it('uses only digest entries and preserves ordering', async () => {
    const { adapter, service } = serviceHarness();
    const digest = sampleDigest();
    await service.deliverDigest({ digest, recipient, channel: 'EMAIL' });
    expect(adapter.sent[0]?.payload.items.map((i) => i.resultId)).toEqual([
      'result-a',
      'result-b',
    ]);
    expect(adapter.sent[0]?.payload.items[0]?.rank).toBe(1);
    expect(adapter.sent[0]?.payload.items[1]?.rank).toBe(2);
  });
});

describe('E4.4 notification idempotency', () => {
  it('same digest processed twice → one adapter send', async () => {
    const { service, adapter } = serviceHarness();
    const digest = sampleDigest();
    const first = await service.deliverDigest({ digest, recipient, channel: 'EMAIL' });
    const second = await service.deliverDigest({ digest, recipient, channel: 'EMAIL' });
    expect(first.kind).toBe('delivered');
    expect(second).toEqual({ kind: 'skipped', reason: 'already_delivered' });
    expect(adapter.sent).toHaveLength(1);
  });

  it('different digest → separate notification', async () => {
    const { service, adapter } = serviceHarness();
    await service.deliverDigest({
      digest: sampleDigest({ id: 'digest:run-1', runId: 'run-1' }),
      recipient,
      channel: 'EMAIL',
    });
    await service.deliverDigest({
      digest: sampleDigest({ id: 'digest:run-2', runId: 'run-2' }),
      recipient,
      channel: 'EMAIL',
    });
    expect(adapter.sent).toHaveLength(2);
  });

  it('different channel → separate notification', async () => {
    const { service, adapter } = serviceHarness();
    const digest = sampleDigest();
    await service.deliverDigest({ digest, recipient, channel: 'EMAIL' });
    await service.deliverDigest({ digest, recipient, channel: 'PUSH' });
    expect(adapter.sent).toHaveLength(2);
  });

  it('identity key is deterministic', () => {
    const id = notificationIdentityKey({
      profileId: 'profile-job',
      digestId: 'digest:run-1',
      channel: 'EMAIL',
      recipient,
    });
    expect(id).toBe(
      'notification:profile-job:digest:run-1:EMAIL:user-1:user-1@example.com'
    );
  });
});

describe('E4.4 notification delivery', () => {
  it('successful adapter → SENT record', async () => {
    const { service, store } = serviceHarness();
    const digest = sampleDigest();
    const outcome = await service.deliverDigest({ digest, recipient, channel: 'EMAIL' });
    expect(outcome.kind).toBe('delivered');
    const record = await store.findById(
      notificationIdentityKey({
        profileId: digest.profileId,
        digestId: digest.id,
        channel: 'EMAIL',
        recipient,
      })
    );
    expect(record?.status).toBe('SENT');
    expect(record?.sentAt).toBeTruthy();
  });

  it('adapter failure → FAILED without fabricating success', async () => {
    const adapter = createFakeNotificationAdapter({
      failWith: { ok: false, code: 'DELIVERY_FAILED', message: 'provider down' },
    });
    const { service, store } = serviceHarness({ adapter });
    const digest = sampleDigest();
    const outcome = await service.deliverDigest({ digest, recipient, channel: 'EMAIL' });
    expect(outcome.kind).toBe('failed');
    if (outcome.kind === 'failed') {
      expect(outcome.failure.code).toBe('DELIVERY_FAILED');
    }
    const record = await store.findById(
      notificationIdentityKey({
        profileId: digest.profileId,
        digestId: digest.id,
        channel: 'EMAIL',
        recipient,
      })
    );
    expect(record?.status).toBe('FAILED');
    expect(adapter.sent).toHaveLength(0);
  });

  it('empty digest skips delivery', async () => {
    const { service, adapter } = serviceHarness();
    const digest = sampleDigest({
      entries: [],
      resultIds: [],
      summary: {
        totalResults: 0,
        newResults: 0,
        updatedResults: 0,
        unchangedResults: 0,
        notifiedResults: 0,
      },
    });
    const outcome = await service.deliverDigest({ digest, recipient, channel: 'EMAIL' });
    expect(outcome).toEqual({ kind: 'skipped', reason: 'empty_digest' });
    expect(adapter.sent).toHaveLength(0);
  });
});

describe('E4.4 notification safety', () => {
  it('does not mutate digest', async () => {
    const { service } = serviceHarness();
    const digest = sampleDigest();
    const before = structuredClone(digest);
    await service.deliverDigest({ digest, recipient, channel: 'EMAIL' });
    expect(digest).toEqual(before);
  });
});

describe('E4.4 SQLite notification persistence', () => {
  function tempDb(): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'discovery-e44-'));
    return path.join(dir, 'notifications.sqlite');
  }

  function cleanupDb(dbPath: string) {
    try {
      rmSync(path.dirname(dbPath), { recursive: true, force: true });
    } catch {
      // best effort
    }
  }

  it('notification record survives restart and enforces idempotency', async () => {
    const dbPath = tempDb();
    const clock = createFakeClock('2026-08-31T10:10:00.000Z');
    const digest = sampleDigest();

    const firstStore = createSqliteNotificationPersistence({ databasePath: dbPath });
    const adapter = createFakeNotificationAdapter();
    const service1 = createDiscoveryNotificationService({
      store: firstStore,
      adapter,
      clock,
    });
    await service1.deliverDigest({ digest, recipient, channel: 'EMAIL' });
    firstStore.close();

    const secondStore = createSqliteNotificationPersistence({ databasePath: dbPath });
    const service2 = createDiscoveryNotificationService({
      store: secondStore,
      adapter,
      clock,
    });
    const again = await service2.deliverDigest({ digest, recipient, channel: 'EMAIL' });
    expect(again).toEqual({ kind: 'skipped', reason: 'already_delivered' });
    expect(secondStore.count()).toBe(1);
    secondStore.close();
    cleanupDb(dbPath);
  });
});

describe('E4.4 worker notification integration', () => {
  function pipelineExecutor(
    status: PipelineExecuteResult['run']['status'],
    digest?: DiscoveryDigest
  ): DiscoveryRunExecutor {
    return {
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
            status,
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
          digest,
        };
      },
    };
  }

  async function seedWorkerJob(
    executor: DiscoveryRunExecutor,
    notificationService?: ReturnType<typeof createDiscoveryNotificationService>
  ) {
    const clock = createFakeClock('2026-08-31T10:00:00.000Z');
    const queue = createInMemoryExecutionQueue();
    const runStore = createInMemoryRunStore();
    const scheduleStore = createInMemoryScheduleStore();
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
    const adapter = createFakeNotificationAdapter();
    const service =
      notificationService ??
      createDiscoveryNotificationService({
        store: createInMemoryNotificationStore(),
        adapter,
        clock,
      });
    const worker = createDiscoveryExecutionWorker({
      queue,
      executor,
      runStore,
      scheduleStore,
      clock,
      notificationService: service,
      resolveNotificationTarget: () => ({ recipient, channel: 'EMAIL' }),
    });
    return { worker, runStore, adapter, service };
  }

  it('SUCCESS + digest → notification attempted', async () => {
    const { worker, adapter } = await seedWorkerJob(
      pipelineExecutor('SUCCESS', sampleDigest())
    );
    await worker.processNext();
    expect(adapter.sent).toHaveLength(1);
  });

  it('PARTIAL_SUCCESS + digest → notification attempted', async () => {
    const { worker, adapter } = await seedWorkerJob(
      pipelineExecutor('PARTIAL_SUCCESS', sampleDigest())
    );
    await worker.processNext();
    expect(adapter.sent).toHaveLength(1);
  });

  it('empty digest → no delivery', async () => {
    const empty = sampleDigest({
      entries: [],
      resultIds: [],
      summary: {
        totalResults: 0,
        newResults: 0,
        updatedResults: 0,
        unchangedResults: 0,
        notifiedResults: 0,
      },
    });
    const { worker, adapter } = await seedWorkerJob(pipelineExecutor('SUCCESS', empty));
    await worker.processNext();
    expect(adapter.sent).toHaveLength(0);
  });

  it('notification failure does not mutate discovery run status', async () => {
    const failingAdapter = createFakeNotificationAdapter({
      failWith: { ok: false, code: 'DELIVERY_FAILED', message: 'down' },
    });
    const clock = createFakeClock('2026-08-31T10:00:00.000Z');
    const service = createDiscoveryNotificationService({
      store: createInMemoryNotificationStore(),
      adapter: failingAdapter,
      clock,
    });
    const { worker, runStore } = await seedWorkerJob(
      pipelineExecutor('SUCCESS', sampleDigest()),
      service
    );
    const result = await worker.processNext();
    expect(result).toMatchObject({ pipelineStatus: 'SUCCESS' });
    const run = await runStore.get('run-1');
    expect(run?.status).toBe('SUCCESS');
  });

  it('repeated worker processing does not duplicate notifications', async () => {
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
    const digest = sampleDigest();
    const executor = pipelineExecutor('SUCCESS', digest);

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
      resolveNotificationTarget: () => ({ recipient, channel: 'EMAIL' }),
    });

    await worker.processNext();
    await service.deliverDigest({ digest, recipient, channel: 'EMAIL' });
    expect(adapter.sent).toHaveLength(1);
  });
});

describe('E7.4 notification → NOTIFIED write-back', () => {
  async function seedDigestResults(
    resultStore: ReturnType<typeof createInMemoryResultStore>
  ) {
    await resultStore.create(sampleResultForDigest('result-a'));
    await resultStore.create(sampleResultForDigest('result-b'));
  }

  it('successful delivery marks digest results as NOTIFIED', async () => {
    const resultStore = createInMemoryResultStore();
    await seedDigestResults(resultStore);
    const { service } = serviceHarness({
      resultStore,
      withResultStateWriter: true,
    });
    const digest = sampleDigest();

    const outcome = await service.deliverDigest({ digest, recipient, channel: 'EMAIL' });
    expect(outcome.kind).toBe('delivered');

    expect((await resultStore.getById!('profile-job', 'result-a'))?.userState).toBe(
      'NOTIFIED'
    );
    expect((await resultStore.getById!('profile-job', 'result-b'))?.userState).toBe(
      'NOTIFIED'
    );
    expect(resultStore.size()).toBe(2);
  });

  it('failed delivery does not mark results as NOTIFIED', async () => {
    const resultStore = createInMemoryResultStore();
    await seedDigestResults(resultStore);
    const adapter = createFakeNotificationAdapter({
      failWith: { ok: false, code: 'DELIVERY_FAILED', message: 'provider down' },
    });
    const { service } = serviceHarness({
      adapter,
      resultStore,
      withResultStateWriter: true,
    });
    const digest = sampleDigest();

    const outcome = await service.deliverDigest({ digest, recipient, channel: 'EMAIL' });
    expect(outcome.kind).toBe('failed');
    expect((await resultStore.getById!('profile-job', 'result-a'))?.userState).toBe('NEW');
    expect((await resultStore.getById!('profile-job', 'result-b'))?.userState).toBe('NEW');
  });

  it('empty digest skips delivery and leaves result state unchanged', async () => {
    const resultStore = createInMemoryResultStore();
    await resultStore.create(sampleResultForDigest('result-a'));
    const { service, adapter } = serviceHarness({
      resultStore,
      withResultStateWriter: true,
    });
    const digest = sampleDigest({
      entries: [],
      resultIds: [],
      summary: {
        totalResults: 0,
        newResults: 0,
        updatedResults: 0,
        unchangedResults: 0,
        notifiedResults: 0,
      },
    });

    const outcome = await service.deliverDigest({ digest, recipient, channel: 'EMAIL' });
    expect(outcome).toEqual({ kind: 'skipped', reason: 'empty_digest' });
    expect(adapter.sent).toHaveLength(0);
    expect((await resultStore.getById!('profile-job', 'result-a'))?.userState).toBe('NEW');
  });

  it('duplicate delivery is idempotent and does not regress NOTIFIED state', async () => {
    const resultStore = createInMemoryResultStore();
    await seedDigestResults(resultStore);
    const { service, adapter } = serviceHarness({
      resultStore,
      withResultStateWriter: true,
    });
    const digest = sampleDigest();

    const first = await service.deliverDigest({ digest, recipient, channel: 'EMAIL' });
    const second = await service.deliverDigest({ digest, recipient, channel: 'EMAIL' });
    expect(first.kind).toBe('delivered');
    expect(second).toEqual({ kind: 'skipped', reason: 'already_delivered' });
    expect(adapter.sent).toHaveLength(1);
    expect(resultStore.size()).toBe(2);
    expect((await resultStore.getById!('profile-job', 'result-a'))?.userState).toBe(
      'NOTIFIED'
    );
  });
});
