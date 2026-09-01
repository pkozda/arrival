import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createFakeClock,
  createInMemoryExecutionQueue,
  createInMemoryRunStore,
  createInMemoryScheduleStore,
  createInMemorySchedulerLock,
  createDiscoveryScheduler,
  createIncrementingJobIdGenerator,
  createIncrementingRunIdGenerator,
  createSqliteSchedulerLock,
  scheduleLockKey,
  schedulerOwnerId,
} from '../index.js';

describe('E5.3 in-memory SchedulerLock', () => {
  it('acquire / contention / owner release', async () => {
    const lock = createInMemorySchedulerLock();
    const now = '2026-08-31T10:00:00.000Z';
    const a = await lock.tryAcquire('schedule:s1', 'scheduler:A', now, 30_000);
    expect(a.acquired).toBe(true);

    const b = await lock.tryAcquire('schedule:s1', 'scheduler:B', now, 30_000);
    expect(b).toMatchObject({
      acquired: false,
      reason: 'already_locked',
      currentOwnerId: 'scheduler:A',
    });

    expect(await lock.release('schedule:s1', 'scheduler:B')).toMatchObject({
      released: false,
      reason: 'not_owner',
    });
    expect(await lock.release('schedule:s1', 'scheduler:A')).toEqual({
      released: true,
      lockKey: 'schedule:s1',
    });

    const again = await lock.tryAcquire('schedule:s1', 'scheduler:B', now, 30_000);
    expect(again.acquired).toBe(true);
  });

  it('expiration and recoverExpired', async () => {
    const clock = createFakeClock('2026-08-31T10:00:00.000Z');
    const lock = createInMemorySchedulerLock();
    await lock.tryAcquire(
      'schedule:s1',
      'scheduler:A',
      clock.now().toISOString(),
      1_000
    );

    clock.set('2026-08-31T10:00:00.500Z');
    expect(
      (
        await lock.tryAcquire(
          'schedule:s1',
          'scheduler:B',
          clock.now().toISOString(),
          1_000
        )
      ).acquired
    ).toBe(false);

    clock.set('2026-08-31T10:00:02.000Z');
    const recovered = await lock.recoverExpired(clock.now().toISOString());
    expect(recovered.recoveredKeys).toEqual(['schedule:s1']);

    const b = await lock.tryAcquire(
      'schedule:s1',
      'scheduler:B',
      clock.now().toISOString(),
      1_000
    );
    expect(b.acquired).toBe(true);
  });

  it('rejects invalid lease / key / owner without throwing', async () => {
    const lock = createInMemorySchedulerLock();
    expect(
      await lock.tryAcquire('', 'scheduler:A', '2026-08-31T10:00:00.000Z', 1)
    ).toMatchObject({ acquired: false, reason: 'invalid_key' });
    expect(
      await lock.tryAcquire('k', '', '2026-08-31T10:00:00.000Z', 1)
    ).toMatchObject({ acquired: false, reason: 'invalid_owner' });
    expect(
      await lock.tryAcquire('k', 'scheduler:A', '2026-08-31T10:00:00.000Z', 0)
    ).toMatchObject({ acquired: false, reason: 'invalid_lease' });
  });
});

describe('E5.3 SQLite SchedulerLock', () => {
  function tempDb() {
    const dir = mkdtempSync(path.join(tmpdir(), 'discovery-e53-lock-'));
    return {
      path: path.join(dir, 'locks.sqlite'),
      cleanup() {
        try {
          rmSync(dir, { recursive: true, force: true });
        } catch {
          /* ignore */
        }
      },
    };
  }

  it('persists, contends, expires, and survives restart', async () => {
    const db = tempDb();
    const clock = createFakeClock('2026-08-31T10:00:00.000Z');
    const a = createSqliteSchedulerLock({ databasePath: db.path });
    const key = scheduleLockKey('sched-1');
    const ownerA = schedulerOwnerId('A');
    const ownerB = schedulerOwnerId('B');

    expect(
      (await a.tryAcquire(key, ownerA, clock.now().toISOString(), 1_000)).acquired
    ).toBe(true);
    expect(
      (await a.tryAcquire(key, ownerB, clock.now().toISOString(), 1_000)).acquired
    ).toBe(false);
    a.close();

    const b = createSqliteSchedulerLock({ databasePath: db.path });
    expect((await b.get(key))?.ownerId).toBe(ownerA);

    clock.set('2026-08-31T10:00:02.000Z');
    expect(
      (await b.recoverExpired(clock.now().toISOString())).recoveredKeys
    ).toEqual([key]);
    expect(
      (await b.tryAcquire(key, ownerB, clock.now().toISOString(), 1_000)).acquired
    ).toBe(true);
    expect(await b.release(key, ownerA)).toMatchObject({
      released: false,
      reason: 'not_owner',
    });
    b.close();
    db.cleanup();
  });

  it('two connections cannot both acquire the same active lock', async () => {
    const db = tempDb();
    const now = '2026-08-31T10:00:00.000Z';
    const left = createSqliteSchedulerLock({ databasePath: db.path });
    const right = createSqliteSchedulerLock({ databasePath: db.path });
    const key = scheduleLockKey('sched-x');

    const r1 = await left.tryAcquire(key, schedulerOwnerId('L'), now, 30_000);
    const r2 = await right.tryAcquire(key, schedulerOwnerId('R'), now, 30_000);
    expect(r1.acquired).toBe(true);
    expect(r2.acquired).toBe(false);

    left.close();
    right.close();
    db.cleanup();
  });
});

