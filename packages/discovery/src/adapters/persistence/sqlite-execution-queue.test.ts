import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createFakeClock,
  createInMemoryProfileStore,
  createInMemoryRunStore,
  createInMemoryScheduleStore,
  createPipelineRunExecutor,
  createDiscoveryExecutionWorker,
  createDiscoveryScheduler,
  createIncrementingJobIdGenerator,
  createIncrementingRunIdGenerator,
  createSqliteExecutionQueue,
  createStrategyRegistry,
  emptyCriteria,
  jobDiscoveryStrategyV1,
  QueueError,
  type DiscoveryProfile,
  type DiscoveryStrategyModule,
  type EnqueueJobInput,
} from '../../index.js';

const SECRET = 'sk-openai-must-never-appear-in-queue';

function tempDb(): { path: string; cleanup(): void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'discovery-e52-q-'));
  return {
    path: path.join(dir, 'queue.sqlite'),
    cleanup() {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    },
  };
}

function baseInput(overrides: Partial<EnqueueJobInput> = {}): EnqueueJobInput {
  return {
    jobId: 'job-1',
    runId: 'run-1',
    scheduleId: 'sched-1',
    profileId: 'profile-1',
    strategyId: 'job-discovery',
    strategyVersion: '1',
    trigger: 'scheduled',
    requestedAt: '2026-08-31T10:00:00.000Z',
    ...overrides,
  };
}

