import type { Clock } from '../../scheduler/clock.js';
import { clockIso } from '../../scheduler/clock.js';
import { QueueError } from '../errors.js';
import type {
  DiscoveryExecutionQueue,
  QueueAckOptions,
  QueueClaimOptions,
  QueueRetryOptions,
  RecoverExpiredClaimsResult,
} from '../execution-queue.js';
import type { DiscoveryExecutionJob, EnqueueJobInput, EnqueueResult } from '../types.js';

export type InMemoryExecutionQueueOptions = {
  /** Required for availableAt-gated dequeue / delayed retries (E5.4). */
  clock?: Clock;
};

export function createInMemoryExecutionQueue(
  seed: DiscoveryExecutionJob[] = [],
  options: InMemoryExecutionQueueOptions = {}
): DiscoveryExecutionQueue & {
  snapshot(): DiscoveryExecutionJob[];
  size(): number;
} {
  const jobs = new Map<string, DiscoveryExecutionJob>(
    seed.map((j) => [j.jobId, structuredClone(j)])
  );
  const fifo: string[] = seed
    .filter((j) => j.status === 'QUEUED')
    .sort(
      (a, b) =>
        Date.parse(a.availableAt ?? a.requestedAt) -
        Date.parse(b.availableAt ?? b.requestedAt)
    )
    .map((j) => j.jobId);
  const activeRunIds = new Set(
    seed.filter((j) => j.status === 'QUEUED' || j.status === 'RUNNING').map((j) => j.runId)
  );

  function clone(job: DiscoveryExecutionJob): DiscoveryExecutionJob {
    return structuredClone(job);
  }

  function nowIso(): string {
    return options.clock ? clockIso(options.clock) : new Date().toISOString();
  }

  return {
    async enqueue(input: EnqueueJobInput): Promise<EnqueueResult> {
      if (jobs.has(input.jobId)) {
        return { ok: false, reason: 'duplicate_job_id' };
      }
      if (activeRunIds.has(input.runId)) {
        return { ok: false, reason: 'duplicate_run_id' };
      }

      const job: DiscoveryExecutionJob = {
        ...input,
        attempt: 1,
        status: 'QUEUED',
        availableAt: input.requestedAt,
      };
      jobs.set(job.jobId, clone(job));
      fifo.push(job.jobId);
      activeRunIds.add(job.runId);
      return { ok: true, job: clone(job) };
    },

    async dequeue(opts?: QueueClaimOptions): Promise<DiscoveryExecutionJob | null> {
      const now = nowIso();
      const ready: string[] = [];
      const deferred: string[] = [];
      for (const jobId of fifo) {
        const job = jobs.get(jobId);
        if (!job || job.status !== 'QUEUED') continue;
        const available = job.availableAt ?? job.requestedAt;
        if (Date.parse(available) <= Date.parse(now)) {
          ready.push(jobId);
        } else {
          deferred.push(jobId);
        }
      }
      fifo.length = 0;
      fifo.push(...deferred);

      if (ready.length === 0) return null;
      const jobId = ready.shift()!;
      fifo.unshift(...ready);
      const job = jobs.get(jobId)!;
      const running: DiscoveryExecutionJob = {
        ...job,
        status: 'RUNNING',
        startedAt: now,
        claimedAt: now,
        claimOwner: opts?.claimOwner,
      };
      jobs.set(jobId, running);
      return clone(running);
    },

    async ack(jobId, finishedAt, options?: QueueAckOptions) {
      const job = jobs.get(jobId);
      if (!job) throw new QueueError(`Job not found: ${jobId}`);
      if (job.status === 'COMPLETED') return;
      jobs.set(jobId, {
        ...job,
        status: 'COMPLETED',
        finishedAt,
        metadata: {
          ...job.metadata,
          ...options?.metadata,
        },
      });
      activeRunIds.delete(job.runId);
    },

    async fail(jobId, finishedAt, reason, _options?: QueueClaimOptions) {
      const job = jobs.get(jobId);
      if (!job) throw new QueueError(`Job not found: ${jobId}`);
      if (job.status === 'FAILED') return;
      jobs.set(jobId, {
        ...job,
        status: 'FAILED',
        finishedAt,
        failureReason: reason,
      });
      activeRunIds.delete(job.runId);
    },

    async retry(jobId, availableAt, reason, options?: QueueRetryOptions) {
      const job = jobs.get(jobId);
      if (!job) throw new QueueError(`Job not found: ${jobId}`);
      if (job.status !== 'RUNNING') {
        throw new QueueError(`Cannot retry job ${jobId} in status ${job.status}`);
      }
      if (
        options?.claimOwner &&
        job.claimOwner &&
        job.claimOwner !== options.claimOwner
      ) {
        throw new QueueError(
          `Cannot retry job ${jobId}: claimed by ${job.claimOwner}`
        );
      }
      const next: DiscoveryExecutionJob = {
        ...job,
        status: 'QUEUED',
        attempt: job.attempt + 1,
        availableAt,
        failureReason: reason,
        claimedAt: undefined,
        claimOwner: undefined,
        startedAt: undefined,
        finishedAt: undefined,
        metadata: {
          ...job.metadata,
          ...options?.metadata,
          lastFailureReason: reason,
          nextRetryAt: availableAt,
        },
      };
      jobs.set(jobId, next);
      fifo.push(jobId);
    },

    async get(jobId) {
      const job = jobs.get(jobId);
      return job ? clone(job) : null;
    },

    async getByRunId(runId) {
      for (const job of jobs.values()) {
        if (job.runId === runId) return clone(job);
      }
      return null;
    },

    async getPending() {
      return [...jobs.values()]
        .filter((j) => j.status === 'QUEUED')
        .sort(
          (a, b) =>
            Date.parse(a.availableAt ?? a.requestedAt) -
            Date.parse(b.availableAt ?? b.requestedAt)
        )
        .map(clone);
    },

    async hasActiveRun(runId) {
      return activeRunIds.has(runId);
    },

    async recoverExpiredClaims(_now: string): Promise<RecoverExpiredClaimsResult> {
      return { recoveredJobIds: [] };
    },

    async getHealthStats(now, options) {
      const visibilityTimeoutMs = options?.visibilityTimeoutMs ?? 300_000;
      const cutoffMs = Date.parse(now) - visibilityTimeoutMs;
      let queuedCount = 0;
      let runningCount = 0;
      let failedCount = 0;
      let oldestQueuedAt: string | undefined;
      let oldestRunningAt: string | undefined;
      let recoverableClaimCount = 0;

      for (const job of jobs.values()) {
        if (job.status === 'QUEUED') {
          queuedCount += 1;
          const at = job.availableAt ?? job.requestedAt;
          if (!oldestQueuedAt || Date.parse(at) < Date.parse(oldestQueuedAt)) {
            oldestQueuedAt = at;
          }
        } else if (job.status === 'RUNNING') {
          runningCount += 1;
          const at = job.claimedAt ?? job.startedAt ?? job.requestedAt;
          if (!oldestRunningAt || Date.parse(at) < Date.parse(oldestRunningAt)) {
            oldestRunningAt = at;
          }
          if (job.claimedAt && Date.parse(job.claimedAt) <= cutoffMs) {
            recoverableClaimCount += 1;
          }
        } else if (job.status === 'FAILED') {
          failedCount += 1;
        }
      }

      return {
        queuedCount,
        runningCount,
        failedCount,
        oldestQueuedAt,
        oldestRunningAt,
        recoverableClaimCount,
      };
    },

    snapshot() {
      return [...jobs.values()].map(clone);
    },

    size() {
      return jobs.size;
    },
  };
}
