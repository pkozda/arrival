import { QueueError } from '../errors.js';
import type { DiscoveryExecutionQueue } from '../execution-queue.js';
import type { DiscoveryExecutionJob, EnqueueJobInput, EnqueueResult } from '../types.js';

export function createInMemoryExecutionQueue(
  seed: DiscoveryExecutionJob[] = []
): DiscoveryExecutionQueue & {
  snapshot(): DiscoveryExecutionJob[];
  size(): number;
} {
  const jobs = new Map<string, DiscoveryExecutionJob>(
    seed.map((j) => [j.jobId, structuredClone(j)])
  );
  const fifo: string[] = seed
    .filter((j) => j.status === 'QUEUED')
    .sort((a, b) => Date.parse(a.requestedAt) - Date.parse(b.requestedAt))
    .map((j) => j.jobId);
  const activeRunIds = new Set(
    seed.filter((j) => j.status === 'QUEUED' || j.status === 'RUNNING').map((j) => j.runId)
  );

  function clone(job: DiscoveryExecutionJob): DiscoveryExecutionJob {
    return structuredClone(job);
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
      };
      jobs.set(job.jobId, clone(job));
      fifo.push(job.jobId);
      activeRunIds.add(job.runId);
      return { ok: true, job: clone(job) };
    },

    async dequeue(): Promise<DiscoveryExecutionJob | null> {
      while (fifo.length > 0) {
        const jobId = fifo.shift()!;
        const job = jobs.get(jobId);
        if (!job || job.status !== 'QUEUED') continue;
        const running: DiscoveryExecutionJob = {
          ...job,
          status: 'RUNNING',
          startedAt: job.requestedAt,
        };
        jobs.set(jobId, running);
        return clone(running);
      }
      return null;
    },

    async ack(jobId, finishedAt) {
      const job = jobs.get(jobId);
      if (!job) throw new QueueError(`Job not found: ${jobId}`);
      if (job.status === 'COMPLETED') return;
      jobs.set(jobId, {
        ...job,
        status: 'COMPLETED',
        finishedAt,
      });
      activeRunIds.delete(job.runId);
    },

    async fail(jobId, finishedAt, reason) {
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
        .sort((a, b) => Date.parse(a.requestedAt) - Date.parse(b.requestedAt))
        .map(clone);
    },

    async hasActiveRun(runId) {
      return activeRunIds.has(runId);
    },

    snapshot() {
      return [...jobs.values()].map(clone);
    },

    size() {
      return jobs.size;
    },
  };
}
