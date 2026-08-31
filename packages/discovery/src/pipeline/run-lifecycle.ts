import type { DiscoveryRun, DiscoveryRunStatus } from '../types/run.js';

const ALLOWED: Record<DiscoveryRunStatus, readonly DiscoveryRunStatus[]> = {
  PENDING: ['RUNNING'],
  RUNNING: ['SUCCESS', 'PARTIAL_SUCCESS', 'FAILED', 'CANCELLED'],
  SUCCESS: [],
  PARTIAL_SUCCESS: [],
  FAILED: [],
  CANCELLED: [],
};

export class RunLifecycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RunLifecycleError';
  }
}

export function canTransitionRun(
  from: DiscoveryRunStatus,
  to: DiscoveryRunStatus
): boolean {
  return ALLOWED[from].includes(to);
}

/** Returns a new DiscoveryRun with updated status — never mutates input. */
export function transitionRun(
  run: DiscoveryRun,
  to: DiscoveryRunStatus,
  finishedAt?: string
): DiscoveryRun {
  if (!canTransitionRun(run.status, to)) {
    throw new RunLifecycleError(
      `Invalid run transition: ${run.status} → ${to}`
    );
  }
  return {
    ...run,
    status: to,
    finishedAt:
      to === 'SUCCESS' ||
      to === 'PARTIAL_SUCCESS' ||
      to === 'FAILED' ||
      to === 'CANCELLED'
        ? (finishedAt ?? run.finishedAt ?? new Date().toISOString())
        : run.finishedAt,
  };
}

export function isTerminalRunStatus(status: DiscoveryRunStatus): boolean {
  return ALLOWED[status].length === 0;
}
