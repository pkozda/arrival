import type { ScheduleRunTrigger } from '../scheduler/types.js';

/** Queue infrastructure lifecycle — distinct from pipeline DiscoveryRunStatus. */
export type DiscoveryExecutionJobStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

/**
 * Queue message identity. Not interchangeable with runId.
 * jobId = delivery/queue identity; runId = discovery execution identity.
 */
export type DiscoveryExecutionJob = {
  jobId: string;
  runId: string;
  scheduleId: string;
  profileId: string;
  strategyId: string;
  strategyVersion: string;
  trigger: ScheduleRunTrigger;
  requestedAt: string;
  attempt: number;
  status: DiscoveryExecutionJobStatus;
  startedAt?: string;
  finishedAt?: string;
  failureReason?: string;
  /** Safe string map only — never secrets / tokens / auth headers. */
  metadata?: Record<string, string>;
  /** When the job becomes claimable (E5.2 durable queue). */
  availableAt?: string;
  /** Claim lease start (E5.2). */
  claimedAt?: string;
  /** Worker identity that owns the claim (E5.2). */
  claimOwner?: string;
};

export type EnqueueJobInput = {
  jobId: string;
  runId: string;
  scheduleId: string;
  profileId: string;
  strategyId: string;
  strategyVersion: string;
  trigger: ScheduleRunTrigger;
  requestedAt: string;
  metadata?: Record<string, string>;
};

export type EnqueueDuplicateReason = 'duplicate_run_id' | 'duplicate_job_id';

export type EnqueueResult =
  | { ok: true; job: DiscoveryExecutionJob }
  | { ok: false; reason: EnqueueDuplicateReason };

export type JobIdGenerator = () => string;

export type WorkerProcessResult =
  | { kind: 'processed'; jobId: string; runId: string; pipelineStatus: string }
  | {
      kind: 'retry_scheduled';
      jobId: string;
      runId: string;
      attempt: number;
      availableAt: string;
      failureCode: string;
      diagnostic: 'RETRY_SCHEDULED';
    }
  | { kind: 'empty' }
  | { kind: 'skipped'; jobId: string; reason: string };
