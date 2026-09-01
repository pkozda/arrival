import type { Clock } from './clock.js';
import { clockIso } from './clock.js';
import type { DiscoveryExecutionQueue } from '../queue/execution-queue.js';
import { SchedulerError } from './errors.js';
import { calculateNextRunAt, initialNextRunAt } from './recurrence.js';
import type { RunStore } from './run-store.js';
import type { ScheduleStore } from './schedule-store.js';
import {
  DEFAULT_SCHEDULER_LOCK_LEASE_MS,
  scheduleLockKey,
  schedulerOwnerId,
  type SchedulerLock,
} from './scheduler-lock.js';
import type { ProfileStore } from '../pipeline/profile-store.js';
import type { TelemetryEmitter } from '../telemetry/emitter.js';
import type {
  DiscoveryScheduleRecord,
  JobIdGenerator,
  RegisterScheduleInput,
  RunIdGenerator,
  ScheduledRunRecord,
  ScheduleRunTrigger,
  SchedulerTickResult,
  TriggerRunOutcome,
} from './types.js';

export type DiscoveryScheduler = {
  registerSchedule(input: RegisterScheduleInput): Promise<DiscoveryScheduleRecord>;
  disableSchedule(scheduleId: string): Promise<DiscoveryScheduleRecord | null>;
  enableSchedule(scheduleId: string): Promise<DiscoveryScheduleRecord | null>;
  triggerDueRuns(): Promise<SchedulerTickResult>;
  triggerNow(scheduleId: string): Promise<TriggerRunOutcome>;
};

export type DiscoverySchedulerConfig = {
  scheduleStore: ScheduleStore;
  runStore: RunStore;
  queue: DiscoveryExecutionQueue;
  clock: Clock;
  runIdGenerator: RunIdGenerator;
  jobIdGenerator: JobIdGenerator;
  /**
   * Cross-instance schedule lock (E5.3).
   * When omitted, a process-local no-op lock is used (single-runtime / legacy tests).
   */
  schedulerLock?: SchedulerLock;
  /**
   * Identity for lock ownership (`scheduler:{id}`).
   * Injected for deterministic multi-runtime tests.
   */
  runtimeInstanceId?: string;
  /** Lease for the enqueue critical section only (default 30s). */
  schedulerLockLeaseMs?: number;
  /** Optional side-channel telemetry (E5.5). */
  telemetry?: TelemetryEmitter;
  /**
   * When provided, enforces DiscoveryProfile.enabled before enqueue (E8).
   * Missing profiles are not gated here — pipeline remains authoritative.
   */
  profileStore?: ProfileStore;
};

/**
 * No-op lock used when callers have not yet wired E5.3 persistence.
 * Always acquires — suitable only for single-process tests.
 */
function createPassthroughSchedulerLock(): SchedulerLock {
  return {
    async tryAcquire(key, ownerId, now, leaseMs) {
      if (!key?.trim()) {
        return { acquired: false, reason: 'invalid_key', lockKey: key ?? '' };
      }
      if (!ownerId?.trim()) {
        return { acquired: false, reason: 'invalid_owner', lockKey: key };
      }
      if (!Number.isFinite(leaseMs) || leaseMs <= 0) {
        return { acquired: false, reason: 'invalid_lease', lockKey: key };
      }
      return {
        acquired: true,
        lockKey: key,
        ownerId,
        acquiredAt: now,
        expiresAt: new Date(Date.parse(now) + leaseMs).toISOString(),
      };
    },
    async release(key) {
      return { released: true, lockKey: key };
    },
    async recoverExpired() {
      return { recoveredKeys: [] };
    },
    async get() {
      return null;
    },
    async countActive() {
      return 0;
    },
  };
}

