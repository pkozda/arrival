import type { DiscoveryProviderEnablement } from './runtime-config.js';
import type { OperationalObservations } from '../telemetry/observations.js';
import {
  aggregateDiscoveryHealth,
  type DiscoveryRuntimeHealth,
  type PersistenceAvailability,
  type PersistenceHealth,
  type ProviderHealthEntry,
  type QueueHealth,
  type RunHealthSummary,
  type SchedulerHealth,
} from './health.js';
import type { ScheduledRunRecord } from '../scheduler/types.js';
import type { DiscoveryScheduleRecord } from '../scheduler/types.js';

export type BuildRuntimeHealthInput = {
  checkedAt: string;
  runtimeOpen: boolean;
  runtimeInstanceId?: string;
  queue: QueueHealth;
  schedules: readonly DiscoveryScheduleRecord[];
  heldLockCount: number;
  recentRuns: readonly ScheduledRunRecord[];
  providers: DiscoveryProviderEnablement;
  observations: OperationalObservations;
  /** When runtime-owned SQLite is closed. */
  persistenceClosed: boolean;
  /** Optional override when a store probe failed. */
  persistenceError?: boolean;
  queueBacklogThreshold?: number;
};

function persistenceStatus(
  closed: boolean,
  error: boolean
): PersistenceAvailability {
  if (error) return 'ERROR';
  if (closed) return 'CLOSED';
  return 'AVAILABLE';
}

export function buildProviderHealthEntries(
  providers: DiscoveryProviderEnablement,
  observations: OperationalObservations
): ProviderHealthEntry[] {
  const obs = observations.providers;
  return [
    {
      kind: 'search',
      provider: 'brave',
      configured: true,
      enabled: true,
      lastObservedStatus: obs.search ?? 'UNKNOWN',
    },
    {
      kind: 'ai',
      provider: 'openai',
      configured: true,
      enabled: true,
      lastObservedStatus: obs.ai ?? 'UNKNOWN',
    },
    {
      kind: 'fetch',
      provider: 'http',
      configured: true,
      enabled: true,
      lastObservedStatus: obs.fetch ?? 'UNKNOWN',
    },
    {
      kind: 'extract',
      provider: 'html',
      configured: true,
      enabled: true,
      lastObservedStatus: obs.extract ?? 'UNKNOWN',
    },
    {
      kind: 'verify',
      provider: 'http',
      configured: true,
      enabled: true,
      lastObservedStatus: obs.verify ?? 'UNKNOWN',
    },
    {
      kind: 'email',
      provider: 'resend',
      configured: providers.email,
      enabled: providers.email,
      lastObservedStatus: providers.email
        ? (obs.email ?? 'UNKNOWN')
        : 'UNKNOWN',
    },
    {
      kind: 'telegram',
      provider: 'telegram',
      configured: providers.telegram,
      enabled: providers.telegram,
      lastObservedStatus: providers.telegram
        ? (obs.telegram ?? 'UNKNOWN')
        : 'UNKNOWN',
    },
  ];
}

export function toRunHealthSummary(run: ScheduledRunRecord): RunHealthSummary {
  return {
    runId: run.runId,
    scheduleId: run.scheduleId,
    profileId: run.profileId,
    status: run.status,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    trigger: run.trigger,
  };
}

/**
 * Assemble DiscoveryRuntimeHealth from read-only inspection inputs.
 */
export function buildDiscoveryRuntimeHealth(
  input: BuildRuntimeHealthInput
): DiscoveryRuntimeHealth {
  const enabledSchedules = input.schedules.filter((s) => s.enabled).length;
  const disabledSchedules = input.schedules.length - enabledSchedules;
  const activeRuns = input.schedules.filter((s) => s.runningRunId).length;
  let nextScheduledRunAt: string | undefined;
  for (const s of input.schedules) {
    if (!s.enabled) continue;
    if (
      !nextScheduledRunAt ||
      Date.parse(s.nextRunAt) < Date.parse(nextScheduledRunAt)
    ) {
      nextScheduledRunAt = s.nextRunAt;
    }
  }

  const scheduler: SchedulerHealth = {
    enabledSchedules,
    disabledSchedules,
    activeRuns,
    heldLockCount: input.heldLockCount,
    nextScheduledRunAt,
    contentionObserved: input.observations.contentionObserved,
  };

  const persistence: PersistenceHealth = {
    results: persistenceStatus(input.persistenceClosed, !!input.persistenceError),
    scheduler: persistenceStatus(input.persistenceClosed, !!input.persistenceError),
    notifications: persistenceStatus(
      input.persistenceClosed,
      !!input.persistenceError
    ),
    queue: persistenceStatus(input.persistenceClosed, !!input.persistenceError),
  };

  const observabilityStatus =
    input.observations.telemetryErrors > 0 ? 'UNAVAILABLE' : 'AVAILABLE';

  return aggregateDiscoveryHealth({
    checkedAt: input.checkedAt,
    runtimeOpen: input.runtimeOpen,
    runtimeInstanceId: input.runtimeInstanceId,
    queue: input.queue,
    scheduler,
    persistence,
    providers: buildProviderHealthEntries(input.providers, input.observations),
    recentRuns: input.recentRuns.map(toRunHealthSummary),
    observability: { status: observabilityStatus },
    queueBacklogThreshold: input.queueBacklogThreshold,
  });
}
