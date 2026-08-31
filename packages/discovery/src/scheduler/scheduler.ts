import type { Clock } from './clock.js';
import { clockIso } from './clock.js';
import type { DiscoveryExecutionQueue } from '../queue/execution-queue.js';
import { SchedulerError } from './errors.js';
import { calculateNextRunAt, initialNextRunAt } from './recurrence.js';
import type { RunStore } from './run-store.js';
import type { ScheduleStore } from './schedule-store.js';
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
};

export function createDiscoveryScheduler(
  config: DiscoverySchedulerConfig
): DiscoveryScheduler {
  const { scheduleStore, runStore, queue, clock, runIdGenerator, jobIdGenerator } =
    config;

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
      outcomes.push(
        await enqueueOne(schedule.scheduleId, 'scheduled', { requireDue: true })
      );
    }
    return { outcomes };
  }

  async function triggerNow(scheduleId: string): Promise<TriggerRunOutcome> {
    return enqueueOne(scheduleId, 'manual', { requireDue: false });
  }

  async function enqueueOne(
    scheduleId: string,
    trigger: ScheduleRunTrigger,
    claim: { requireDue: boolean }
  ): Promise<TriggerRunOutcome> {
    const now = clockIso(clock);
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
      await scheduleStore.clearRunningLock(scheduleId, now);
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
      await scheduleStore.clearRunningLock(scheduleId, now);
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
