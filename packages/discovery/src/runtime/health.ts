/**
 * Operational health model (E5.6).
 * Inspection only — never mutates discovery, queue, or scheduler state.
 */

export type DiscoveryHealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';

export type DiscoveryHealthWarningCode =
  | 'QUEUE_CLAIMS_EXPIRED'
  | 'QUEUE_BACKLOG'
  | 'PROVIDER_FAILURE_OBSERVED'
  | 'PERSISTENCE_UNAVAILABLE'
  | 'RUNTIME_CLOSED'
  | 'SCHEDULER_CONTENTION'
  | 'TELEMETRY_UNAVAILABLE';

export type DiscoveryHealthWarning = {
  code: DiscoveryHealthWarningCode;
  message: string;
};

/** Persistence component availability — no DB internals. */
export type PersistenceAvailability = 'AVAILABLE' | 'CLOSED' | 'ERROR' | 'UNKNOWN';

export type PersistenceHealth = {
  results: PersistenceAvailability;
  scheduler: PersistenceAvailability;
  notifications: PersistenceAvailability;
  queue: PersistenceAvailability;
};

export type QueueHealth = {
  queuedCount: number;
  runningCount: number;
  failedCount: number;
  oldestQueuedAt?: string;
  oldestRunningAt?: string;
  /** RUNNING jobs whose claim lease has expired — recovery NOT performed. */
  recoverableClaimCount: number;
};

export type SchedulerHealth = {
  enabledSchedules: number;
  disabledSchedules: number;
  activeRuns: number;
  /** Non-expired schedule locks currently held (read-only; no acquire). */
  heldLockCount: number;
  nextScheduledRunAt?: string;
  /** True when telemetry recently observed lock_contended. */
  contentionObserved: boolean;
};

export type RunHealthSummary = {
  runId: string;
  scheduleId: string;
  profileId: string;
  status: string;
  startedAt: string;
  finishedAt?: string;
  trigger?: string;
};

/** Configured ≠ reachable. No network probes. */
export type ProviderObservedStatus = 'UNKNOWN' | 'HEALTHY' | 'DEGRADED';

export type ProviderHealthEntry = {
  kind: 'search' | 'ai' | 'email' | 'telegram' | 'fetch' | 'extract' | 'verify';
  provider: string;
  configured: boolean;
  enabled: boolean;
  lastObservedStatus: ProviderObservedStatus;
};

export type ObservabilityHealth = {
  /** Telemetry sink availability for operational observation. */
  status: 'AVAILABLE' | 'UNKNOWN' | 'UNAVAILABLE';
};

export type DiscoveryRuntimeHealth = {
  status: DiscoveryHealthStatus;
  checkedAt: string;
  runtimeInstanceId?: string;
  runtimeOpen: boolean;
  canAcceptWork: boolean;
  queue: QueueHealth;
  scheduler: SchedulerHealth;
  persistence: PersistenceHealth;
  providers: ProviderHealthEntry[];
  recentRuns: RunHealthSummary[];
  observability: ObservabilityHealth;
  warnings: DiscoveryHealthWarning[];
};

export type QueueHealthStats = QueueHealth;

/** Default backlog threshold for QUEUE_BACKLOG warning. */
export const DEFAULT_QUEUE_BACKLOG_THRESHOLD = 25;

export type AggregateHealthInput = {
  checkedAt: string;
  runtimeOpen: boolean;
  runtimeInstanceId?: string;
  queue: QueueHealth;
  scheduler: SchedulerHealth;
  persistence: PersistenceHealth;
  providers: ProviderHealthEntry[];
  recentRuns: RunHealthSummary[];
  observability: ObservabilityHealth;
  queueBacklogThreshold?: number;
};

/**
 * Deterministic health aggregation (not a business score).
 */
export function aggregateDiscoveryHealth(
  input: AggregateHealthInput
): DiscoveryRuntimeHealth {
  const warnings: DiscoveryHealthWarning[] = [];
  const backlogThreshold =
    input.queueBacklogThreshold ?? DEFAULT_QUEUE_BACKLOG_THRESHOLD;

  if (!input.runtimeOpen) {
    warnings.push({
      code: 'RUNTIME_CLOSED',
      message: 'Runtime is closed',
    });
  }

  const persistenceUnavailable =
    input.persistence.results === 'CLOSED' ||
    input.persistence.results === 'ERROR' ||
    input.persistence.scheduler === 'CLOSED' ||
    input.persistence.scheduler === 'ERROR' ||
    input.persistence.queue === 'CLOSED' ||
    input.persistence.queue === 'ERROR';

  if (persistenceUnavailable) {
    warnings.push({
      code: 'PERSISTENCE_UNAVAILABLE',
      message: 'Required persistence is closed or in error',
    });
  }

  if (input.queue.recoverableClaimCount > 0) {
    warnings.push({
      code: 'QUEUE_CLAIMS_EXPIRED',
      message: `${input.queue.recoverableClaimCount} running claim(s) have expired leases`,
    });
  }

  if (input.queue.queuedCount >= backlogThreshold) {
    warnings.push({
      code: 'QUEUE_BACKLOG',
      message: `Queue backlog is ${input.queue.queuedCount} (threshold ${backlogThreshold})`,
    });
  }

  const providerFailure = input.providers.some(
    (p) => p.enabled && p.lastObservedStatus === 'DEGRADED'
  );
  if (providerFailure) {
    warnings.push({
      code: 'PROVIDER_FAILURE_OBSERVED',
      message: 'One or more enabled providers recently observed failing',
    });
  }

  if (input.scheduler.contentionObserved) {
    warnings.push({
      code: 'SCHEDULER_CONTENTION',
      message: 'Scheduler lock contention was recently observed',
    });
  }

  if (input.observability.status === 'UNAVAILABLE') {
    warnings.push({
      code: 'TELEMETRY_UNAVAILABLE',
      message: 'Operational telemetry sink is unavailable',
    });
  }

  let status: DiscoveryHealthStatus;
  if (!input.runtimeOpen || persistenceUnavailable) {
    status = 'UNAVAILABLE';
  } else if (
    input.queue.recoverableClaimCount > 0 ||
    providerFailure ||
    input.scheduler.contentionObserved ||
    input.queue.queuedCount >= backlogThreshold
  ) {
    status = 'DEGRADED';
  } else {
    status = 'HEALTHY';
  }

  const canAcceptWork =
    input.runtimeOpen &&
    !persistenceUnavailable &&
    status !== 'UNAVAILABLE';

  return {
    status,
    checkedAt: input.checkedAt,
    runtimeInstanceId: input.runtimeInstanceId,
    runtimeOpen: input.runtimeOpen,
    canAcceptWork,
    queue: { ...input.queue },
    scheduler: { ...input.scheduler },
    persistence: { ...input.persistence },
    providers: input.providers.map((p) => ({ ...p })),
    recentRuns: input.recentRuns.map((r) => ({ ...r })),
    observability: { ...input.observability },
    warnings: [...warnings],
  };
}
