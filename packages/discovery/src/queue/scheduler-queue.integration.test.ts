import { describe, expect, it } from 'vitest';
import {
  createDefaultDiscoveryRegistry,
  createDiscoveryExecutionWorker,
  createDiscoveryScheduler,
  createFakeClock,
  createFakeVerificationAdapter,
  createIncrementingJobIdGenerator,
  createIncrementingRunIdGenerator,
  createInMemoryExecutionQueue,
  createInMemoryProfileStore,
  createInMemoryRunStore,
  createInMemoryScheduleStore,
  createPipelineRunExecutor,
  emptyCriteria,
  type DiscoveryProfile,
  type DiscoveryRunExecutor,
  type PipelineExecuteResult,
} from '../index.js';

function jobProfile(): DiscoveryProfile {
  return {
    id: 'profile-job',
    userId: 'user-1',
    name: 'Jobs',
    strategyId: 'job-discovery',
    strategyVersion: '1',
    criteria: {
      ...emptyCriteria(),
      required: [{ key: 'country', value: 'DE' }],
      preferred: [{ key: 'role', value: 'Frontend Engineer' }],
    },
    schedule: { cadence: 'manual' },
    notification: { emailEnabled: true, skipEmptyDigest: true },
    enabled: true,
    createdAt: '2026-08-30T00:00:00.000Z',
    updatedAt: '2026-08-30T00:00:00.000Z',
  };
}

function statusExecutor(status: PipelineExecuteResult['run']['status']): DiscoveryRunExecutor {
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
          finishedAt: '2026-08-31T10:00:05.000Z',
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
      };
    },
  };
}

