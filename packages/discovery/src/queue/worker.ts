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
import {
  createDefaultExecutionRetryPolicy,
  DEFAULT_EXECUTION_RETRY_CONFIG,
  toExecutionAdapterFailure,
  type DiscoveryExecutionRetryPolicy,
  type ExecutionRetryConfig,
} from './execution-retry-policy.js';
import type { TelemetryEmitter } from '../telemetry/emitter.js';

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
  /**
   * Stable process-local claim identity for durable queue leases (E5.2).
   * Injected for deterministic tests — not derived from hostname/PID.
   */
  workerId?: string;
  /** Optional — invoked after successful pipeline execution (E4.4). */
  notificationService?: DiscoveryNotificationService;
  resolveNotificationTarget?: (input: {
    profileId: string;
    runId: string;
  }) => NotificationTarget | null;
  /**
   * Durable execution retry policy (E5.4).
   * When omitted, uses default engine-wide policy.
   */
  retryPolicy?: DiscoveryExecutionRetryPolicy;
  /** Overrides for the default retry policy when retryPolicy is omitted. */
  retryConfig?: Partial<ExecutionRetryConfig>;
  /** Optional side-channel telemetry (E5.5). */
  telemetry?: TelemetryEmitter;
  runtimeInstanceId?: string;
};

