import type {
  DiscoveryExecutionJob,
  EnqueueJobInput,
  EnqueueResult,
} from './types.js';

/**
 * Storage-neutral execution queue port (E4.3).
 * No broker/SQLite types leak into this contract.
 */
export interface DiscoveryExecutionQueue {
  enqueue(input: EnqueueJobInput): Promise<EnqueueResult>;
  /** FIFO dequeue; marks job RUNNING. Returns null when empty. */
  dequeue(): Promise<DiscoveryExecutionJob | null>;
  ack(jobId: string, finishedAt: string): Promise<void>;
  fail(jobId: string, finishedAt: string, reason: string): Promise<void>;
  get(jobId: string): Promise<DiscoveryExecutionJob | null>;
  getByRunId(runId: string): Promise<DiscoveryExecutionJob | null>;
  /** Jobs still waiting to be dequeued. */
  getPending(): Promise<DiscoveryExecutionJob[]>;
  /** True when runId has a QUEUED or RUNNING job. */
  hasActiveRun(runId: string): Promise<boolean>;
}
