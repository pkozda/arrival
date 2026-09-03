import { describe, expect, it } from 'vitest';
import {
  calculateNextRunAt,
  createDiscoveryScheduler,
  createFakeClock,
  createIncrementingJobIdGenerator,
  createIncrementingRunIdGenerator,
  createInMemoryExecutionQueue,
  createInMemoryProfileStore,
  createInMemoryRunStore,
  createInMemoryScheduleStore,
  emptyCriteria,
  initialNextRunAt,
  type DiscoveryProfile,
} from '../index.js';

describe('E4.2 scheduler recurrence', () => {
  it('calculateNextRunAt coalesces missed intervals', () => {
    expect(
      calculateNextRunAt('2026-08-31T10:00:00.000Z', 3600, '2026-08-31T12:30:00.000Z')
    ).toBe('2026-08-31T13:00:00.000Z');
  });

  it('initialNextRunAt is now + interval', () => {
    expect(initialNextRunAt('2026-08-31T10:00:00.000Z', 3600)).toBe(
      '2026-08-31T11:00:00.000Z'
    );
  });
});

describe('E4.3 discovery scheduler (enqueue-only)', () => {
  function harness(start = '2026-08-31T10:00:00.000Z') {
    const clock = createFakeClock(start);
    const scheduleStore = createInMemoryScheduleStore();
    const runStore = createInMemoryRunStore();
    const queue = createInMemoryExecutionQueue();
    const scheduler = createDiscoveryScheduler({
      scheduleStore,
      runStore,
      queue,
      clock,
      runIdGenerator: createIncrementingRunIdGenerator('sched-run'),
      jobIdGenerator: createIncrementingJobIdGenerator('sched-job'),
    });
    return { clock, scheduleStore, runStore, queue, scheduler };
  }

  it('due schedule enqueues and advances nextRunAt without drift', async () => {
    const { clock, scheduleStore, queue, scheduler } = harness();
    await scheduler.registerSchedule({
      scheduleId: 'sched-1',
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      intervalSeconds: 3600,
      nextRunAt: '2026-08-31T10:00:00.000Z',
    });

    const tick = await scheduler.triggerDueRuns();
    expect(tick.outcomes[0]).toMatchObject({
      kind: 'enqueued',
      scheduleId: 'sched-1',
      trigger: 'scheduled',
    });
    expect((await queue.getPending())).toHaveLength(1);

    const updated = await scheduleStore.get('sched-1');
    expect(updated?.nextRunAt).toBe('2026-08-31T11:00:00.000Z');
    expect(updated?.runningRunId).toBeTruthy();

    clock.set('2026-08-31T10:50:00.000Z');
    const early = await scheduler.triggerDueRuns();
    expect(early.outcomes).toHaveLength(0);
  });

  it('disabled schedule does not enqueue', async () => {
    const { scheduler } = harness();
    await scheduler.registerSchedule({
      scheduleId: 'sched-off',
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      intervalSeconds: 3600,
      nextRunAt: '2026-08-31T09:00:00.000Z',
    });
    await scheduler.disableSchedule('sched-off');
    const tick = await scheduler.triggerDueRuns();
    expect(tick.outcomes).toHaveLength(0);
    const manual = await scheduler.triggerNow('sched-off');
    expect(manual).toMatchObject({ kind: 'skipped', reason: 'disabled' });
  });

  it('missed intervals coalesce to one enqueue', async () => {
    const { clock, scheduleStore, runStore, scheduler } = harness('2026-08-31T12:30:00.000Z');
    await scheduler.registerSchedule({
      scheduleId: 'sched-miss',
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      intervalSeconds: 3600,
      nextRunAt: '2026-08-31T10:00:00.000Z',
    });

    const tick = await scheduler.triggerDueRuns();
    expect(tick.outcomes).toHaveLength(1);
    expect(runStore.snapshot()).toHaveLength(1);
    expect(runStore.snapshot()[0]?.status).toBe('PENDING');

    const after = await scheduleStore.get('sched-miss');
    expect(after?.nextRunAt).toBe('2026-08-31T13:00:00.000Z');

    clock.set('2026-08-31T12:35:00.000Z');
    const again = await scheduler.triggerDueRuns();
    expect(again.outcomes).toHaveLength(0);
  });

  it('overlap protection skips when runningRunId is set', async () => {
    const { scheduleStore, scheduler } = harness();

    await scheduler.registerSchedule({
      scheduleId: 'sched-overlap',
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      intervalSeconds: 3600,
      nextRunAt: '2026-08-31T10:00:00.000Z',
    });

    await scheduleStore.upsert({
      ...(await scheduleStore.get('sched-overlap'))!,
      runningRunId: 'existing-run',
    });

    const manual = await scheduler.triggerNow('sched-overlap');
    expect(manual).toMatchObject({
      kind: 'skipped',
      reason: 'already_running',
    });
  });

  it('manual trigger enqueues without advancing nextRunAt', async () => {
    const { scheduleStore, scheduler } = harness();
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
    expect(outcome).toMatchObject({
      kind: 'enqueued',
      trigger: 'manual',
    });

    const after = await scheduleStore.get('sched-manual');
    expect(after?.nextRunAt).toBe(nextRunAt);
  });

  it('runId uniqueness across triggers after lock cleared', async () => {
    const { scheduleStore, scheduler } = harness();
    await scheduler.registerSchedule({
      scheduleId: 'sched-ids',
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      intervalSeconds: 60,
      nextRunAt: '2026-08-31T10:00:00.000Z',
    });

    const first = await scheduler.triggerDueRuns();
    const runId1 =
      first.outcomes[0]?.kind === 'enqueued' ? first.outcomes[0].runId : '';
    await scheduleStore.clearRunningLock('sched-ids', '2026-08-31T10:01:00.000Z');

    const second = await scheduler.triggerNow('sched-ids');
    const runId2 = second.kind === 'enqueued' ? second.runId : '';
    expect(runId1).toBeTruthy();
    expect(runId2).toBeTruthy();
    expect(runId1).not.toBe(runId2);
  });

  it('re-enable recalculates nextRunAt from current clock', async () => {
    const { clock, scheduleStore, scheduler } = harness('2026-08-31T10:00:00.000Z');
    await scheduler.registerSchedule({
      scheduleId: 'sched-re',
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      intervalSeconds: 3600,
      nextRunAt: '2026-08-31T08:00:00.000Z',
    });
    await scheduler.disableSchedule('sched-re');
    clock.set('2026-08-31T12:00:00.000Z');
    await scheduler.enableSchedule('sched-re');
    const enabled = await scheduleStore.get('sched-re');
    expect(enabled?.nextRunAt).toBe('2026-08-31T13:00:00.000Z');
  });

  it('repeated scheduler ticks do not duplicate enqueue while not due', async () => {
    const { scheduler, runStore } = harness();
    await scheduler.registerSchedule({
      scheduleId: 'sched-once',
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      intervalSeconds: 3600,
      nextRunAt: '2026-08-31T10:00:00.000Z',
    });

    await scheduler.triggerDueRuns();
    await scheduler.triggerDueRuns();
    expect(runStore.snapshot()).toHaveLength(1);
  });

  it('duplicate scheduler tick while job still queued does not create second job', async () => {
    const { clock, queue, scheduler } = harness();
    await scheduler.registerSchedule({
      scheduleId: 'sched-dup',
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      intervalSeconds: 60,
      nextRunAt: '2026-08-31T10:00:00.000Z',
    });
    await scheduler.triggerDueRuns();
    clock.set('2026-08-31T10:00:30.000Z');
    const again = await scheduler.triggerDueRuns();
    expect(again.outcomes).toHaveLength(0);
    expect(queue.size()).toBe(1);
  });
});

