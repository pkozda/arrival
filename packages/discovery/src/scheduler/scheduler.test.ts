import { describe, expect, it } from 'vitest';
import {
  calculateNextRunAt,
  createDiscoveryScheduler,
  createFakeClock,
  createIncrementingJobIdGenerator,
  createIncrementingRunIdGenerator,
  createInMemoryExecutionQueue,
  createInMemoryRunStore,
  createInMemoryScheduleStore,
  initialNextRunAt,
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
