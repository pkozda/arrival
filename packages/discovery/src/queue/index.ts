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

export type { DiscoveryExecutionQueue } from './execution-queue.js';

export type {
  DiscoveryExecutionWorker,
  DiscoveryExecutionWorkerConfig,
  NotificationTarget,
} from './worker.js';
export { createDiscoveryExecutionWorker } from './worker.js';

export { createInMemoryExecutionQueue } from './fakes/in-memory-execution-queue.js';
