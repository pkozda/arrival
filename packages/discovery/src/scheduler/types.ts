import type { DiscoveryRunStatus } from '../types/run.js';

/** Fixed-interval recurrence — no cron expressions in E4.2. */
export type ScheduleInterval = {
  kind: 'fixed_interval';
  intervalSeconds: number;
};

/**
 * Scheduler-owned schedule record (distinct from profile DiscoverySchedule cadence).
 * Durable across restarts when backed by ScheduleStore.
 */
export type DiscoveryScheduleRecord = {
  scheduleId: string;
  profileId: string;
  strategyId: string;
  strategyVersion: string;
  enabled: boolean;
  interval: ScheduleInterval;
  /** IANA timezone label for schedule timestamps (interpretation only in E4.2). */
  timezone: string;
  /** Next scheduled execution instant (ISO). Advanced from scheduled time, not wall-clock finish. */
  nextRunAt: string;
  createdAt: string;
  updatedAt: string;
  /** Process-local overlap guard — at most one active run per schedule. */
  runningRunId: string | null;
  metadata?: Record<string, string>;
};

export type ScheduleRunTrigger = 'scheduled' | 'manual';

/** Scheduler run metadata — not a substitute for pipeline DiscoveryRun or ResultStore. */
export type ScheduledRunRecord = {
  runId: string;
  scheduleId: string;
  profileId: string;
  trigger: ScheduleRunTrigger;
  startedAt: string;
  finishedAt?: string;
  status: DiscoveryRunStatus;
  skipReason?: string;
  errorMessage?: string;
};

export type RegisterScheduleInput = {
  scheduleId: string;
  profileId: string;
  strategyId: string;
  strategyVersion: string;
  intervalSeconds: number;
  timezone?: string;
  enabled?: boolean;
  /** When omitted, next run is now + interval from scheduler clock. */
  nextRunAt?: string;
  metadata?: Record<string, string>;
};

export type TriggerSkipReason =
  | 'disabled'
  | 'not_due'
  | 'already_running'
  | 'not_found'
  | 'claim_failed'
  | 'duplicate_enqueue'
  /** Another scheduler holds the schedule lock (E5.3). */
  | 'lock_contended';

export type TriggerRunOutcome =
  | {
      kind: 'enqueued';
      scheduleId: string;
      runId: string;
      jobId: string;
      trigger: ScheduleRunTrigger;
    }
  | { kind: 'skipped'; scheduleId: string; reason: TriggerSkipReason }
  | {
      kind: 'failed';
      scheduleId: string;
      runId: string;
      trigger: ScheduleRunTrigger;
      errorMessage: string;
    };

export type SchedulerTickResult = {
  outcomes: TriggerRunOutcome[];
};

export type RunIdGenerator = () => string;
export type JobIdGenerator = () => string;
