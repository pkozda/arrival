import type { Clock } from '../scheduler/clock.js';
import { clockIso } from '../scheduler/clock.js';
import type { DiscoveryRunExecutor } from '../scheduler/executor.js';
import type { RunStore } from '../scheduler/run-store.js';
import type { ScheduleStore } from '../scheduler/schedule-store.js';
import type { DiscoveryExecutionQueue } from './execution-queue.js';
import type { WorkerProcessResult } from './types.js';
import type { DiscoveryNotificationService } from '../notifications/notification-service.js';
import type {
  NotificationChannel,
  NotificationRecipient,
} from '../notifications/types.js';

export type DiscoveryExecutionWorker = {
  processNext(): Promise<WorkerProcessResult>;
  process(jobId: string): Promise<WorkerProcessResult>;
};

export type NotificationTarget = {
  recipient: NotificationRecipient;
  channel: NotificationChannel;
};

export type DiscoveryExecutionWorkerConfig = {
  queue: DiscoveryExecutionQueue;
  executor: DiscoveryRunExecutor;
  runStore: RunStore;
  scheduleStore: ScheduleStore;
  clock: Clock;
  /** Optional — invoked after successful pipeline execution (E4.4). */
  notificationService?: DiscoveryNotificationService;
  resolveNotificationTarget?: (input: {
    profileId: string;
    runId: string;
  }) => NotificationTarget | null;
};

/**
 * Dequeues and executes discovery jobs via the existing pipeline executor.
 * No discovery business logic — infrastructure only.
 */
export function createDiscoveryExecutionWorker(
  config: DiscoveryExecutionWorkerConfig
): DiscoveryExecutionWorker {
  const {
    queue,
    executor,
    runStore,
    scheduleStore,
    clock,
    notificationService,
    resolveNotificationTarget,
  } = config;

  async function tryDeliverNotifications(
    pipelineResult: Awaited<ReturnType<DiscoveryRunExecutor['execute']>>,
    profileId: string,
    runId: string
  ): Promise<void> {
    if (!notificationService || !resolveNotificationTarget || !pipelineResult.digest) {
      return;
    }
    if (
      pipelineResult.run.status !== 'SUCCESS' &&
      pipelineResult.run.status !== 'PARTIAL_SUCCESS'
    ) {
      return;
    }
    const target = resolveNotificationTarget({ profileId, runId });
    if (!target) return;
    try {
      await notificationService.deliverDigest({
        digest: pipelineResult.digest,
        recipient: target.recipient,
        channel: target.channel,
      });
    } catch {
      // Notification failures must not corrupt discovery lifecycle.
    }
  }

  async function processJob(
    job: NonNullable<Awaited<ReturnType<DiscoveryExecutionQueue['get']>>>
  ): Promise<WorkerProcessResult> {
    if (job.status === 'COMPLETED' || job.status === 'FAILED') {
      return { kind: 'skipped', jobId: job.jobId, reason: 'already_terminal' };
    }

    const existingRun = await runStore.get(job.runId);
    if (
      existingRun &&
      existingRun.finishedAt &&
      (existingRun.status === 'SUCCESS' ||
        existingRun.status === 'PARTIAL_SUCCESS' ||
        existingRun.status === 'FAILED' ||
        existingRun.status === 'CANCELLED')
    ) {
      await queue.ack(job.jobId, clockIso(clock));
      await scheduleStore.clearRunningLock(job.scheduleId, clockIso(clock));
      return {
        kind: 'skipped',
        jobId: job.jobId,
        reason: 'run_already_finished',
      };
    }

    const startedAt = clockIso(clock);
    if (existingRun) {
      await runStore.update({
        ...existingRun,
        status: 'RUNNING',
        startedAt,
      });
    }

    try {
      const pipelineResult = await executor.execute({
        scheduleId: job.scheduleId,
        profileId: job.profileId,
        runId: job.runId,
        trigger: job.trigger,
      });
      const finishedAt = clockIso(clock);

      if (existingRun) {
        await runStore.update({
          ...existingRun,
          finishedAt,
          status: pipelineResult.run.status,
        });
      }

      await tryDeliverNotifications(pipelineResult, job.profileId, job.runId);

      await queue.ack(job.jobId, finishedAt);
      await scheduleStore.clearRunningLock(job.scheduleId, finishedAt);

      return {
        kind: 'processed',
        jobId: job.jobId,
        runId: job.runId,
        pipelineStatus: pipelineResult.run.status,
      };
    } catch (err) {
      const finishedAt = clockIso(clock);
      const message = err instanceof Error ? err.message : 'Executor failed';

      if (existingRun) {
        await runStore.update({
          ...existingRun,
          finishedAt,
          status: 'FAILED',
          errorMessage: message,
        });
      }

      await queue.fail(job.jobId, finishedAt, message);
      await scheduleStore.clearRunningLock(job.scheduleId, finishedAt);

      return {
        kind: 'processed',
        jobId: job.jobId,
        runId: job.runId,
        pipelineStatus: 'FAILED',
      };
    }
  }

  return {
    async processNext(): Promise<WorkerProcessResult> {
      const job = await queue.dequeue();
      if (!job) return { kind: 'empty' };
      return processJob(job);
    },

    async process(jobId: string): Promise<WorkerProcessResult> {
      const job = await queue.get(jobId);
      if (!job) {
        return { kind: 'skipped', jobId, reason: 'not_found' };
      }
      if (job.status === 'QUEUED') {
        const dequeued = await queue.dequeue();
        if (!dequeued || dequeued.jobId !== jobId) {
          return { kind: 'skipped', jobId, reason: 'not_head_of_queue' };
        }
        return processJob(dequeued);
      }
      return processJob(job);
    },
  };
}
