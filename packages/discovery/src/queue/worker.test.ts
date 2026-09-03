import { describe, expect, it } from 'vitest';
import {
  createDiscoveryExecutionWorker,
  createFakeClock,
  createInMemoryExecutionQueue,
  createInMemoryRunStore,
  createInMemoryScheduleStore,
  parseDiscoveryRunFunnelDiagnostics,
  FUNNEL_METADATA_KEY,
  type DiscoveryRunExecutor,
  type PipelineExecuteResult,
} from '../index.js';

function fakeExecutor(
  handler: (req: { runId: string; scheduleId: string }) => PipelineExecuteResult | Promise<PipelineExecuteResult>
): DiscoveryRunExecutor {
  return {
    async execute(request) {
      return handler(request);
    },
  };
}

function successPipeline(runId: string, profileId: string, status: PipelineExecuteResult['run']['status'] = 'SUCCESS'): PipelineExecuteResult {
  return {
    run: {
      id: runId,
      profileId,
      strategyId: 'job-discovery',
      strategyVersion: '1',
      criteriaSnapshot: { required: [], preferred: [], excluded: [], flexible: [] },
      startedAt: '2026-08-31T10:00:00.000Z',
      finishedAt: '2026-08-31T10:00:05.000Z',
      status,
      stats: {
        candidatesFound: 1,
        candidatesRejected: 0,
        candidatesVerified: 1,
        resultsCreated: 1,
        resultsUpdated: 0,
      },
    },
    batch: { active: [], rejected: [] },
    stageOrder: ['resolve_snapshot'],
    stageDiagnostics: [],
    queries: [],
  };
}

