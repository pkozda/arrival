import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AdapterFailureError,
  computeBackoffDelayMs,
  createDefaultExecutionRetryPolicy,
  createDiscoveryExecutionWorker,
  createFakeClock,
  createInMemoryExecutionQueue,
  createInMemoryRunStore,
  createInMemoryScheduleStore,
  createSqliteExecutionQueue,
  isRetryableAdapterFailure,
  toExecutionAdapterFailure,
  type AdapterFailure,
  type DiscoveryRunExecutor,
  type PipelineExecuteResult,
} from '../index.js';

function failure(
  code: AdapterFailure['code'],
  overrides: Partial<AdapterFailure> = {}
): AdapterFailure {
  return {
    code,
    message: `${code} failure`,
    adapter: 'test',
    operation: 'op',
    ...overrides,
  };
}

describe('E5.4 execution retry policy', () => {
  const policy = createDefaultExecutionRetryPolicy({
    maxAttempts: 3,
    baseDelayMs: 1_000,
    maxDelayMs: 8_000,
  });
  const now = '2026-08-31T10:00:00.000Z';

  it.each([
    'TIMEOUT',
    'NETWORK_ERROR',
    'UNAVAILABLE',
    'RATE_LIMITED',
  ] as const)('retries %s', (code) => {
    expect(isRetryableAdapterFailure(failure(code))).toBe(true);
    const d = policy.decide({ failure: failure(code), attempt: 1, now });
    expect(d).toMatchObject({
      kind: 'retry',
      nextAttempt: 2,
      delayMs: 1_000,
      diagnostic: 'RETRY_SCHEDULED',
      failureCode: code,
    });
  });

  it.each([
    'AUTH_REQUIRED',
    'POLICY_BLOCKED',
    'INVALID_RESPONSE',
    'AI_OUTPUT_INVALID',
  ] as const)('does not retry %s', (code) => {
    expect(isRetryableAdapterFailure(failure(code))).toBe(false);
    expect(
      policy.decide({ failure: failure(code), attempt: 1, now })
    ).toMatchObject({
      kind: 'no_retry',
      reason: 'not_retryable',
      diagnostic: 'RETRY_NOT_ALLOWED',
    });
  });

  it('never retries CANCELLED', () => {
    expect(
      policy.decide({
        failure: failure('CANCELLED', { retryable: true }),
        attempt: 1,
        now,
      })
    ).toMatchObject({ kind: 'no_retry', reason: 'cancelled' });
  });

  it('UNKNOWN only when retryable=true', () => {
    expect(isRetryableAdapterFailure(failure('UNKNOWN'))).toBe(false);
    expect(
      isRetryableAdapterFailure(failure('UNKNOWN', { retryable: true }))
    ).toBe(true);
  });

  it('exhausts at maxAttempts', () => {
    expect(
      policy.decide({ failure: failure('TIMEOUT'), attempt: 3, now })
    ).toMatchObject({
      kind: 'no_retry',
      reason: 'retry_exhausted',
      diagnostic: 'RETRY_EXHAUSTED',
    });
  });

  it('exponential backoff with max delay cap', () => {
    expect(computeBackoffDelayMs(1, 1_000, 8_000)).toBe(1_000);
    expect(computeBackoffDelayMs(2, 1_000, 8_000)).toBe(2_000);
    expect(computeBackoffDelayMs(3, 1_000, 8_000)).toBe(4_000);
    expect(computeBackoffDelayMs(4, 1_000, 8_000)).toBe(8_000);
    expect(computeBackoffDelayMs(5, 1_000, 8_000)).toBe(8_000);

    const d2 = policy.decide({
      failure: failure('TIMEOUT'),
      attempt: 2,
      now,
    });
    expect(d2).toMatchObject({ kind: 'retry', delayMs: 2_000 });
  });

  it('toExecutionAdapterFailure preserves AdapterFailureError', () => {
    const err = new AdapterFailureError(failure('TIMEOUT', { retryable: true }));
    expect(toExecutionAdapterFailure(err).code).toBe('TIMEOUT');
    expect(toExecutionAdapterFailure(new Error('boom')).retryable).toBe(false);
  });
});