describe('H1 scheduler lock & at-least-once hardening', () => {
  function harness(start = '2026-08-31T10:00:00.000Z') {
    const clock = createFakeClock(start);
    const scheduleStore = createInMemoryScheduleStore();
    const runStore = createInMemoryRunStore();
    const queue = createInMemoryExecutionQueue();
    const scheduler = createDiscoveryScheduler({
      scheduleStore,
      runStore,
      queue,
      clock,
      runIdGenerator: createIncrementingRunIdGenerator('h1-run'),
      jobIdGenerator: createIncrementingJobIdGenerator('h1-job'),
    });
    return { clock, scheduleStore, runStore, queue, scheduler };
  }

  it('registerSchedule re-projection preserves active runningRunId', async () => {
    const { scheduleStore, scheduler } = harness();
    await scheduler.registerSchedule({
      scheduleId: 'sched-lock',
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      intervalSeconds: 3600,
      nextRunAt: '2026-08-31T10:00:00.000Z',
    });
    await scheduleStore.upsert({
      ...(await scheduleStore.get('sched-lock'))!,
      runningRunId: 'run-A',
    });

    const updated = await scheduler.registerSchedule({
      scheduleId: 'sched-lock',
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      intervalSeconds: 7200,
      enabled: true,
      nextRunAt: '2026-08-31T14:00:00.000Z',
    });

    expect(updated.runningRunId).toBe('run-A');
    expect(updated.interval.intervalSeconds).toBe(7200);
    expect(updated.nextRunAt).toBe('2026-08-31T14:00:00.000Z');
    expect((await scheduleStore.get('sched-lock'))?.runningRunId).toBe('run-A');
  });

  it('active runningRunId prevents a second due enqueue', async () => {
    const { scheduleStore, queue, runStore, scheduler } = harness();
    await scheduler.registerSchedule({
      scheduleId: 'sched-active',
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      intervalSeconds: 3600,
      nextRunAt: '2026-08-31T10:00:00.000Z',
    });
    await scheduleStore.upsert({
      ...(await scheduleStore.get('sched-active'))!,
      runningRunId: 'run-A',
    });

    const tick = await scheduler.triggerDueRuns();
    expect(tick.outcomes).toHaveLength(0);
    expect(queue.size()).toBe(0);
    expect(runStore.snapshot()).toHaveLength(0);
    expect((await scheduleStore.get('sched-active'))?.runningRunId).toBe('run-A');
  });

  it('scheduled claim advances nextRunAt atomically; manual does not', async () => {
    const { scheduleStore, scheduler } = harness();
    await scheduler.registerSchedule({
      scheduleId: 'sched-daily',
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      intervalSeconds: 86400,
      nextRunAt: '2026-08-31T10:00:00.000Z',
    });

    const tick = await scheduler.triggerDueRuns();
    expect(tick.outcomes[0]).toMatchObject({ kind: 'enqueued', trigger: 'scheduled' });
    const afterDue = await scheduleStore.get('sched-daily');
    expect(afterDue?.nextRunAt).toBe('2026-09-01T10:00:00.000Z');
    expect(afterDue?.runningRunId).toBeTruthy();

    await scheduleStore.clearRunningLock(
      'sched-daily',
      '2026-08-31T10:05:00.000Z',
      afterDue!.runningRunId!
    );

    const manualNext = '2026-09-01T10:00:00.000Z';
    const manual = await scheduler.triggerNow('sched-daily');
    expect(manual).toMatchObject({ kind: 'enqueued', trigger: 'manual' });
    expect((await scheduleStore.get('sched-daily'))?.nextRunAt).toBe(manualNext);
  });

  it('crash after claim+advance does not re-due the same slot once lock clears', async () => {
    const { clock, scheduleStore, queue, runStore, scheduler } = harness();
    await scheduler.registerSchedule({
      scheduleId: 'sched-crash',
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      intervalSeconds: 3600,
      nextRunAt: '2026-08-31T10:00:00.000Z',
    });

    // Successful scheduled enqueue advances nextRunAt in the same claim.
    const first = await scheduler.triggerDueRuns();
    expect(first.outcomes[0]).toMatchObject({ kind: 'enqueued' });
    const runId =
      first.outcomes[0]?.kind === 'enqueued' ? first.outcomes[0].runId : '';
    expect((await scheduleStore.get('sched-crash'))?.nextRunAt).toBe(
      '2026-08-31T11:00:00.000Z'
    );

    // Simulate interruption after enqueue: drop the queued job (lost in-flight),
    // then clear the lock as a completed/abandoned worker would.
    // nextRunAt must remain advanced so the same slot is not claimed again.
    while (queue.size() > 0) {
      const job = await queue.dequeue({ workerId: 'crash-sim' });
      if (!job) break;
      await queue.ack(job.jobId, clock.now().toISOString());
    }
    await scheduleStore.clearRunningLock('sched-crash', clock.now().toISOString(), runId);

    clock.set('2026-08-31T10:30:00.000Z');
    const recovery = await scheduler.triggerDueRuns();
    expect(recovery.outcomes).toHaveLength(0);
    expect(runStore.snapshot()).toHaveLength(1);
    expect((await scheduleStore.get('sched-crash'))?.nextRunAt).toBe(
      '2026-08-31T11:00:00.000Z'
    );
    expect((await scheduleStore.get('sched-crash'))?.runningRunId).toBeNull();
  });

  it('completion clearRunningLock clears the active run lock', async () => {
    const { scheduleStore, scheduler } = harness();
    await scheduler.registerSchedule({
      scheduleId: 'sched-done',
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      intervalSeconds: 3600,
      nextRunAt: '2026-08-31T10:00:00.000Z',
    });
    const tick = await scheduler.triggerDueRuns();
    const runId =
      tick.outcomes[0]?.kind === 'enqueued' ? tick.outcomes[0].runId : '';
    expect((await scheduleStore.get('sched-done'))?.runningRunId).toBe(runId);

    await scheduleStore.clearRunningLock('sched-done', '2026-08-31T10:05:00.000Z', runId);
    expect((await scheduleStore.get('sched-done'))?.runningRunId).toBeNull();
  });

  it('tryClaim with nextRunAt atomically consumes the due slot before enqueue', async () => {
    const { scheduleStore } = harness();
    await scheduleStore.upsert({
      scheduleId: 'sched-atomic',
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      enabled: true,
      interval: { kind: 'fixed_interval', intervalSeconds: 3600 },
      timezone: 'UTC',
      nextRunAt: '2026-08-31T10:00:00.000Z',
      createdAt: '2026-08-31T09:00:00.000Z',
      updatedAt: '2026-08-31T09:00:00.000Z',
      runningRunId: null,
    });

    const claimed = await scheduleStore.tryClaim(
      'sched-atomic',
      'run-pre-enqueue',
      '2026-08-31T10:00:00.000Z',
      {
        requireDue: true,
        nextRunAt: '2026-08-31T11:00:00.000Z',
      }
    );
    expect(claimed).toBe(true);
    const mid = await scheduleStore.get('sched-atomic');
    expect(mid?.runningRunId).toBe('run-pre-enqueue');
    expect(mid?.nextRunAt).toBe('2026-08-31T11:00:00.000Z');

    // Crash before enqueue: clear lock. Slot must not be due again.
    await scheduleStore.clearRunningLock(
      'sched-atomic',
      '2026-08-31T10:01:00.000Z',
      'run-pre-enqueue'
    );
    expect(await scheduleStore.getDueSchedules('2026-08-31T10:30:00.000Z')).toHaveLength(
      0
    );
  });
});