describe('E5.2 durable SQLite execution queue', () => {
  it('enqueue survives restart', async () => {
    const db = tempDb();
    const clock = createFakeClock('2026-08-31T10:00:00.000Z');
    const a = createSqliteExecutionQueue({
      databasePath: db.path,
      clock,
      recoverOnOpen: false,
    });
    await a.enqueue(baseInput());
    expect(await a.getPending()).toHaveLength(1);
    a.close();

    const b = createSqliteExecutionQueue({
      databasePath: db.path,
      clock,
      recoverOnOpen: false,
    });
    try {
      expect(await b.getPending()).toHaveLength(1);
      expect((await b.get('job-1'))?.runId).toBe('run-1');
    } finally {
      b.close();
      db.cleanup();
    }
  });

  it('jobId and runId uniqueness', async () => {
    const db = tempDb();
    const clock = createFakeClock('2026-08-31T10:00:00.000Z');
    const queue = createSqliteExecutionQueue({
      databasePath: db.path,
      clock,
      recoverOnOpen: false,
    });
    try {
      expect((await queue.enqueue(baseInput())).ok).toBe(true);
      expect(await queue.enqueue(baseInput({ jobId: 'job-2' }))).toEqual({
        ok: false,
        reason: 'duplicate_run_id',
      });
      expect(await queue.enqueue(baseInput({ runId: 'run-2' }))).toEqual({
        ok: false,
        reason: 'duplicate_job_id',
      });
    } finally {
      queue.close();
      db.cleanup();
    }
  });

  it('QUEUED → RUNNING claim records owner and timestamp', async () => {
    const db = tempDb();
    const clock = createFakeClock('2026-08-31T10:00:00.000Z');
    const queue = createSqliteExecutionQueue({
      databasePath: db.path,
      clock,
      recoverOnOpen: false,
    });
    try {
      await queue.enqueue(baseInput());
      const job = await queue.dequeue({ claimOwner: 'worker-A' });
      expect(job?.status).toBe('RUNNING');
      expect(job?.claimOwner).toBe('worker-A');
      expect(job?.claimedAt).toBe('2026-08-31T10:00:00.000Z');
      expect(await queue.dequeue({ claimOwner: 'worker-B' })).toBeNull();
    } finally {
      queue.close();
      db.cleanup();
    }
  });

  it('active claim is not recovered before expiry; expired claim is recovered', async () => {
    const db = tempDb();
    const clock = createFakeClock('2026-08-31T10:00:00.000Z');
    const queue = createSqliteExecutionQueue({
      databasePath: db.path,
      clock,
      visibilityTimeoutMs: 60_000,
      recoverOnOpen: false,
    });
    try {
      await queue.enqueue(baseInput());
      await queue.dequeue({ claimOwner: 'worker-A' });

      clock.set('2026-08-31T10:00:30.000Z');
      expect(
        (await queue.recoverExpiredClaims(clock.now().toISOString())).recoveredJobIds
      ).toHaveLength(0);

      clock.set('2026-08-31T10:01:01.000Z');
      const recovered = await queue.recoverExpiredClaims(clock.now().toISOString());
      expect(recovered.recoveredJobIds).toEqual(['job-1']);
      const pending = await queue.get('job-1');
      expect(pending?.status).toBe('QUEUED');
      expect(pending?.attempt).toBe(2);
      expect(pending?.claimOwner).toBeUndefined();
      expect(pending?.runId).toBe('run-1');
    } finally {
      queue.close();
      db.cleanup();
    }
  });

  it('wrong claimant cannot ACK or FAIL; stale claimant cannot mutate reclaimed job', async () => {
    const db = tempDb();
    const clock = createFakeClock('2026-08-31T10:00:00.000Z');
    const queue = createSqliteExecutionQueue({
      databasePath: db.path,
      clock,
      visibilityTimeoutMs: 1_000,
      recoverOnOpen: false,
    });
    try {
      await queue.enqueue(baseInput());
      await queue.dequeue({ claimOwner: 'worker-A' });

      await expect(
        queue.ack('job-1', '2026-08-31T10:00:00.000Z', { claimOwner: 'worker-B' })
      ).rejects.toBeInstanceOf(QueueError);
      await expect(
        queue.fail('job-1', '2026-08-31T10:00:00.000Z', 'x', {
          claimOwner: 'worker-B',
        })
      ).rejects.toBeInstanceOf(QueueError);

      clock.set('2026-08-31T10:00:02.000Z');
      await queue.recoverExpiredClaims(clock.now().toISOString());
      const reclaimed = await queue.dequeue({ claimOwner: 'worker-B' });
      expect(reclaimed?.claimOwner).toBe('worker-B');

      await expect(
        queue.ack('job-1', clock.now().toISOString(), { claimOwner: 'worker-A' })
      ).rejects.toBeInstanceOf(QueueError);

      await queue.ack('job-1', clock.now().toISOString(), {
        claimOwner: 'worker-B',
      });
      expect((await queue.get('job-1'))?.status).toBe('COMPLETED');
    } finally {
      queue.close();
      db.cleanup();
    }
  });

  it('crash recovery reopens same runId for execution', async () => {
    const db = tempDb();
    const clock = createFakeClock('2026-08-31T10:00:00.000Z');
    const a = createSqliteExecutionQueue({
      databasePath: db.path,
      clock,
      visibilityTimeoutMs: 1_000,
      recoverOnOpen: false,
    });
    await a.enqueue(baseInput());
    await a.dequeue({ claimOwner: 'worker-A' });
    a.close(); // crash while RUNNING

    clock.set('2026-08-31T10:00:05.000Z');
    const b = createSqliteExecutionQueue({
      databasePath: db.path,
      clock,
      visibilityTimeoutMs: 1_000,
      recoverOnOpen: true,
    });
    try {
      const pending = await b.getPending();
      expect(pending).toHaveLength(1);
      expect(pending[0]?.runId).toBe('run-1');
      expect(pending[0]?.attempt).toBe(2);
      const job = await b.dequeue({ claimOwner: 'worker-B' });
      expect(job?.runId).toBe('run-1');
      await b.ack(job!.jobId, clock.now().toISOString(), {
        claimOwner: 'worker-B',
      });
    } finally {
      b.close();
      db.cleanup();
    }
  });

  it('persisted JSON contains no API secrets', async () => {
    const db = tempDb();
    const clock = createFakeClock('2026-08-31T10:00:00.000Z');
    const queue = createSqliteExecutionQueue({
      databasePath: db.path,
      clock,
      recoverOnOpen: false,
    });
    try {
      await queue.enqueue(
        baseInput({
          metadata: { note: 'safe', hint: 'no-secrets' },
        })
      );
      const raw = queue.dumpPayloadJson('job-1');
      expect(raw).toBeTruthy();
      expect(raw).not.toContain(SECRET);
      expect(raw).not.toContain('Authorization');
      expect(raw).not.toContain('apiKey');
      expect(raw).not.toContain('Bearer');
    } finally {
      queue.close();
      db.cleanup();
    }
  });

  it('terminal COMPLETED job is not dequeued again', async () => {
    const db = tempDb();
    const clock = createFakeClock('2026-08-31T10:00:00.000Z');
    const queue = createSqliteExecutionQueue({
      databasePath: db.path,
      clock,
      recoverOnOpen: false,
    });
    try {
      await queue.enqueue(baseInput());
      const job = await queue.dequeue({ claimOwner: 'worker-A' });
      await queue.ack(job!.jobId, clock.now().toISOString(), {
        claimOwner: 'worker-A',
      });
      expect(await queue.dequeue({ claimOwner: 'worker-A' })).toBeNull();
      expect(await queue.hasActiveRun('run-1')).toBe(false);
    } finally {
      queue.close();
      db.cleanup();
    }
  });
});