describe('E5.4 queue retry', () => {
  it('RUNNING → QUEUED preserves ids, increments attempt, gates on availableAt', async () => {
    const clock = createFakeClock('2026-08-31T10:00:00.000Z');
    const queue = createInMemoryExecutionQueue([], { clock });
    await queue.enqueue({
      jobId: 'job-1',
      runId: 'run-1',
      scheduleId: 'sched-1',
      profileId: 'profile-1',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      trigger: 'scheduled',
      requestedAt: '2026-08-31T10:00:00.000Z',
    });
    const running = await queue.dequeue({ claimOwner: 'worker-A' });
    expect(running?.attempt).toBe(1);

    await queue.retry(
      'job-1',
      '2026-08-31T10:00:05.000Z',
      'TIMEOUT',
      {
        claimOwner: 'worker-A',
        metadata: { lastFailureCode: 'TIMEOUT' },
      }
    );
    const queued = await queue.get('job-1');
    expect(queued).toMatchObject({
      status: 'QUEUED',
      jobId: 'job-1',
      runId: 'run-1',
      attempt: 2,
      availableAt: '2026-08-31T10:00:05.000Z',
    });
    expect(await queue.hasActiveRun('run-1')).toBe(true);
    expect(await queue.dequeue({ claimOwner: 'worker-A' })).toBeNull();

    clock.set('2026-08-31T10:00:05.000Z');
    const again = await queue.dequeue({ claimOwner: 'worker-B' });
    expect(again).toMatchObject({ jobId: 'job-1', runId: 'run-1', attempt: 2 });
  });

  it('sqlite retry persists across restart', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'discovery-e54-'));
    const dbPath = path.join(dir, 'queue.sqlite');
    const clock = createFakeClock('2026-08-31T10:00:00.000Z');
    const a = createSqliteExecutionQueue({
      databasePath: dbPath,
      clock,
      recoverOnOpen: false,
    });
    await a.enqueue({
      jobId: 'job-1',
      runId: 'run-1',
      scheduleId: 'sched-1',
      profileId: 'profile-1',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      trigger: 'scheduled',
      requestedAt: '2026-08-31T10:00:00.000Z',
    });
    await a.dequeue({ claimOwner: 'worker-A' });
    await a.retry('job-1', '2026-08-31T10:00:10.000Z', 'NETWORK_ERROR', {
      claimOwner: 'worker-A',
      metadata: { lastFailureCode: 'NETWORK_ERROR' },
    });
    a.close();

    clock.set('2026-08-31T10:00:10.000Z');
    const b = createSqliteExecutionQueue({
      databasePath: dbPath,
      clock,
      recoverOnOpen: false,
    });
    try {
      const pending = await b.getPending();
      expect(pending[0]).toMatchObject({
        jobId: 'job-1',
        runId: 'run-1',
        attempt: 2,
        status: 'QUEUED',
      });
      const job = await b.dequeue({ claimOwner: 'worker-B' });
      expect(job?.runId).toBe('run-1');
      expect(job?.attempt).toBe(2);
    } finally {
      b.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('E5.4 worker retry orchestration', () => {
  function successResult(runId: string): PipelineExecuteResult {
    return {
      run: {
        id: runId,
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
  }

  it('retryable failure schedules retry; success ACKs; exhaustion fails', async () => {
    const clock = createFakeClock('2026-08-31T10:00:00.000Z');
    const queue = createInMemoryExecutionQueue([], { clock });
    const scheduleStore = createInMemoryScheduleStore([
      {
        scheduleId: 'sched-1',
        profileId: 'profile-1',
        strategyId: 'job-discovery',
        strategyVersion: '1',
        enabled: true,
        interval: { kind: 'fixed_interval', intervalSeconds: 3600 },
        timezone: 'UTC',
        nextRunAt: '2026-08-31T11:00:00.000Z',
        runningRunId: 'run-1',
        createdAt: '2026-08-31T09:00:00.000Z',
        updatedAt: '2026-08-31T10:00:00.000Z',
      },
    ]);
    const runStore = createInMemoryRunStore([
      {
        runId: 'run-1',
        scheduleId: 'sched-1',
        profileId: 'profile-1',
        trigger: 'scheduled',
        startedAt: '2026-08-31T10:00:00.000Z',
        status: 'PENDING',
      },
    ]);

    let calls = 0;
    const executor: DiscoveryRunExecutor = {
      async execute() {
        calls += 1;
        if (calls < 3) {
          throw new AdapterFailureError(
            failure('TIMEOUT', { retryable: true })
          );
        }
        return successResult('run-1');
      },
    };

    const worker = createDiscoveryExecutionWorker({
      queue,
      executor,
      runStore,
      scheduleStore,
      clock,
      workerId: 'worker-A',
      retryConfig: { maxAttempts: 3, baseDelayMs: 1_000, maxDelayMs: 60_000 },
    });

    await queue.enqueue({
      jobId: 'job-1',
      runId: 'run-1',
      scheduleId: 'sched-1',
      profileId: 'profile-1',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      trigger: 'scheduled',
      requestedAt: '2026-08-31T10:00:00.000Z',
    });

    const r1 = await worker.processNext();
    expect(r1).toMatchObject({
      kind: 'retry_scheduled',
      runId: 'run-1',
      attempt: 2,
      failureCode: 'TIMEOUT',
    });
    expect((await scheduleStore.get('sched-1'))?.runningRunId).toBe('run-1');
    expect((await scheduleStore.get('sched-1'))?.nextRunAt).toBe(
      '2026-08-31T11:00:00.000Z'
    );
    expect((await runStore.get('run-1'))?.finishedAt).toBeUndefined();

    clock.set('2026-08-31T10:00:01.000Z');
    const r2 = await worker.processNext();
    expect(r2).toMatchObject({ kind: 'retry_scheduled', attempt: 3 });

    clock.set('2026-08-31T10:00:03.000Z');
    const r3 = await worker.processNext();
    expect(r3).toMatchObject({
      kind: 'processed',
      pipelineStatus: 'SUCCESS',
      runId: 'run-1',
    });
    expect((await queue.get('job-1'))?.status).toBe('COMPLETED');
    expect((await scheduleStore.get('sched-1'))?.runningRunId).toBeNull();
  });

  it('non-retryable failure terminally fails without Result/notification side effects', async () => {
    const clock = createFakeClock('2026-08-31T10:00:00.000Z');
    const queue = createInMemoryExecutionQueue([], { clock });
    const scheduleStore = createInMemoryScheduleStore([
      {
        scheduleId: 'sched-1',
        profileId: 'profile-1',
        strategyId: 'job-discovery',
        strategyVersion: '1',
        enabled: true,
        interval: { kind: 'fixed_interval', intervalSeconds: 3600 },
        timezone: 'UTC',
        nextRunAt: '2026-08-31T11:00:00.000Z',
        runningRunId: 'run-1',
        createdAt: '2026-08-31T09:00:00.000Z',
        updatedAt: '2026-08-31T10:00:00.000Z',
      },
    ]);
    const runStore = createInMemoryRunStore([
      {
        runId: 'run-1',
        scheduleId: 'sched-1',
        profileId: 'profile-1',
        trigger: 'manual',
        startedAt: '2026-08-31T10:00:00.000Z',
        status: 'PENDING',
      },
    ]);

    const worker = createDiscoveryExecutionWorker({
      queue,
      executor: {
        async execute() {
          throw new AdapterFailureError(failure('AUTH_REQUIRED'));
        },
      },
      runStore,
      scheduleStore,
      clock,
      workerId: 'worker-A',
    });

    await queue.enqueue({
      jobId: 'job-1',
      runId: 'run-1',
      scheduleId: 'sched-1',
      profileId: 'profile-1',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      trigger: 'manual',
      requestedAt: '2026-08-31T10:00:00.000Z',
    });

    const result = await worker.processNext();
    expect(result).toMatchObject({
      kind: 'processed',
      pipelineStatus: 'FAILED',
    });
    expect((await queue.get('job-1'))?.status).toBe('FAILED');
    expect((await runStore.get('run-1'))?.status).toBe('FAILED');
    expect((await scheduleStore.get('sched-1'))?.runningRunId).toBeNull();
  });

  it('PARTIAL_SUCCESS is not auto-retried', async () => {
    const clock = createFakeClock('2026-08-31T10:00:00.000Z');
    const queue = createInMemoryExecutionQueue([], { clock });
    const scheduleStore = createInMemoryScheduleStore([
      {
        scheduleId: 'sched-1',
        profileId: 'profile-1',
        strategyId: 'job-discovery',
        strategyVersion: '1',
        enabled: true,
        interval: { kind: 'fixed_interval', intervalSeconds: 3600 },
        timezone: 'UTC',
        nextRunAt: '2026-08-31T11:00:00.000Z',
        runningRunId: 'run-1',
        createdAt: '2026-08-31T09:00:00.000Z',
        updatedAt: '2026-08-31T10:00:00.000Z',
      },
    ]);
    const runStore = createInMemoryRunStore([
      {
        runId: 'run-1',
        scheduleId: 'sched-1',
        profileId: 'profile-1',
        trigger: 'scheduled',
        startedAt: '2026-08-31T10:00:00.000Z',
        status: 'PENDING',
      },
    ]);

    const worker = createDiscoveryExecutionWorker({
      queue,
      executor: {
        async execute() {
          const r = successResult('run-1');
          return {
            ...r,
            run: { ...r.run, status: 'PARTIAL_SUCCESS' },
          };
        },
      },
      runStore,
      scheduleStore,
      clock,
    });

    await queue.enqueue({
      jobId: 'job-1',
      runId: 'run-1',
      scheduleId: 'sched-1',
      profileId: 'profile-1',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      trigger: 'scheduled',
      requestedAt: '2026-08-31T10:00:00.000Z',
    });

    expect(await worker.processNext()).toMatchObject({
      kind: 'processed',
      pipelineStatus: 'PARTIAL_SUCCESS',
    });
    expect((await queue.get('job-1'))?.status).toBe('COMPLETED');
  });

  it('failed job does not block next job', async () => {
    const clock = createFakeClock('2026-08-31T10:00:00.000Z');
    const queue = createInMemoryExecutionQueue([], { clock });
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
        runningRunId: 'run-a',
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
        runningRunId: 'run-b',
        createdAt: '2026-08-31T09:00:00.000Z',
        updatedAt: '2026-08-31T10:00:00.000Z',
      },
    ]);
    const runStore = createInMemoryRunStore([
      {
        runId: 'run-a',
        scheduleId: 'sched-a',
        profileId: 'profile-1',
        trigger: 'scheduled',
        startedAt: '2026-08-31T10:00:00.000Z',
        status: 'PENDING',
      },
      {
        runId: 'run-b',
        scheduleId: 'sched-b',
        profileId: 'profile-1',
        trigger: 'scheduled',
        startedAt: '2026-08-31T10:00:00.000Z',
        status: 'PENDING',
      },
    ]);

    const worker = createDiscoveryExecutionWorker({
      queue,
      executor: {
        async execute(req) {
          if (req.runId === 'run-a') {
            throw new AdapterFailureError(failure('AUTH_REQUIRED'));
          }
          return successResult(req.runId);
        },
      },
      runStore,
      scheduleStore,
      clock,
    });

    await queue.enqueue({
      jobId: 'job-a',
      runId: 'run-a',
      scheduleId: 'sched-a',
      profileId: 'profile-1',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      trigger: 'scheduled',
      requestedAt: '2026-08-31T10:00:00.000Z',
    });
    await queue.enqueue({
      jobId: 'job-b',
      runId: 'run-b',
      scheduleId: 'sched-b',
      profileId: 'profile-1',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      trigger: 'scheduled',
      requestedAt: '2026-08-31T10:00:00.000Z',
    });

    expect(await worker.processNext()).toMatchObject({
      pipelineStatus: 'FAILED',
      runId: 'run-a',
    });
    expect(await worker.processNext()).toMatchObject({
      pipelineStatus: 'SUCCESS',
      runId: 'run-b',
    });
  });
});