function jobProfile(overrides?: Partial<DiscoveryProfile>): DiscoveryProfile {
  return {
    id: 'profile-job',
    userId: 'user-1',
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
    createdAt: '2026-08-30T00:00:00.000Z',
    updatedAt: '2026-08-30T00:00:00.000Z',
    ...overrides,
  };
}

describe('E8 profile enabled gate', () => {
  function harness(profile: DiscoveryProfile) {
    const clock = createFakeClock('2026-08-31T10:00:00.000Z');
    const scheduleStore = createInMemoryScheduleStore();
    const runStore = createInMemoryRunStore();
    const queue = createInMemoryExecutionQueue();
    const profileStore = createInMemoryProfileStore([profile]);
    const scheduler = createDiscoveryScheduler({
      scheduleStore,
      runStore,
      queue,
      clock,
      profileStore,
      runIdGenerator: createIncrementingRunIdGenerator('e8-run'),
      jobIdGenerator: createIncrementingJobIdGenerator('e8-job'),
    });
    return { clock, scheduleStore, runStore, queue, scheduler, profileStore };
  }

  async function registerDue(
    scheduler: ReturnType<typeof harness>['scheduler'],
    scheduleId = 'sched-e8'
  ) {
    await scheduler.registerSchedule({
      scheduleId,
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      intervalSeconds: 3600,
      nextRunAt: '2026-08-31T10:00:00.000Z',
    });
  }

  it('enabled profile + due operational schedule enqueues', async () => {
    const { queue, scheduler } = harness(jobProfile({ enabled: true }));
    await registerDue(scheduler);
    const tick = await scheduler.triggerDueRuns();
    expect(tick.outcomes[0]).toMatchObject({
      kind: 'enqueued',
      scheduleId: 'sched-e8',
    });
    expect((await queue.getPending())).toHaveLength(1);
  });

  it('disabled profile + due operational schedule is skipped (profile_disabled)', async () => {
    const { queue, runStore, scheduler } = harness(jobProfile({ enabled: false }));
    await registerDue(scheduler);
    const tick = await scheduler.triggerDueRuns();
    expect(tick.outcomes[0]).toMatchObject({
      kind: 'skipped',
      reason: 'profile_disabled',
    });
    expect((await queue.getPending())).toHaveLength(0);
    expect(runStore.snapshot()).toHaveLength(0);
    const manual = await scheduler.triggerNow('sched-e8');
    expect(manual).toMatchObject({ kind: 'skipped', reason: 'profile_disabled' });
  });

  it('schedule-level disable still skips before profile gate', async () => {
    const { queue, scheduler } = harness(jobProfile({ enabled: true }));
    await registerDue(scheduler);
    await scheduler.disableSchedule('sched-e8');
    const tick = await scheduler.triggerDueRuns();
    expect(tick.outcomes).toHaveLength(0);
    const manual = await scheduler.triggerNow('sched-e8');
    expect(manual).toMatchObject({ kind: 'skipped', reason: 'disabled' });
    expect((await queue.getPending())).toHaveLength(0);
  });

  it('overlap protection unchanged when profileStore is wired', async () => {
    const { scheduleStore, scheduler } = harness(jobProfile({ enabled: true }));
    await registerDue(scheduler, 'sched-overlap-e8');
    await scheduleStore.upsert({
      ...(await scheduleStore.get('sched-overlap-e8'))!,
      runningRunId: 'existing-run',
    });
    const manual = await scheduler.triggerNow('sched-overlap-e8');
    expect(manual).toMatchObject({
      kind: 'skipped',
      reason: 'already_running',
    });
  });

  it('missed-interval coalescing unchanged when profileStore is wired', async () => {
    const { clock, scheduleStore, runStore, scheduler } = harness(
      jobProfile({ enabled: true })
    );
    clock.set('2026-08-31T12:30:00.000Z');
    await scheduler.registerSchedule({
      scheduleId: 'sched-coalesce-e8',
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      intervalSeconds: 3600,
      nextRunAt: '2026-08-31T10:00:00.000Z',
    });
    const tick = await scheduler.triggerDueRuns();
    expect(tick.outcomes).toHaveLength(1);
    expect(runStore.snapshot()).toHaveLength(1);
    expect((await scheduleStore.get('sched-coalesce-e8'))?.nextRunAt).toBe(
      '2026-08-31T13:00:00.000Z'
    );
  });
});