describe('E5.3 multi-scheduler instances', () => {
  function dualSchedulers(opts?: { leaseMs?: number }) {
    const clock = createFakeClock('2026-08-31T10:00:00.000Z');
    const scheduleStore = createInMemoryScheduleStore();
    const runStore = createInMemoryRunStore();
    const queue = createInMemoryExecutionQueue();
    const lock = createInMemorySchedulerLock();
    const leaseMs = opts?.leaseMs ?? 30_000;

    const make = (instanceId: string, runPrefix: string, jobPrefix: string) =>
      createDiscoveryScheduler({
        scheduleStore,
        runStore,
        queue,
        clock,
        runIdGenerator: createIncrementingRunIdGenerator(runPrefix),
        jobIdGenerator: createIncrementingJobIdGenerator(jobPrefix),
        schedulerLock: lock,
        runtimeInstanceId: instanceId,
        schedulerLockLeaseMs: leaseMs,
      });

    return {
      clock,
      scheduleStore,
      runStore,
      queue,
      lock,
      schedulerA: make('A', 'runA', 'jobA'),
      schedulerB: make('B', 'runB', 'jobB'),
    };
  }

  it('concurrent due trigger enqueues exactly one run and advances nextRunAt once', async () => {
    const { schedulerA, schedulerB, scheduleStore, queue, runStore } =
      dualSchedulers();

    await schedulerA.registerSchedule({
      scheduleId: 'sched-1',
      profileId: 'profile-1',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      intervalSeconds: 3600,
      nextRunAt: '2026-08-31T10:00:00.000Z',
    });

    const [outA, outB] = await Promise.all([
      schedulerA.triggerDueRuns(),
      schedulerB.triggerDueRuns(),
    ]);

    const enqueued = [...outA.outcomes, ...outB.outcomes].filter(
      (o) => o.kind === 'enqueued'
    );
    const contended = [...outA.outcomes, ...outB.outcomes].filter(
      (o) => o.kind === 'skipped' && o.reason === 'lock_contended'
    );
    const already = [...outA.outcomes, ...outB.outcomes].filter(
      (o) => o.kind === 'skipped' && o.reason === 'already_running'
    );

    expect(enqueued).toHaveLength(1);
    expect(contended.length + already.length).toBeGreaterThanOrEqual(1);
    expect(queue.size()).toBe(1);
    expect(runStore.snapshot()).toHaveLength(1);
    expect((await scheduleStore.get('sched-1'))?.nextRunAt).toBe(
      '2026-08-31T11:00:00.000Z'
    );
    expect((await scheduleStore.get('sched-1'))?.runningRunId).toBe(
      (enqueued[0] as { runId: string }).runId
    );
  });

  it('lock expires after crash before enqueue so peer can acquire', async () => {
    const { clock, lock, schedulerB } = dualSchedulers({ leaseMs: 1_000 });
    const key = scheduleLockKey('sched-crash');
    await lock.tryAcquire(key, schedulerOwnerId('A'), clock.now().toISOString(), 1_000);

    // Simulate crash: A never releases
    clock.set('2026-08-31T10:00:02.000Z');
    await schedulerB.registerSchedule({
      scheduleId: 'sched-crash',
      profileId: 'profile-1',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      intervalSeconds: 3600,
      nextRunAt: '2026-08-31T10:00:00.000Z',
    });
    const tick = await schedulerB.triggerDueRuns();
    expect(tick.outcomes[0]).toMatchObject({ kind: 'enqueued' });
  });

  it('after enqueue with runningRunId, peer does not create duplicate even if lock expires', async () => {
    const { clock, schedulerA, schedulerB, queue, lock } = dualSchedulers({
      leaseMs: 1_000,
    });

    await schedulerA.registerSchedule({
      scheduleId: 'sched-dup',
      profileId: 'profile-1',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      intervalSeconds: 3600,
      nextRunAt: '2026-08-31T10:00:00.000Z',
    });
    const first = await schedulerA.triggerDueRuns();
    expect(first.outcomes[0]).toMatchObject({ kind: 'enqueued' });
    expect(queue.size()).toBe(1);

    // Simulate A crashed after enqueue but before release — force lock presence then expiry
    const key = scheduleLockKey('sched-dup');
    await lock.tryAcquire(
      key,
      schedulerOwnerId('A'),
      clock.now().toISOString(),
      1_000
    );
    clock.set('2026-08-31T10:00:02.000Z');

    // Due tick finds nothing (runningRunId set / nextRunAt advanced)
    const second = await schedulerB.triggerDueRuns();
    expect(second.outcomes).toHaveLength(0);

    // Manual trigger still blocked by active run after lock expiry
    const manual = await schedulerB.triggerNow('sched-dup');
    expect(manual).toMatchObject({
      kind: 'skipped',
      reason: 'already_running',
    });
    expect(queue.size()).toBe(1);
  });

  it('manual trigger does not advance nextRunAt and still uses lock', async () => {
    const { schedulerA, schedulerB, scheduleStore } = dualSchedulers();
    await schedulerA.registerSchedule({
      scheduleId: 'sched-manual',
      profileId: 'profile-1',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      intervalSeconds: 3600,
      nextRunAt: '2026-08-31T15:00:00.000Z',
    });

    const [m1, m2] = await Promise.all([
      schedulerA.triggerNow('sched-manual'),
      schedulerB.triggerNow('sched-manual'),
    ]);
    const enqueued = [m1, m2].filter((o) => o.kind === 'enqueued');
    expect(enqueued).toHaveLength(1);
    expect((await scheduleStore.get('sched-manual'))?.nextRunAt).toBe(
      '2026-08-31T15:00:00.000Z'
    );
  });
});
