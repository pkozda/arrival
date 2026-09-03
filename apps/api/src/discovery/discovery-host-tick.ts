import type {
  SchedulerTickResult,
  TriggerRunOutcome,
  WorkerProcessResult,
} from '@arrival-atlas/discovery';
import { getDiscoveryExecutionService } from './discovery-execution-runtime.js';

export type DiscoveryHostTickProcessedJob = {
  kind: WorkerProcessResult['kind'];
  jobId?: string;
  runId?: string;
  pipelineStatus?: string;
  reason?: string;
};

export type DiscoveryHostTickResult = {
  enqueued: number;
  skipped: number;
  outcomes: TriggerRunOutcome[];
  processedJobs: DiscoveryHostTickProcessedJob[];
};

const DEFAULT_MAX_PROCESS_ITERATIONS = 50;

/**
 * Pull-driven host tick (E10.3): enqueue due operational schedules, then drain
 * the execution queue through the existing worker. Safe to invoke repeatedly.
 *
 * Production hosts should call this on a wall-clock cadence (e.g. platform cron
 * hitting POST /api/ops/discovery/trigger-due-runs with ARRIVAL_ATLAS_OPS_TOKEN).
 * No in-process daemon.
 */
export async function executeDiscoveryHostTick(input?: {
  maxProcessIterations?: number;
}): Promise<DiscoveryHostTickResult> {
  const discoveryService = getDiscoveryExecutionService();
  await discoveryService.start();

  const tick: SchedulerTickResult = await discoveryService.triggerDueRuns();
  const outcomes = tick.outcomes;
  const enqueued = outcomes.filter((o) => o.kind === 'enqueued').length;
  const skipped = outcomes.filter((o) => o.kind === 'skipped').length;

  const processedJobs: DiscoveryHostTickProcessedJob[] = [];
  const max = input?.maxProcessIterations ?? DEFAULT_MAX_PROCESS_ITERATIONS;

  for (let i = 0; i < max; i++) {
    const worker = await discoveryService.processNext();
    if (worker.kind === 'empty') {
      break;
    }
    processedJobs.push(mapWorkerResult(worker));
  }

  return { enqueued, skipped, outcomes, processedJobs };
}

function mapWorkerResult(worker: WorkerProcessResult): DiscoveryHostTickProcessedJob {
  switch (worker.kind) {
    case 'processed':
      return {
        kind: worker.kind,
        jobId: worker.jobId,
        runId: worker.runId,
        pipelineStatus: worker.pipelineStatus,
      };
    case 'retry_scheduled':
      return {
        kind: worker.kind,
        jobId: worker.jobId,
        runId: worker.runId,
      };
    case 'skipped':
      return {
        kind: worker.kind,
        jobId: worker.jobId,
        reason: worker.reason,
      };
    case 'empty':
      return { kind: worker.kind };
    default: {
      const _exhaustive: never = worker;
      return _exhaustive;
    }
  }
}
