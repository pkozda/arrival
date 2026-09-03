export { QueueError } from './errors.js';

export type {
  DiscoveryExecutionJob,
  DiscoveryExecutionJobStatus,
  EnqueueJobInput,
  EnqueueResult,
  EnqueueDuplicateReason,
  JobIdGenerator,
  WorkerProcessResult,
} from './types.js';

export type {
  DiscoveryExecutionQueue,
  QueueClaimOptions,
  QueueAckOptions,
  QueueRetryOptions,
  RecoverExpiredClaimsResult,
} from './execution-queue.js';

export type {
  DiscoveryExecutionWorker,
  DiscoveryExecutionWorkerConfig,
  NotificationTarget,
} from './worker.js';
export { createDiscoveryExecutionWorker } from './worker.js';

export { createInMemoryExecutionQueue } from './fakes/in-memory-execution-queue.js';
export type { InMemoryExecutionQueueOptions } from './fakes/in-memory-execution-queue.js';

export type {
  DiscoveryExecutionRetryPolicy,
  ExecutionRetryConfig,
  RetryDecision,
  RetryDecisionInput,
} from './execution-retry-policy.js';
export {
  DEFAULT_EXECUTION_RETRY_CONFIG,
  computeBackoffDelayMs,
  createDefaultExecutionRetryPolicy,
  toExecutionAdapterFailure,
} from './execution-retry-policy.js';