describe('E5.2 worker + durable queue + scheduler lock', () => {
  function strategy(): DiscoveryStrategyModule {
    return {
      ...jobDiscoveryStrategyV1,
      async search() {
        return [];
      },
    };
  }

  function profile(): DiscoveryProfile {
    return {
      id: 'profile-1',
      userId: 'user-1',
      name: 'Jobs',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      criteria: emptyCriteria(),
      schedule: { cadence: 'manual' },
      notification: { emailEnabled: false, skipEmptyDigest: true },
      enabled: true,
      createdAt: '2026-08-30T00:00:00.000Z',
      updatedAt: '2026-08-30T00:00:00.000Z',
    };
  }

  it('recovered job executes; stale worker cannot clear newer lock', async () => {
    const db = tempDb();
    const clock = createFakeClock('2026-08-31T10:00:00.000Z');
    const queue = createSqliteExecutionQueue({
      databasePath: db.path,
      clock,
      visibilityTimeoutMs: 1_000,
      recoverOnOpen: false,
    });
    const scheduleStore = createInMemoryScheduleStore();
    const runStore = createInMemoryRunStore();
    const registry = createStrategyRegistry([strategy()]);
    const profileStore = createInMemoryProfileStore([profile()]);

    const scheduler = createDiscoveryScheduler({
      scheduleStore,
      runStore,
      queue,
      clock,
      runIdGenerator: createIncrementingRunIdGenerator('run'),
      jobIdGenerator: createIncrementingJobIdGenerator('job'),
    });

    await scheduler.registerSchedule({
      scheduleId: 'sched-1',
      profileId: 'profile-1',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      intervalSeconds: 3600,
      nextRunAt: '2026-08-31T10:00:00.000Z',
    });
    const enqueued = await scheduler.triggerDueRuns();
    expect(enqueued.outcomes[0]).toMatchObject({ kind: 'enqueued' });
    const runId = (enqueued.outcomes[0] as { runId: string }).runId;

    const workerA = createDiscoveryExecutionWorker({
      queue,
      executor: createPipelineRunExecutor({
        registry,
        profileStore,
        now: () => clock.now().toISOString(),
      }),
      runStore,
      scheduleStore,
      clock,
      workerId: 'worker-A',
    });

    // Claim without finishing (simulate crash mid-flight)
    const claimed = await queue.dequeue({ claimOwner: 'worker-A' });
    expect(claimed?.runId).toBe(runId);
    expect((await scheduleStore.get('sched-1'))?.runningRunId).toBe(runId);

    clock.set('2026-08-31T10:00:05.000Z');
    await queue.recoverExpiredClaims(clock.now().toISOString());

    const workerB = createDiscoveryExecutionWorker({
      queue,
      executor: createPipelineRunExecutor({
        registry,
        profileStore,
        now: () => clock.now().toISOString(),
      }),
      runStore,
      scheduleStore,
      clock,
      workerId: 'worker-B',
    });

    const result = await workerB.processNext();
    expect(result).toMatchObject({
      kind: 'processed',
      runId,
    });
    expect((await scheduleStore.get('sched-1'))?.runningRunId).toBeNull();

    // Stale clear for a different runId must not wipe a newer lock
    await scheduleStore.tryClaim('sched-1', 'run-newer', clock.now().toISOString(), {
      requireDue: false,
    });
    await scheduleStore.clearRunningLock('sched-1', clock.now().toISOString(), runId);
    expect((await scheduleStore.get('sched-1'))?.runningRunId).toBe('run-newer');

    queue.close();
    db.cleanup();
  });

  it('execution failure marks FAILED without blocking other jobs', async () => {
    const db = tempDb();
    const clock = createFakeClock('2026-08-31T10:00:00.000Z');
    const queue = createSqliteExecutionQueue({
      databasePath: db.path,
      clock,
      recoverOnOpen: false,
    });
    const scheduleStore = createInMemoryScheduleStore([
      {
        scheduleId: 'sched-a',
        profileId: 'profile-1',
        strategyId: 'job-discovery',
        strategyVersion: '1',
        enabled: true,
        interval: { kind: 'fixed_interval', intervalSeconds: 3600 },
        timezone: 'UTC',
        nextRunAt: '2026-08-31T11:00:00.000Z',
        runningRunId: 'run-fail',
        createdAt: '2026-08-31T09:00:00.000Z',
        updatedAt: '2026-08-31T10:00:00.000Z',
      },
      {
        scheduleId: 'sched-b',
        profileId: 'profile-1',
        strategyId: 'job-discovery',
        strategyVersion: '1',
        enabled: true,
        interval: { kind: 'fixed_interval', intervalSeconds: 3600 },
        timezone: 'UTC',
        nextRunAt: '2026-08-31T11:00:00.000Z',
        runningRunId: 'run-ok',
        createdAt: '2026-08-31T09:00:00.000Z',
        updatedAt: '2026-08-31T10:00:00.000Z',
      },
    ]);
    const runStore = createInMemoryRunStore([
      {
        runId: 'run-fail',
        scheduleId: 'sched-a',
        profileId: 'profile-1',
        trigger: 'scheduled',
        startedAt: '2026-08-31T10:00:00.000Z',
        status: 'PENDING',
      },
      {
        runId: 'run-ok',
        scheduleId: 'sched-b',
        profileId: 'profile-1',
        trigger: 'scheduled',
        startedAt: '2026-08-31T10:00:00.000Z',
        status: 'PENDING',
      },
    ]);

    await queue.enqueue(
      baseInput({ jobId: 'job-fail', runId: 'run-fail', scheduleId: 'sched-a' })
    );
    await queue.enqueue(
      baseInput({
        jobId: 'job-ok',
        runId: 'run-ok',
        scheduleId: 'sched-b',
        requestedAt: '2026-08-31T10:00:00.000Z',
      })
    );

    let calls = 0;
    const worker = createDiscoveryExecutionWorker({
      queue,
      executor: {
        async execute(req) {
          calls += 1;
          if (calls === 1) throw new Error('boom');
          return {
            run: {
              id: req.runId,
              profileId: 'profile-1',
              strategyId: 'job-discovery',
              strategyVersion: '1',
              criteriaSnapshot: {
                required: [],
                preferred: [],
                excluded: [],
                flexible: [],
              },
              startedAt: '2026-08-31T10:00:00.000Z',
              finishedAt: '2026-08-31T10:00:01.000Z',
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
          };
        },
      },
      runStore,
      scheduleStore,
      clock,
      workerId: 'worker-A',
    });

    const first = await worker.processNext();
    expect(first).toMatchObject({ kind: 'processed', pipelineStatus: 'FAILED' });
    expect((await queue.get('job-fail'))?.status).toBe('FAILED');

    const second = await worker.processNext();
    expect(second).toMatchObject({ kind: 'processed', pipelineStatus: 'SUCCESS' });
    expect((await queue.get('job-ok'))?.status).toBe('COMPLETED');

    queue.close();
    db.cleanup();
  });
});
