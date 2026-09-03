import type {
  DiscoveryExecutionJob,
  EnqueueJobInput,
  EnqueueResult,
} from './types.js';

/**
 * Optional claim ownership for durable queue operations (E5.2).
 * In-memory queue ignores claim ownership.
 */
export type QueueClaimOptions = {
  claimOwner?: string;
};

export type QueueRetryOptions = QueueClaimOptions & {
  /** Safe string metadata merged into the job record. */
  metadata?: Record<string, string>;
};

export type QueueAckOptions = QueueClaimOptions & {
  /** Safe string metadata merged into the job record on completion. */
  metadata?: Record<string, string>;
};

export type RecoverExpiredClaimsResult = {
  recoveredJobIds: readonly string[];
};

/**
 * Storage-neutral execution queue port (E4.3 + E5.2 recovery + E5.4 retry).
 * No broker/SQLite types leak into this contract.
 *
 * Delivery semantics (durable): **at-least-once** after crash recovery.
 */
export interface DiscoveryExecutionQueue {
  enqueue(input: EnqueueJobInput): Promise<EnqueueResult>;
  /**
   * FIFO dequeue of the next available QUEUED job (`availableAt <= now`);
   * marks job RUNNING. Durable implementations record claimOwner / claimedAt.
   * Returns null when empty.
   */
  dequeue(options?: QueueClaimOptions): Promise<DiscoveryExecutionJob | null>;
  ack(
    jobId: string,
    finishedAt: string,
    options?: QueueAckOptions
  ): Promise<void>;
  fail(
    jobId: string,
    finishedAt: string,
    reason: string,
    options?: QueueClaimOptions
  ): Promise<void>;
  /**
   * Policy retry (E5.4): RUNNING → QUEUED with future availableAt.
   * Increments attempt exactly once. Preserves jobId and runId.
   * Distinct from recoverExpiredClaims (lease recovery).
   */
  retry(
    jobId: string,
    availableAt: string,
    reason: string,
    options?: QueueRetryOptions
  ): Promise<void>;
  get(jobId: string): Promise<DiscoveryExecutionJob | null>;
  getByRunId(runId: string): Promise<DiscoveryExecutionJob | null>;
  /** Jobs still waiting to be dequeued (including delayed retries). */
  getPending(): Promise<DiscoveryExecutionJob[]>;
  /** True when runId has a QUEUED or RUNNING job. */
  hasActiveRun(runId: string): Promise<boolean>;
  /**
   * Requeue RUNNING jobs whose claim lease has expired.
   * Same runId is preserved. Increments attempt (lease recovery — not policy retry).
   */
  recoverExpiredClaims(now: string): Promise<RecoverExpiredClaimsResult>;
  /**
   * Read-only queue aggregates for operational health (E5.6).
   * Must not mutate jobs, recover claims, or execute work.
   * `visibilityTimeoutMs` is used only to count recoverable expired claims.
   */
  getHealthStats(
    now: string,
    options?: { visibilityTimeoutMs?: number }
  ): Promise<import('../runtime/health.js').QueueHealthStats>;
}