/**
 * Dequeues and executes discovery jobs via the existing pipeline executor.
 * No discovery business logic — infrastructure only.
 *
 * On thrown execution failures, applies DiscoveryExecutionRetryPolicy:
 * RETRY → queue.retry (same jobId/runId); NO_RETRY → terminal fail.
 *
 * PARTIAL_SUCCESS / SUCCESS from the pipeline are never auto-retried.
 * Cancellation is never auto-retried.
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
  const workerId = config.workerId ?? 'worker-1';
  const claim = { claimOwner: workerId };
  const retryPolicy =
    config.retryPolicy ?? createDefaultExecutionRetryPolicy(config.retryConfig);
  const maxAttempts =
    config.retryConfig?.maxAttempts ?? DEFAULT_EXECUTION_RETRY_CONFIG.maxAttempts;
  const telemetry = config.telemetry;
  const runtimeInstanceId = config.runtimeInstanceId;

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

  async function clearLockForJob(scheduleId: string, runId: string, at: string) {
    await scheduleStore.clearRunningLock(scheduleId, at, runId);
  }

  async function processJob(
    job: NonNullable<Awaited<ReturnType<DiscoveryExecutionQueue['get']>>>
  ): Promise<WorkerProcessResult> {
    if (job.status === 'COMPLETED' || job.status === 'FAILED') {
      return { kind: 'skipped', jobId: job.jobId, reason: 'already_terminal' };
    }

    if (
      job.status === 'RUNNING' &&
      job.claimOwner &&
      job.claimOwner !== workerId
    ) {
      return { kind: 'skipped', jobId: job.jobId, reason: 'claimed_by_other' };
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
      await queue.ack(job.jobId, clockIso(clock), claim);
      await clearLockForJob(job.scheduleId, job.runId, clockIso(clock));
      return {
        kind: 'skipped',
        jobId: job.jobId,
        reason: 'run_already_finished',
      };
    }

    const startedAt = clockIso(clock);
    const workerStartedMs = clock.now().getTime();
    telemetry?.emit({
      eventName: 'worker.started',
      runId: job.runId,
      jobId: job.jobId,
      scheduleId: job.scheduleId,
      profileId: job.profileId,
      strategyId: job.strategyId,
      attempt: job.attempt,
      runtimeInstanceId,
    });

    if (existingRun) {
      await runStore.update({
        ...existingRun,
        status: 'RUNNING',
        startedAt,
        finishedAt: undefined,
        errorMessage: undefined,
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

      // Domain outcomes (SUCCESS / PARTIAL_SUCCESS / FAILED) are not auto-retried.
      if (existingRun) {
        await runStore.update({
          ...existingRun,
          finishedAt,
          status: pipelineResult.run.status,
        });
      }

      await tryDeliverNotifications(pipelineResult, job.profileId, job.runId);

      await queue.ack(job.jobId, finishedAt, claim);
      await clearLockForJob(job.scheduleId, job.runId, finishedAt);

      const durationMs = Math.max(0, clock.now().getTime() - workerStartedMs);
      if (pipelineResult.run.status === 'CANCELLED') {
        telemetry?.emit({
          eventName: 'worker.cancelled',
          runId: job.runId,
          jobId: job.jobId,
          scheduleId: job.scheduleId,
          profileId: job.profileId,
          strategyId: job.strategyId,
          attempt: job.attempt,
          runtimeInstanceId,
          durationMs,
          attributes: { pipelineStatus: pipelineResult.run.status },
        });
      } else if (pipelineResult.run.status === 'FAILED') {
        telemetry?.emit({
          eventName: 'worker.failed',
          runId: job.runId,
          jobId: job.jobId,
          scheduleId: job.scheduleId,
          profileId: job.profileId,
          strategyId: job.strategyId,
          attempt: job.attempt,
          runtimeInstanceId,
          durationMs,
          attributes: { pipelineStatus: pipelineResult.run.status },
        });
      } else {
        telemetry?.emit({
          eventName: 'worker.completed',
          runId: job.runId,
          jobId: job.jobId,
          scheduleId: job.scheduleId,
          profileId: job.profileId,
          strategyId: job.strategyId,
          attempt: job.attempt,
          runtimeInstanceId,
          durationMs,
          attributes: { pipelineStatus: pipelineResult.run.status },
        });
      }

      return {
        kind: 'processed',
        jobId: job.jobId,
        runId: job.runId,
        pipelineStatus: pipelineResult.run.status,
      };
    } catch (err) {
      const now = clockIso(clock);
      const failure = toExecutionAdapterFailure(err);
      const decision = retryPolicy.decide({
        failure,
        attempt: job.attempt,
        now,
      });
      const durationMs = Math.max(0, clock.now().getTime() - workerStartedMs);

      if (decision.kind === 'retry') {
        // Keep runningRunId — retry is same run; do not reacquire scheduler lock.
        if (existingRun) {
          await runStore.update({
            ...existingRun,
            status: 'RUNNING',
            startedAt: existingRun.startedAt ?? startedAt,
            finishedAt: undefined,
            errorMessage: failure.message,
          });
        }

        await queue.retry(job.jobId, decision.availableAt, failure.message, {
          ...claim,
          metadata: {
            lastFailureCode: decision.failureCode,
            lastFailureReason: failure.message,
            nextRetryAt: decision.availableAt,
            retryDiagnostic: decision.diagnostic,
          },
        });

        telemetry?.emit({
          eventName: 'worker.retry_scheduled',
          runId: job.runId,
          jobId: job.jobId,
          scheduleId: job.scheduleId,
          profileId: job.profileId,
          strategyId: job.strategyId,
          attempt: decision.nextAttempt,
          runtimeInstanceId,
          durationMs,
          attributes: {
            failureCode: decision.failureCode,
            availableAt: decision.availableAt,
            maxAttempts,
          },
        });
        telemetry?.emit({
          eventName: 'retry.scheduled',
          runId: job.runId,
          jobId: job.jobId,
          scheduleId: job.scheduleId,
          profileId: job.profileId,
          strategyId: job.strategyId,
          attempt: decision.nextAttempt,
          runtimeInstanceId,
          attributes: {
            failureCode: decision.failureCode,
            availableAt: decision.availableAt,
            maxAttempts,
            reason: failure.message,
          },
        });

        return {
          kind: 'retry_scheduled',
          jobId: job.jobId,
          runId: job.runId,
          attempt: decision.nextAttempt,
          availableAt: decision.availableAt,
          failureCode: decision.failureCode,
          diagnostic: 'RETRY_SCHEDULED',
        };
      }

      if (existingRun) {
        await runStore.update({
          ...existingRun,
          finishedAt: now,
          status: 'FAILED',
          errorMessage: failure.message,
        });
      }

      await queue.fail(job.jobId, now, failure.message, claim);
      await clearLockForJob(job.scheduleId, job.runId, now);

      telemetry?.emit({
        eventName: 'worker.failed',
        runId: job.runId,
        jobId: job.jobId,
        scheduleId: job.scheduleId,
        profileId: job.profileId,
        strategyId: job.strategyId,
        attempt: job.attempt,
        runtimeInstanceId,
        durationMs,
        attributes: {
          failureCode: failure.code,
          pipelineStatus: 'FAILED',
        },
      });
      telemetry?.emit({
        eventName:
          decision.kind === 'no_retry' && decision.reason === 'retry_exhausted'
            ? 'retry.exhausted'
            : 'retry.not_allowed',
        runId: job.runId,
        jobId: job.jobId,
        scheduleId: job.scheduleId,
        profileId: job.profileId,
        strategyId: job.strategyId,
        attempt: job.attempt,
        runtimeInstanceId,
        attributes: {
          failureCode: failure.code,
          reason: decision.kind === 'no_retry' ? decision.reason : 'unknown',
        },
      });

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
      const job = await queue.dequeue(claim);
      if (!job) return { kind: 'empty' };
      return processJob(job);
    },

    async process(jobId: string): Promise<WorkerProcessResult> {
      const job = await queue.get(jobId);
      if (!job) {
        return { kind: 'skipped', jobId, reason: 'not_found' };
      }
      if (job.status === 'QUEUED') {
        const dequeued = await queue.dequeue(claim);
        if (!dequeued || dequeued.jobId !== jobId) {
          return { kind: 'skipped', jobId, reason: 'not_head_of_queue' };
        }
        return processJob(dequeued);
      }
      return processJob(job);
    },
  };
}