describe('E4.3 discovery execution worker', () => {
  function harness(opts?: { executor?: DiscoveryRunExecutor }) {
    const clock = createFakeClock('2026-08-31T10:00:00.000Z');
    const queue = createInMemoryExecutionQueue();
    const runStore = createInMemoryRunStore();
    const scheduleStore = createInMemoryScheduleStore();
    const executor =
      opts?.executor ??
      fakeExecutor((req) => successPipeline(req.runId, 'profile-job'));
    const worker = createDiscoveryExecutionWorker({
      queue,
      executor,
      runStore,
      scheduleStore,
      clock,
    });
    return { clock, queue, runStore, scheduleStore, worker };
  }

  async function seedJob(
    queue: ReturnType<typeof createInMemoryExecutionQueue>,
    runStore: ReturnType<typeof createInMemoryRunStore>,
    scheduleStore: ReturnType<typeof createInMemoryScheduleStore>,
    runId: string,
    jobId: string,
    metadata?: Record<string, string>
  ) {
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
      runningRunId: runId,
    });
    await runStore.insert({
      runId,
      scheduleId: 'sched-1',
      profileId: 'profile-job',
      trigger: 'scheduled',
      startedAt: '2026-08-31T10:00:00.000Z',
      status: 'PENDING',
    });
    await queue.enqueue({
      jobId,
      runId,
      scheduleId: 'sched-1',
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      trigger: 'scheduled',
      requestedAt: '2026-08-31T10:00:00.000Z',
      metadata,
    });
  }

  it('processes queued job via executor', async () => {
    const { queue, runStore, scheduleStore, worker } = harness();
    await seedJob(queue, runStore, scheduleStore, 'run-1', 'job-1');

    const result = await worker.processNext();
    expect(result).toMatchObject({
      kind: 'processed',
      jobId: 'job-1',
      runId: 'run-1',
      pipelineStatus: 'SUCCESS',
    });
    const job = await queue.get('job-1');
    expect(job?.status).toBe('COMPLETED');
  });

  it('successful executor acks job and clears schedule lock', async () => {
    const { queue, runStore, scheduleStore, worker } = harness();
    await seedJob(queue, runStore, scheduleStore, 'run-1', 'job-1');
    await worker.processNext();
    const schedule = await scheduleStore.get('sched-1');
    expect(schedule?.runningRunId).toBeNull();
    const job = await queue.get('job-1');
    expect(job?.status).toBe('COMPLETED');
  });

  it('failed executor marks job failed', async () => {
    const { queue, runStore, scheduleStore, worker } = harness({
      executor: fakeExecutor(() => {
        throw new Error('boom');
      }),
    });
    await seedJob(queue, runStore, scheduleStore, 'run-1', 'job-1');
    const result = await worker.processNext();
    expect(result).toMatchObject({ kind: 'processed', pipelineStatus: 'FAILED' });
    const job = await queue.get('job-1');
    expect(job?.status).toBe('FAILED');
    expect(job?.failureReason).toMatch(/boom/);
    const run = await runStore.get('run-1');
    expect(run?.status).toBe('FAILED');
  });

  it('continues after one failed job', async () => {
    let calls = 0;
    const { queue, runStore, scheduleStore, worker } = harness({
      executor: fakeExecutor((req) => {
        calls += 1;
        if (req.runId === 'run-fail') throw new Error('fail');
        return successPipeline(req.runId, 'profile-job');
      }),
    });

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
      runningRunId: 'run-fail',
    });
    await runStore.insert({
      runId: 'run-fail',
      scheduleId: 'sched-1',
      profileId: 'profile-job',
      trigger: 'scheduled',
      startedAt: '2026-08-31T10:00:00.000Z',
      status: 'PENDING',
    });
    await queue.enqueue({
      jobId: 'job-fail',
      runId: 'run-fail',
      scheduleId: 'sched-1',
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      trigger: 'scheduled',
      requestedAt: '2026-08-31T10:00:00.000Z',
    });

    await scheduleStore.upsert({
      ...(await scheduleStore.get('sched-1'))!,
      runningRunId: 'run-ok',
    });
    await runStore.insert({
      runId: 'run-ok',
      scheduleId: 'sched-1',
      profileId: 'profile-job',
      trigger: 'scheduled',
      startedAt: '2026-08-31T10:00:01.000Z',
      status: 'PENDING',
    });
    await queue.enqueue({
      jobId: 'job-ok',
      runId: 'run-ok',
      scheduleId: 'sched-1',
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      trigger: 'scheduled',
      requestedAt: '2026-08-31T10:00:01.000Z',
    });

    await worker.processNext();
    await worker.processNext();
    expect(calls).toBe(2);
    expect((await queue.get('job-ok'))?.status).toBe('COMPLETED');
    expect((await queue.get('job-fail'))?.status).toBe('FAILED');
  });

  it('passes runId unchanged to executor', async () => {
    const seen: string[] = [];
    const { queue, runStore, scheduleStore, worker } = harness({
      executor: fakeExecutor((req) => {
        seen.push(req.runId);
        return successPipeline(req.runId, 'profile-job');
      }),
    });
    await seedJob(queue, runStore, scheduleStore, 'run-exact', 'job-1');
    await worker.processNext();
    expect(seen).toEqual(['run-exact']);
  });

  it('jobId and runId remain distinct', async () => {
    const { queue, runStore, scheduleStore, worker } = harness();
    await seedJob(queue, runStore, scheduleStore, 'run-abc', 'job-xyz');
    const result = await worker.processNext();
    expect(result).toMatchObject({ jobId: 'job-xyz', runId: 'run-abc' });
  });

  it('stores funnel diagnostics in job metadata on completion', async () => {
    const { queue, runStore, scheduleStore, worker } = harness({
      executor: fakeExecutor((req) => ({
        ...successPipeline(req.runId, 'profile-job'),
        queries: [{ id: 'q1', intent: 'web_search', text: 'engineer hiring DE' }],
      })),
    });
    await seedJob(queue, runStore, scheduleStore, 'run-funnel', 'job-funnel', {
      existingKey: 'keep-me',
    });
    await worker.processNext();
    const job = await queue.get('job-funnel');
    expect(job?.metadata?.existingKey).toBe('keep-me');
    const funnel = parseDiscoveryRunFunnelDiagnostics(job?.metadata?.[FUNNEL_METADATA_KEY]);
    expect(funnel?.queries).toEqual([{ id: 'q1', text: 'engineer hiring DE' }]);
    expect(funnel?.stats.candidatesFound).toBe(1);
  });

  it('does not re-execute already-finished run', async () => {
    let calls = 0;
    const { queue, runStore, scheduleStore, worker } = harness({
      executor: fakeExecutor((req) => {
        calls += 1;
        return successPipeline(req.runId, 'profile-job');
      }),
    });
    await runStore.insert({
      runId: 'run-done',
      scheduleId: 'sched-1',
      profileId: 'profile-job',
      trigger: 'scheduled',
      startedAt: '2026-08-31T10:00:00.000Z',
      finishedAt: '2026-08-31T10:00:05.000Z',
      status: 'SUCCESS',
    });
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
      runningRunId: 'run-done',
    });
    await queue.enqueue({
      jobId: 'job-done',
      runId: 'run-done',
      scheduleId: 'sched-1',
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      trigger: 'scheduled',
      requestedAt: '2026-08-31T10:00:00.000Z',
    });
    const dequeued = await queue.dequeue();
    const result = await worker.process(dequeued!.jobId);
    expect(result).toMatchObject({ kind: 'skipped', reason: 'run_already_finished' });
    expect(calls).toBe(0);
    expect((await queue.get('job-done'))?.status).toBe('COMPLETED');
  });
});
