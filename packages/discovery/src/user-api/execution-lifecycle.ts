import type { DiscoveryRunStatus } from '../types/run.js';
import type { ScheduledRunRecord } from '../scheduler/types.js';

/** Product-facing Discovery execution lifecycle (PD-007). */
export type DiscoveryExecutionLifecycle =
  | 'IDLE'
  | 'QUEUED'
  | 'RUNNING'
  | 'SUCCESS'
  | 'NO_RESULTS'
  | 'ERROR';

const TERMINAL_ENGINE: ReadonlySet<DiscoveryRunStatus> = new Set([
  'SUCCESS',
  'PARTIAL_SUCCESS',
  'FAILED',
  'CANCELLED',
]);

export function isTerminalDiscoveryRunStatus(
  status: DiscoveryRunStatus | undefined | null
): boolean {
  if (!status) return false;
  return TERMINAL_ENGINE.has(status);
}

export function isActiveDiscoveryRunStatus(
  status: DiscoveryRunStatus | undefined | null
): boolean {
  return status === 'PENDING' || status === 'RUNNING';
}

export function countApplicableResultsForRun(
  results: ReadonlyArray<{ promotedFromRunId?: string }>,
  runId: string | undefined | null
): number {
  if (!runId) return 0;
  let n = 0;
  for (const result of results) {
    if (result.promotedFromRunId === runId) n += 1;
  }
  return n;
}

/**
 * Map authoritative scheduler last-run + run-scoped result count to PD-007 lifecycle.
 * Does not invent SUCCESS from HTTP acceptance or profile existence.
 */
export function deriveDiscoveryExecutionLifecycle(input: {
  lastRun: ScheduledRunRecord | null | undefined;
  applicableResultCount: number;
}): DiscoveryExecutionLifecycle {
  const lastRun = input.lastRun ?? null;
  if (!lastRun) return 'IDLE';

  switch (lastRun.status) {
    case 'PENDING':
      return 'QUEUED';
    case 'RUNNING':
      return 'RUNNING';
    case 'SUCCESS':
    case 'PARTIAL_SUCCESS':
      return input.applicableResultCount > 0 ? 'SUCCESS' : 'NO_RESULTS';
    case 'FAILED':
    case 'CANCELLED':
      return 'ERROR';
    default:
      return 'IDLE';
  }
}

export function buildProfileRunSummaryFields(input: {
  profileId: string;
  lastRun: ScheduledRunRecord | null;
  results: ReadonlyArray<{ promotedFromRunId?: string }>;
}): {
  profileId: string;
  lastRun: ScheduledRunRecord | null;
  lifecycle: DiscoveryExecutionLifecycle;
  applicableResultCount: number;
} {
  const applicableResultCount = countApplicableResultsForRun(
    input.results,
    input.lastRun?.runId
  );
  return {
    profileId: input.profileId,
    lastRun: input.lastRun,
    applicableResultCount,
    lifecycle: deriveDiscoveryExecutionLifecycle({
      lastRun: input.lastRun,
      applicableResultCount,
    }),
  };
}