describe('E4.3 scheduler → queue → worker integration', () => {
  function stack(opts?: { executor?: DiscoveryRunExecutor }) {
    const clock = createFakeClock('2026-08-31T10:00:00.000Z');
    const scheduleStore = createInMemoryScheduleStore();
    const runStore = createInMemoryRunStore();
    const queue = createInMemoryExecutionQueue();
    const executor =
      opts?.executor ??
      createPipelineRunExecutor({
        registry: createDefaultDiscoveryRegistry(),
        profileStore: createInMemoryProfileStore([jobProfile()]),
        adapters: {
          search: {
            async search() {
              return [
                {
                  discoveredUrl: 'https://employer.example/jobs/1',
                  title: 'Frontend Engineer',
                  source: {
                    trust: 'AGGREGATOR',
                    url: 'https://employer.example/jobs/1',
                  },
                  data: { company: 'Acme', location: 'Berlin' },
                },
              ];
            },
          },
          verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
        },
        now: () => clock.now().toISOString(),
      });
    const scheduler = createDiscoveryScheduler({
      scheduleStore,
      runStore,
      queue,
      clock,
      runIdGenerator: createIncrementingRunIdGenerator('int-run'),
      jobIdGenerator: createIncrementingJobIdGenerator('int-job'),
    });
    const worker = createDiscoveryExecutionWorker({
      queue,
      executor,
      runStore,
      scheduleStore,
      clock,
    });
    return { clock, scheduleStore, runStore, queue, scheduler, worker };
  }

  it('due schedule enqueues; worker executes pipeline', async () => {
    const { scheduleStore, runStore, queue, scheduler, worker } = stack();

    await scheduler.registerSchedule({
      scheduleId: 'sched-int',
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      intervalSeconds: 3600,
      nextRunAt: '2026-08-31T10:00:00.000Z',
    });

    const tick = await scheduler.triggerDueRuns();
    expect(tick.outcomes[0]).toMatchObject({ kind: 'enqueued', trigger: 'scheduled' });
    expect((await queue.getPending())).toHaveLength(1);

    const pendingRun = runStore.snapshot()[0];
    expect(pendingRun?.status).toBe('PENDING');

    await worker.processNext();

    const runs = await runStore.listBySchedule('sched-int');
    expect(runs).toHaveLength(1);
    expect(['SUCCESS', 'PARTIAL_SUCCESS']).toContain(runs[0]?.status);

    const schedule = await scheduleStore.get('sched-int');
    expect(schedule?.nextRunAt).toBe('2026-08-31T11:00:00.000Z');
    expect(schedule?.runningRunId).toBeNull();
  });

  it('propagates SUCCESS, PARTIAL_SUCCESS, and FAILED pipeline outcomes', async () => {
    for (const status of ['SUCCESS', 'PARTIAL_SUCCESS', 'FAILED'] as const) {
      const { runStore, scheduler, worker } = stack({ executor: statusExecutor(status) });
      await scheduler.registerSchedule({
        scheduleId: `sched-${status}`,
        profileId: 'profile-job',
        strategyId: 'job-discovery',
        strategyVersion: '1',
        intervalSeconds: 3600,
        nextRunAt: '2026-08-31T10:00:00.000Z',
      });
      await scheduler.triggerDueRuns();
      await worker.processNext();
      const run = runStore.snapshot()[0];
      expect(run?.status).toBe(status);
    }
  });

  it('one failed job does not prevent another', async () => {
    let calls = 0;
    const executor: DiscoveryRunExecutor = {
      async execute(req) {
        calls += 1;
        if (req.scheduleId === 'sched-fail') {
          throw new Error('pipeline failed');
        }
        return statusExecutor('SUCCESS').execute(req);
      },
    };
    const { queue, scheduler, worker } = stack({ executor });

    await scheduler.registerSchedule({
      scheduleId: 'sched-fail',
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      intervalSeconds: 3600,
      nextRunAt: '2026-08-31T10:00:00.000Z',
    });
    await scheduler.registerSchedule({
      scheduleId: 'sched-ok',
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      intervalSeconds: 3600,
      nextRunAt: '2026-08-31T10:00:00.000Z',
    });

    await scheduler.triggerDueRuns();
    expect((await queue.getPending()).length + queue.snapshot().filter((j) => j.status === 'RUNNING').length).toBeGreaterThanOrEqual(2);

    await worker.processNext();
    await worker.processNext();
    expect(calls).toBe(2);
    expect((await queue.snapshot().find((j) => j.scheduleId === 'sched-fail'))?.status).toBe('FAILED');
    expect((await queue.snapshot().find((j) => j.scheduleId === 'sched-ok'))?.status).toBe('COMPLETED');
  });

  it('queued job counts toward overlap protection', async () => {
    const { scheduleStore, scheduler } = stack();
    await scheduler.registerSchedule({
      scheduleId: 'sched-overlap',
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      intervalSeconds: 3600,
      nextRunAt: '2026-08-31T10:00:00.000Z',
    });
    await scheduler.triggerDueRuns();
    const manual = await scheduler.triggerNow('sched-overlap');
    expect(manual).toMatchObject({ kind: 'skipped', reason: 'already_running' });
    const schedule = await scheduleStore.get('sched-overlap');
    expect(schedule?.runningRunId).toBeTruthy();
  });

  it('manual trigger enqueues without advancing nextRunAt', async () => {
    const { scheduleStore, scheduler } = stack();
    const nextRunAt = '2026-08-31T15:00:00.000Z';
    await scheduler.registerSchedule({
      scheduleId: 'sched-manual',
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      intervalSeconds: 3600,
      nextRunAt,
    });
    const outcome = await scheduler.triggerNow('sched-manual');
    expect(outcome).toMatchObject({ kind: 'enqueued', trigger: 'manual' });
    expect((await scheduleStore.get('sched-manual'))?.nextRunAt).toBe(nextRunAt);
  });

  it('in-memory queue loss leaves durable schedule/run metadata (recovery gap)', async () => {
    const { scheduleStore, runStore, queue, scheduler } = stack();
    await scheduler.registerSchedule({
      scheduleId: 'sched-gap',
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      intervalSeconds: 3600,
      nextRunAt: '2026-08-31T10:00:00.000Z',
    });
    await scheduler.triggerDueRuns();
    const lostQueue = createInMemoryExecutionQueue();
    expect(lostQueue.snapshot()).toHaveLength(0);
    const schedule = await scheduleStore.get('sched-gap');
    expect(schedule?.runningRunId).toBeTruthy();
    expect(runStore.snapshot()[0]?.status).toBe('PENDING');
    expect(schedule?.nextRunAt).toBe('2026-08-31T11:00:00.000Z');
  });
});