export function createDiscoveryScheduler(
  config: DiscoverySchedulerConfig
): DiscoveryScheduler {
  const { scheduleStore, runStore, queue, clock, runIdGenerator, jobIdGenerator } =
    config;
  const schedulerLock = config.schedulerLock ?? createPassthroughSchedulerLock();
  const ownerId = schedulerOwnerId(config.runtimeInstanceId ?? 'default');
  const leaseMs = config.schedulerLockLeaseMs ?? DEFAULT_SCHEDULER_LOCK_LEASE_MS;
  const telemetry = config.telemetry;
  const runtimeInstanceId = config.runtimeInstanceId;
  const profileStore = config.profileStore;

  function emitOutcome(outcome: TriggerRunOutcome): void {
    if (!telemetry) return;
    const base = {
      scheduleId: outcome.scheduleId,
      runtimeInstanceId,
    };
    if (outcome.kind === 'enqueued') {
      telemetry.emit({
        eventName: 'scheduler.triggered',
        ...base,
        runId: outcome.runId,
        jobId: outcome.jobId,
        attributes: { trigger: outcome.trigger },
      });
      telemetry.emit({
        eventName: 'scheduler.enqueued',
        ...base,
        runId: outcome.runId,
        jobId: outcome.jobId,
        attributes: { trigger: outcome.trigger },
      });
      return;
    }
    if (outcome.kind === 'skipped') {
      if (outcome.reason === 'lock_contended') {
        telemetry.emit({
          eventName: 'scheduler.lock_contended',
          ...base,
          attributes: { reason: outcome.reason },
        });
      }
      telemetry.emit({
        eventName: 'scheduler.skipped',
        ...base,
        attributes: { reason: outcome.reason },
      });
      return;
    }
    telemetry.emit({
      eventName: 'scheduler.skipped',
      ...base,
      runId: outcome.runId,
      attributes: {
        reason: 'enqueue_failed',
        errorMessage: outcome.errorMessage,
      },
    });
  }

  async function registerSchedule(
    input: RegisterScheduleInput
  ): Promise<DiscoveryScheduleRecord> {
    if (!input.scheduleId?.trim()) {
      throw new SchedulerError('scheduleId is required');
    }
    if (!Number.isFinite(input.intervalSeconds) || input.intervalSeconds <= 0) {
      throw new SchedulerError('intervalSeconds must be positive');
    }
    const now = clockIso(clock);
    const existing = await scheduleStore.get(input.scheduleId);
    const record: DiscoveryScheduleRecord = {
      scheduleId: input.scheduleId,
      profileId: input.profileId,
      strategyId: input.strategyId,
      strategyVersion: input.strategyVersion,
      enabled: input.enabled ?? true,
      interval: { kind: 'fixed_interval', intervalSeconds: input.intervalSeconds },
      timezone: input.timezone ?? 'UTC',
      nextRunAt:
        input.nextRunAt ??
        existing?.nextRunAt ??
        initialNextRunAt(now, input.intervalSeconds),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      runningRunId: null,
      metadata: input.metadata ? { ...input.metadata } : existing?.metadata,
    };
    await scheduleStore.upsert(record);
    return structuredClone(record);
  }

  async function disableSchedule(
    scheduleId: string
  ): Promise<DiscoveryScheduleRecord | null> {
    const existing = await scheduleStore.get(scheduleId);
    if (!existing) return null;
    const now = clockIso(clock);
    const updated: DiscoveryScheduleRecord = {
      ...existing,
      enabled: false,
      updatedAt: now,
    };
    await scheduleStore.upsert(updated);
    return structuredClone(updated);
  }

  async function enableSchedule(
    scheduleId: string
  ): Promise<DiscoveryScheduleRecord | null> {
    const existing = await scheduleStore.get(scheduleId);
    if (!existing) return null;
    const now = clockIso(clock);
    const updated: DiscoveryScheduleRecord = {
      ...existing,
      enabled: true,
      nextRunAt: initialNextRunAt(now, existing.interval.intervalSeconds),
      updatedAt: now,
    };
    await scheduleStore.upsert(updated);
    return structuredClone(updated);
  }

  async function triggerDueRuns(): Promise<SchedulerTickResult> {
    const now = clockIso(clock);
    const due = await scheduleStore.getDueSchedules(now);
    const outcomes: TriggerRunOutcome[] = [];
    for (const schedule of due) {
      const outcome = await enqueueOne(schedule.scheduleId, 'scheduled', {
        requireDue: true,
      });
      emitOutcome(outcome);
      outcomes.push(outcome);
    }
    return { outcomes };
  }

  async function triggerNow(scheduleId: string): Promise<TriggerRunOutcome> {
    // Manual triggers use the same schedule lock (smallest consistent model).
    // nextRunAt is still not advanced.
    const outcome = await enqueueOne(scheduleId, 'manual', { requireDue: false });
    emitOutcome(outcome);
    return outcome;
  }

  async function enqueueOne(
    scheduleId: string,
    trigger: ScheduleRunTrigger,
    claim: { requireDue: boolean }
  ): Promise<TriggerRunOutcome> {
    const now = clockIso(clock);
    const lockKey = scheduleLockKey(scheduleId);

    // Recover expired locks opportunistically before acquire (no timers).
    await schedulerLock.recoverExpired(now);

    const lockResult = await schedulerLock.tryAcquire(
      lockKey,
      ownerId,
      now,
      leaseMs
    );
    if (!lockResult.acquired) {
      return { kind: 'skipped', scheduleId, reason: 'lock_contended' };
    }

    try {
      const schedule = await scheduleStore.get(scheduleId);
      if (!schedule) {
        return { kind: 'skipped', scheduleId, reason: 'not_found' };
      }
      if (!schedule.enabled) {
        return { kind: 'skipped', scheduleId, reason: 'disabled' };
      }
      if (trigger === 'scheduled' && Date.parse(schedule.nextRunAt) > Date.parse(now)) {
        return { kind: 'skipped', scheduleId, reason: 'not_due' };
      }
      if (schedule.runningRunId) {
        return { kind: 'skipped', scheduleId, reason: 'already_running' };
      }
      if (profileStore) {
        const profile = await profileStore.get(schedule.profileId);
        if (profile !== null && !profile.enabled) {
          return { kind: 'skipped', scheduleId, reason: 'profile_disabled' };
        }
      }

      const runId = runIdGenerator();
      const jobId = jobIdGenerator();
      const claimed = await scheduleStore.tryClaim(scheduleId, runId, now, {
        requireDue: claim.requireDue,
      });
      if (!claimed) {
        return { kind: 'skipped', scheduleId, reason: 'claim_failed' };
      }

      const scheduledAt = schedule.nextRunAt;
      const runRecord: ScheduledRunRecord = {
        runId,
        scheduleId,
        profileId: schedule.profileId,
        trigger,
        startedAt: now,
        status: 'PENDING',
      };

      try {
        await runStore.insert(runRecord);
      } catch (err) {
        await scheduleStore.clearRunningLock(scheduleId, now, runId);
        const message = err instanceof Error ? err.message : 'Run metadata insert failed';
        return { kind: 'failed', scheduleId, runId, trigger, errorMessage: message };
      }

      const enqueued = await queue.enqueue({
        jobId,
        runId,
        scheduleId,
        profileId: schedule.profileId,
        strategyId: schedule.strategyId,
        strategyVersion: schedule.strategyVersion,
        trigger,
        requestedAt: now,
      });

      if (!enqueued.ok) {
        await scheduleStore.clearRunningLock(scheduleId, now, runId);
        return {
          kind: 'skipped',
          scheduleId,
          reason: 'duplicate_enqueue',
        };
      }

      if (trigger === 'scheduled') {
        const nextRunAt = calculateNextRunAt(
          scheduledAt,
          schedule.interval.intervalSeconds,
          now
        );
        await scheduleStore.advanceNextRunAt(scheduleId, nextRunAt, now);
      }

      return {
        kind: 'enqueued',
        scheduleId,
        runId,
        jobId,
        trigger,
      };
    } finally {
      // Lock covers enqueue only — never held across worker/pipeline execution.
      await schedulerLock.release(lockKey, ownerId);
    }
  }

  return {
    registerSchedule,
    disableSchedule,
    enableSchedule,
    triggerDueRuns,
    triggerNow,
  };
}

export function createIncrementingRunIdGenerator(prefix = 'run'): RunIdGenerator {
  let seq = 0;
  return () => {
    seq += 1;
    return `${prefix}-${seq}`;
  };
}

export function createIncrementingJobIdGenerator(prefix = 'job'): JobIdGenerator {
  let seq = 0;
  return () => {
    seq += 1;
    return `${prefix}-${seq}`;
  };
}
