import type { DiscoveryScheduleRecord } from './types.js';

/**
 * Storage-neutral schedule port.
 * Scheduler never depends on SQLite/ORM types.
 */
export interface ScheduleStore {
  upsert(schedule: DiscoveryScheduleRecord): Promise<void>;
  get(scheduleId: string): Promise<DiscoveryScheduleRecord | null>;
  listEnabled(): Promise<DiscoveryScheduleRecord[]>;
  /** All schedules (enabled + disabled) — read-only health/inspection (E5.6). */
  listAll(): Promise<DiscoveryScheduleRecord[]>;
  /** Enabled schedules with nextRunAt <= now and not currently running. */
  getDueSchedules(now: string): Promise<DiscoveryScheduleRecord[]>;
  /**
   * Atomically claim a schedule for execution.
   * When requireDue is true (scheduled tick), nextRunAt must be <= now.
   * When `nextRunAt` is provided, advances the schedule slot in the same claim
   * (prevents crash windows where a job is enqueued but nextRunAt is stale).
   */
  tryClaim(
    scheduleId: string,
    runId: string,
    now: string,
    options?: { requireDue?: boolean; nextRunAt?: string }
  ): Promise<boolean>;
  /**
   * Clear running lock after worker completes; does not change nextRunAt.
   * When `expectedRunId` is provided, clears only if `runningRunId` matches
   * (stale workers must not clear a newer run's lock).
   */
  clearRunningLock(
    scheduleId: string,
    now: string,
    expectedRunId?: string
  ): Promise<void>;
  /** Advance nextRunAt on enqueue (scheduled); keeps runningRunId set. */
  advanceNextRunAt(scheduleId: string, nextRunAt: string, now: string): Promise<void>;
  /** @deprecated Use clearRunningLock — retained for backward compatibility in tests */
  releaseAfterRun(
    scheduleId: string,
    nextRunAt: string,
    now: string
  ): Promise<void>;
}
