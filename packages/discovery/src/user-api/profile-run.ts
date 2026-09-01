import type { DiscoveryService } from '../service/discovery-service.js';
import type { DiscoveryProfile } from '../types/profile.js';
import type { DiscoveryRunStatus } from '../types/run.js';
import type { ScheduledRunRecord } from '../scheduler/types.js';

export type ProfileRunNowStatus =
  | 'skipped'
  | 'running'
  | 'success'
  | 'partial_success'
  | 'failed'
  | 'pending';

export type ProfileRunNowResult = {
  profileId: string;
  scheduleId: string;
  runId?: string;
  status: ProfileRunNowStatus;
  skipReason?: string;
  errorMessage?: string;
  lastRun?: ScheduledRunRecord | null;
};

export function scheduleIdForProfile(profileId: string): string {
  return `sched:${profileId}`;
}

export async function ensureProfileSchedule(
  profile: DiscoveryProfile,
  discoveryService: DiscoveryService
): Promise<string> {
  const scheduleId = scheduleIdForProfile(profile.id);
  const existing = await discoveryService.getSchedule(scheduleId);
  if (!existing) {
    await discoveryService.registerSchedule({
      scheduleId,
      profileId: profile.id,
      strategyId: profile.strategyId,
      strategyVersion: profile.strategyVersion,
      intervalSeconds: 86_400,
      enabled: true,
    });
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

/**
 * Manual profile run: enqueue via scheduler, then pull-process until the run
 * completes or the queue is empty (pull-driven — no background daemon).
 */
export async function executeProfileRunNow(input: {
  discoveryService: DiscoveryService;
  profile: DiscoveryProfile;
  maxProcessIterations?: number;
}): Promise<ProfileRunNowResult> {
  await input.discoveryService.start();
  const scheduleId = await ensureProfileSchedule(input.profile, input.discoveryService);
  const outcome = await input.discoveryService.runNow({ scheduleId });

  if (outcome.kind === 'skipped') {
    return {
      profileId: input.profile.id,
      scheduleId,
      status: 'skipped',
      skipReason: outcome.reason,
    };
  }

  if (outcome.kind === 'failed') {
    const failedRun = await input.discoveryService.getRun(outcome.runId);
    return {
      profileId: input.profile.id,
      scheduleId,
      runId: outcome.runId,
      status: 'failed',
      errorMessage: outcome.errorMessage,
      lastRun: failedRun,
    };
  }

  const runId = outcome.runId;
  const max = input.maxProcessIterations ?? 25;
  let processedTarget = false;

  for (let i = 0; i < max; i++) {
    const worker = await input.discoveryService.processNext();
    if (worker.kind === 'empty') {
      break;
    }
    if (
      (worker.kind === 'processed' || worker.kind === 'retry_scheduled') &&
      worker.runId === runId
    ) {
      if (worker.kind === 'processed') {
        processedTarget = true;
        break;
      }
    }
  }

  const lastRun = await input.discoveryService.getRun(runId);
  const status = processedTarget
    ? mapRunStatus(lastRun?.status)
    : mapRunStatus(lastRun?.status);

  return {
    profileId: input.profile.id,
    scheduleId,
    runId,
    status,
    errorMessage: lastRun?.errorMessage,
    lastRun,
  };
}
