import type { DiscoveryService } from '../service/discovery-service.js';
import type { DiscoveryProfile } from '../types/profile.js';
import type { DiscoveryRunStatus } from '../types/run.js';
import type { ScheduledRunRecord } from '../scheduler/types.js';
import type { ResultStore } from '../pipeline/result-store.js';
import type { RunStore } from '../scheduler/run-store.js';
import { syncProfileOperationalSchedule } from './schedule-projection.js';
import {
  buildProfileRunSummaryFields,
  isTerminalDiscoveryRunStatus,
  type DiscoveryExecutionLifecycle,
} from './execution-lifecycle.js';
import type { ProfileRunNowResult, ProfileRunNowStatus } from './types.js';

export type { ProfileRunNowStatus, ProfileRunNowResult };

export function scheduleIdForProfile(profileId: string): string {
  return `sched:${profileId}`;
}

export async function ensureProfileSchedule(
  profile: DiscoveryProfile,
  discoveryService: DiscoveryService,
  now: string = new Date().toISOString()
): Promise<string> {
  const scheduleId = scheduleIdForProfile(profile.id);
  const existing = await discoveryService.getSchedule(scheduleId);
  if (!existing) {
    await syncProfileOperationalSchedule({ profile, discoveryService, now });
  }
  return scheduleId;
}

function mapRunStatus(status: DiscoveryRunStatus | undefined): ProfileRunNowStatus {
  switch (status) {
    case 'SUCCESS':
      return 'success';
    case 'PARTIAL_SUCCESS':
      return 'partial_success';
    case 'FAILED':
    case 'CANCELLED':
      return 'failed';
    case 'RUNNING':
      return 'running';
    case 'PENDING':
      return 'pending';
    default:
      return 'pending';
  }
}

async function enrichRunNowResult(input: {
  profileId: string;
  scheduleId: string;
  runId?: string;
  status: ProfileRunNowStatus;
  skipReason?: string;
  errorMessage?: string;
  lastRun?: ScheduledRunRecord | null;
  resultStore?: ResultStore;
  lifecycleOverride?: DiscoveryExecutionLifecycle;
}): Promise<ProfileRunNowResult> {
  const results = input.resultStore
    ? await input.resultStore.listByProfile(input.profileId)
    : [];
  const summary = buildProfileRunSummaryFields({
    profileId: input.profileId,
    lastRun: input.lastRun ?? null,
    results,
  });
  return {
    profileId: input.profileId,
    scheduleId: input.scheduleId,
    runId: input.runId ?? input.lastRun?.runId,
    status: input.status,
    skipReason: input.skipReason,
    errorMessage: input.errorMessage,
    lastRun: input.lastRun ?? null,
    lifecycle: input.lifecycleOverride ?? summary.lifecycle,
    applicableResultCount: summary.applicableResultCount,
  };
}

/**
 * Drain the pull-driven worker until the target run is terminal or the queue is empty.
 */
async function processUntilRunSettled(input: {
  discoveryService: DiscoveryService;
  runId: string;
  maxProcessIterations: number;
}): Promise<ScheduledRunRecord | null> {
  let lastRun = await input.discoveryService.getRun(input.runId);
  for (let i = 0; i < input.maxProcessIterations; i++) {
    if (lastRun && isTerminalDiscoveryRunStatus(lastRun.status)) {
      return lastRun;
    }
    const worker = await input.discoveryService.processNext();
    lastRun = await input.discoveryService.getRun(input.runId);
    if (worker.kind === 'empty') {
      break;
    }
  }
  return lastRun;
}

async function resolveActiveRunId(input: {
  discoveryService: DiscoveryService;
  scheduleId: string;
  profileId: string;
  runStore?: RunStore;
}): Promise<string | null> {
  const schedule = await input.discoveryService.getSchedule(input.scheduleId);
  if (schedule?.runningRunId) {
    return schedule.runningRunId;
  }
  if (input.runStore) {
    const recent = await input.runStore.listByProfileId(input.profileId, 1);
    const latest = recent[0];
    if (latest && !isTerminalDiscoveryRunStatus(latest.status)) {
      return latest.runId;
    }
  }
  return null;
}

/**
 * Manual profile run: enqueue via scheduler, then pull-process until the run
 * completes or the queue is empty (pull-driven — no background daemon).
 *
 * If a run is already active for the schedule, continues draining that run
 * instead of treating already_running as a user-facing failure (PD-007).
 */
export async function executeProfileRunNow(input: {
  discoveryService: DiscoveryService;
  profile: DiscoveryProfile;
  maxProcessIterations?: number;
  resultStore?: ResultStore;
  runStore?: RunStore;
}): Promise<ProfileRunNowResult> {
  await input.discoveryService.start();
  const scheduleId = await ensureProfileSchedule(input.profile, input.discoveryService);
  const max = input.maxProcessIterations ?? 50;
  const outcome = await input.discoveryService.runNow({ scheduleId });

  if (outcome.kind === 'skipped') {
    if (
      outcome.reason === 'already_running' ||
      outcome.reason === 'duplicate_enqueue' ||
      outcome.reason === 'lock_contended'
    ) {
      const activeRunId = await resolveActiveRunId({
        discoveryService: input.discoveryService,
        scheduleId,
        profileId: input.profile.id,
        runStore: input.runStore,
      });
      if (activeRunId) {
        const lastRun = await processUntilRunSettled({
          discoveryService: input.discoveryService,
          runId: activeRunId,
          maxProcessIterations: max,
        });
        return enrichRunNowResult({
          profileId: input.profile.id,
          scheduleId,
          runId: activeRunId,
          status: mapRunStatus(lastRun?.status),
          errorMessage: lastRun?.errorMessage,
          lastRun,
          resultStore: input.resultStore,
        });
      }
    }
    return enrichRunNowResult({
      profileId: input.profile.id,
      scheduleId,
      status: 'skipped',
      skipReason: outcome.reason,
      lastRun: null,
      resultStore: input.resultStore,
      lifecycleOverride: 'IDLE',
    });
  }

  if (outcome.kind === 'failed') {
    const failedRun = await input.discoveryService.getRun(outcome.runId);
    return enrichRunNowResult({
      profileId: input.profile.id,
      scheduleId,
      runId: outcome.runId,
      status: 'failed',
      errorMessage: outcome.errorMessage,
      lastRun: failedRun,
      resultStore: input.resultStore,
    });
  }

  const runId = outcome.runId;
  const lastRun = await processUntilRunSettled({
    discoveryService: input.discoveryService,
    runId,
    maxProcessIterations: max,
  });

  return enrichRunNowResult({
    profileId: input.profile.id,
    scheduleId,
    runId,
    status: mapRunStatus(lastRun?.status),
    errorMessage: lastRun?.errorMessage,
    lastRun,
    resultStore: input.resultStore,
  });
}
