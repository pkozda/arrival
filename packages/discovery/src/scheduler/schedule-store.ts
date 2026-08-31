import type { DiscoveryScheduleRecord } from './types.js';

/**
 * Storage-neutral schedule port.
 * Scheduler never depends on SQLite/ORM types.
 */
export interface ScheduleStore {
  upsert(schedule: DiscoveryScheduleRecord): Promise<void>;
  get(scheduleId: string): Promise<DiscoveryScheduleRecord | null>;
  listEnabled(): Promise<DiscoveryScheduleRecord[]>;
  /** Enabled schedules with nextRunAt <= now and not currently running. */
  getDueSchedules(now: string): Promise<DiscoveryScheduleRecord[]>;
  /**
   * Atomically claim a schedule for execution.
   * When requireDue is true (scheduled tick), nextRunAt must be <= now.
   */
  tryClaim(
    scheduleId: string,
    runId: string,
    now: string,
    options?: { requireDue?: boolean }
  ): Promise<boolean>;
  /** Clear running lock after worker completes; does not change nextRunAt. */
  clearRunningLock(scheduleId: string, now: string): Promise<void>;
  /** Advance nextRunAt on enqueue (scheduled); keeps runningRunId set. */
  advanceNextRunAt(scheduleId: string, nextRunAt: string, now: string): Promise<void>;
  /** @deprecated Use clearRunningLock — retained for backward compatibility in tests */
  releaseAfterRun(
    scheduleId: string,
    nextRunAt: string,
    now: string
  ): Promise<void>;
}
