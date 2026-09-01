import {
  createInMemoryRateLimiter,
  type RateLimiter,
} from '../adapter-infra/index.js';
import {
  createFetchHttpTransport,
  type HttpTransport,
} from '../adapters/http-transport.js';
import {
  createProductionDiscoveryAdapters,
  type DiscoveryProductionConfig,
  type ProductionDiscoveryAdapters,
} from '../adapters/production/production-composition.js';
import { createSqliteResultPersistence } from '../adapters/persistence/sqlite-result-persistence.js';
import { createSqliteProfilePersistence } from '../adapters/persistence/sqlite-profile-persistence.js';
import { createSqliteSchedulerPersistence } from '../adapters/persistence/sqlite-scheduler-persistence.js';
import { createSqliteNotificationPersistence } from '../adapters/persistence/sqlite-notification-persistence.js';
import {
  createSqliteExecutionQueue,
  type SqliteExecutionQueue,
} from '../adapters/persistence/sqlite-execution-queue.js';
import {
  createSqliteSchedulerLock,
  type SqliteSchedulerLock,
} from '../adapters/persistence/sqlite-scheduler-lock.js';
import {
  createProductionEmailNotificationAdapter,
} from '../adapters/notifications/email/resend-email-notification-adapter.js';
import {
  createProductionTelegramNotificationAdapter,
} from '../adapters/notifications/telegram/telegram-notification-adapter.js';
import type { EnginePolicy } from '../engine-policy.js';
import {
  createDiscoveryNotificationService,
  type DiscoveryNotificationService,
} from '../notifications/notification-service.js';
import type { NotificationAdapter } from '../notifications/notification-adapter.js';
import type { NotificationStore } from '../notifications/notification-store.js';
import type { StrategyRegistry } from '../registry/strategy-registry.js';
import type { ProfileStore } from '../pipeline/profile-store.js';
import type { ResultStore } from '../pipeline/result-store.js';
import type { ResultWriter } from '../pipeline/result-writer.js';
import {
  createResultStateWriter,
  type ResultStateWriter,
} from '../pipeline/result-state-writer.js';
import type { RawContentStore } from '../pipeline/fakes/raw-content-store.js';
import { createInMemoryRawContentStore } from '../pipeline/fakes/raw-content-store.js';
import type {
  DiscoveryExecutionQueue,
  RecoverExpiredClaimsResult,
} from '../queue/execution-queue.js';
import {
  createDiscoveryExecutionWorker,
  type DiscoveryExecutionWorker,
  type NotificationTarget,
} from '../queue/worker.js';
import type { Clock } from '../scheduler/clock.js';
import { clockIso, createSystemClock } from '../scheduler/clock.js';
import {
  createDiscoveryScheduler,
  createIncrementingJobIdGenerator,
  createIncrementingRunIdGenerator,
  type DiscoveryScheduler,
} from '../scheduler/scheduler.js';
import type {
  SchedulerLock,
  SchedulerLockRecoverResult,
} from '../scheduler/scheduler-lock.js';
import type { JobIdGenerator, RunIdGenerator } from '../scheduler/types.js';
import {
  createPipelineRunExecutor,
  type DiscoveryRunExecutor,
} from '../scheduler/executor.js';
import type { ScheduleStore } from '../scheduler/schedule-store.js';
import type { RunStore } from '../scheduler/run-store.js';
import {
  createChannelRoutingNotificationAdapter,
  type ChannelNotificationAdapters,
} from './channel-routing-notification-adapter.js';
import {
  DiscoveryConfigurationError,
  DiscoveryRuntimeClosedError,
  DiscoveryRuntimeConstructionError,
} from './errors.js';
import {
  assertDiscoveryRuntimeConfig,
  collectConfigSecrets,
  getDiscoveryProviderEnablement,
  redactDiscoveryRuntimeConfig,
  sanitizeRuntimeErrorMessage,
  type DiscoveryProviderEnablement,
  type DiscoveryRuntimePersistencePaths,
  type RedactedDiscoveryRuntimeConfig,
} from './runtime-config.js';
import {
  createIncrementingTelemetryEventIdGenerator,
  createNoopDiscoveryTelemetry,
  createTelemetryEmitter,
  type DiscoveryTelemetry,
  type TelemetryEventIdGenerator,
} from '../telemetry/index.js';
import {
  createOperationalObservationTracker,
  wrapTelemetryWithObservations,
} from '../telemetry/observations.js';
import {
  wrapExecutionQueueForTelemetry,
  wrapResultWriterForTelemetry,
} from '../telemetry/instrumentation.js';
import { DEFAULT_QUEUE_VISIBILITY_TIMEOUT_MS } from '../adapters/persistence/sqlite-execution-queue.js';
import { buildDiscoveryRuntimeHealth } from './build-health.js';
import type { DiscoveryRuntimeHealth } from './health.js';

export type { DiscoveryRuntimePersistencePaths } from './runtime-config.js';
export type { DiscoveryRuntimeHealth } from './health.js';

/**
 * Runtime composition config (E4.7 / E5.1 / E5.2 / E5.3).
 *
 * Infrastructure (`production`, `persistence`, timeouts, injected transport)
 * is validated at startup. Application/domain objects (`registry`, `profileStore`,
 * notification routing) are supplied by the host and are not loaded from env.
 *
 * Resource ownership:
 * - Runtime-created SQLite stores (Results, Scheduler, Notifications, Queue, Locks) → runtime owns (`close()`)
 * - Injected transport / rateLimiter / rawContentStore / queue / schedulerLock → caller owns lifecycle
 */
export type DiscoveryRuntimeConfig = {
  /** Infrastructure — provider credentials, timeouts, optional notification providers */
  production: DiscoveryProductionConfig;
  /** Infrastructure — SQLite paths (runtime-owned when constructed here) */
  persistence: DiscoveryRuntimePersistencePaths;
  /** Application — strategy modules */
  registry: StrategyRegistry;
  /** Application — profile lookup (optional; defaults to durable SQLite on persistence.profilesDatabasePath) */
  profileStore?: ProfileStore;
  clock?: Clock;
  runIdGenerator?: RunIdGenerator;
  jobIdGenerator?: JobIdGenerator;
  enginePolicy?: EnginePolicy;
  signal?: AbortSignal;
  adapterTimeoutMs?: number;
  /**
   * Resolve notification destination after a successful/partial pipeline run.
   * Return null to skip delivery for that run. Application/domain concern.
   */
  resolveNotificationTarget?: (input: {
    profileId: string;
    runId: string;
  }) => NotificationTarget | null;
  /**
   * Override notification adapters. When omitted, adapters are built from
   * production.email / production.telegram when configured.
   */
  notificationAdapters?: ChannelNotificationAdapters;
  /** Inject shared transport (required for deterministic tests). Caller-owned. */
  transport?: HttpTransport;
  /** Caller-owned when injected. */
  rateLimiter?: RateLimiter;
  /** Caller-owned when injected. */
  rawContentStore?: RawContentStore;
  /**
   * Inject execution queue (tests). Caller-owned when injected.
   * When omitted, runtime creates a durable SQLite queue (E5.2).
   */
  queue?: DiscoveryExecutionQueue;
  /** Claim lease for durable queue (default 5 minutes). */
  queueVisibilityTimeoutMs?: number;
  /** Worker claim identity for durable queue leases. */
  workerId?: string;
  /**
   * Inject scheduler lock (tests / multi-runtime). Caller-owned when injected.
   * When omitted, runtime creates a durable SQLite lock store on the scheduler DB path.
   */
  schedulerLock?: SchedulerLock;
  /** Lease for schedule→enqueue critical section (default 30s). Positive integer. */
  schedulerLockLeaseMs?: number;
  /** Runtime identity for lock ownership (`scheduler:{id}`). */
  runtimeInstanceId?: string;
  /**
   * Durable execution retry settings (E5.4).
   * Controls worker→queue retry orchestration — not adapter-internal loops.
   */
  retry?: {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  };
  /**
   * Optional provider-neutral telemetry (E5.5).
   * When omitted, a no-op implementation is used.
   */
  telemetry?: DiscoveryTelemetry;
  /** Deterministic event IDs for tests. */
  telemetryEventIdGenerator?: TelemetryEventIdGenerator;
};

export type DiscoveryRuntime = {
  scheduler: DiscoveryScheduler;
  worker: DiscoveryExecutionWorker;
  queue: DiscoveryExecutionQueue;
  pipelineExecutor: DiscoveryRunExecutor;
  adapters: ProductionDiscoveryAdapters;
  scheduleStore: ScheduleStore;
  runStore: RunStore;
  resultStore: ResultStore & ResultWriter;
  /** Durable profile store when runtime-owned (E7.1). */
  profileStore: ProfileStore;
  notificationStore: NotificationStore;
  notificationService: DiscoveryNotificationService | null;
  /** Scheduler lock used for cross-instance trigger safety (E5.3). */
  schedulerLock: SchedulerLock;
  clock: Clock;
  /** Explicit provider enablement snapshot at construction. */
  providers: DiscoveryProviderEnablement;
  /** True after close(); close() is idempotent. */
  isClosed(): boolean;
  /** Redacted config snapshot for diagnostics (no secrets). */
  redactedConfig(): RedactedDiscoveryRuntimeConfig;
  /**
   * Requeue expired durable claims. Does not execute jobs.
   * Startup already recovers once; host may call again after long idle.
   */
  recoverQueueClaims(): Promise<RecoverExpiredClaimsResult>;
  /** Recover expired schedule locks. Does not enqueue work. */
  recoverSchedulerLocks(): Promise<SchedulerLockRecoverResult>;
  /**
   * Read-only operational health snapshot (E5.6).
   * Safe after close(): returns UNAVAILABLE without touching SQLite.
   * Does not enqueue, recover, acquire locks, or execute work.
   */
  getHealth(): Promise<DiscoveryRuntimeHealth>;
  /**
   * Close runtime-owned SQLite resources. Idempotent.
   * Does not close caller-owned injected transport / rateLimiter / rawContentStore / queue / lock.
   */
  close(): void;
};

/**
 * Application/runtime composition root (E4.7 + E5.1 + E5.2 durable queue).
 * Wires existing factories only — no domain logic.
 *
 * Lifecycle:
 *   validate → construct stores → recover expired queue claims → adapters
 *   → scheduler/queue/worker → ready
 *   close() → closed (idempotent)
 *
 * Lifecycle is pull/trigger driven (no background timers).
 * Queue delivery is at-least-once after crash recovery.
 */
export function createDiscoveryRuntime(
  config: DiscoveryRuntimeConfig
): DiscoveryRuntime {
  const providers = assertDiscoveryRuntimeConfig(config);
  const secrets = collectConfigSecrets(config.production);
  const redactedSnapshot = redactDiscoveryRuntimeConfig(config);

  const clock = config.clock ?? createSystemClock();
  const runtimeInstanceId = config.runtimeInstanceId;
  const observationTracker = createOperationalObservationTracker();
  const telemetrySink = wrapTelemetryWithObservations(
    config.telemetry ?? createNoopDiscoveryTelemetry(),
    observationTracker
  );
  const telemetryEmitter = createTelemetryEmitter({
    telemetry: telemetrySink,
    clock,
    eventIdGenerator:
      config.telemetryEventIdGenerator ??
      createIncrementingTelemetryEventIdGenerator('tel'),
    runtimeInstanceId,
    secrets,
  });
  const visibilityTimeoutMs =
    config.queueVisibilityTimeoutMs ?? DEFAULT_QUEUE_VISIBILITY_TIMEOUT_MS;
  const transport =
    config.transport ?? config.production.transport ?? createFetchHttpTransport();
  const rateLimiter =
    config.rateLimiter ??
    config.production.rateLimiter ??
    createInMemoryRateLimiter();
  const rawContentStore =
    config.rawContentStore ??
    config.production.rawContentStore ??
    createInMemoryRawContentStore();

  let resultPersistence: ReturnType<typeof createSqliteResultPersistence> | undefined;
  let profilePersistence:
    | ReturnType<typeof createSqliteProfilePersistence>
    | undefined;
  let schedulerPersistence:
    | ReturnType<typeof createSqliteSchedulerPersistence>
    | undefined;
  let notificationPersistence:
    | ReturnType<typeof createSqliteNotificationPersistence>
    | undefined;
  let queuePersistence: SqliteExecutionQueue | undefined;
  let lockPersistence: SqliteSchedulerLock | undefined;
  const ownsQueue = config.queue === undefined;
  const ownsLock = config.schedulerLock === undefined;

  const ownsProfileStore = config.profileStore === undefined;

  try {
    resultPersistence = createSqliteResultPersistence({
      databasePath: config.persistence.resultsDatabasePath,
    });
    if (ownsProfileStore) {
      profilePersistence = createSqliteProfilePersistence({
        databasePath: config.persistence.profilesDatabasePath,
      });
    }
    schedulerPersistence = createSqliteSchedulerPersistence({
      databasePath: config.persistence.schedulerDatabasePath,
    });
    notificationPersistence = createSqliteNotificationPersistence({
      databasePath: config.persistence.notificationsDatabasePath,
    });
    if (ownsQueue) {
      queuePersistence = createSqliteExecutionQueue({
        databasePath: config.persistence.queueDatabasePath,
        clock,
        visibilityTimeoutMs,
        recoverOnOpen: true,
      });
    }
    if (ownsLock) {
      // Locks live in the scheduler DB file (additive table) — one durable store.
      lockPersistence = createSqliteSchedulerLock({
        databasePath: config.persistence.schedulerDatabasePath,
      });
      // Recover expired locks on open (no timers / no auto-enqueue).
      void lockPersistence.recoverExpired(clockIso(clock));
    }
  } catch (err) {
    try {
      resultPersistence?.close();
    } catch {
      /* ignore */
    }
    try {
      profilePersistence?.close();
    } catch {
      /* ignore */
    }
    try {
      schedulerPersistence?.close();
    } catch {
      /* ignore */
    }
    try {
      notificationPersistence?.close();
    } catch {
      /* ignore */
    }
    try {
      queuePersistence?.close();
    } catch {
      /* ignore */
    }
    try {
      lockPersistence?.close();
    } catch {
      /* ignore */
    }
    const raw = err instanceof Error ? err.message : String(err);
    throw new DiscoveryRuntimeConstructionError(
      sanitizeRuntimeErrorMessage(raw, secrets)
    );
  }

  const queue: DiscoveryExecutionQueue = (() => {
    const base = config.queue ?? queuePersistence!;
    return wrapExecutionQueueForTelemetry(base, telemetryEmitter);
  })();
  const schedulerLock: SchedulerLock = config.schedulerLock ?? lockPersistence!;

  const resultWriter = wrapResultWriterForTelemetry(
    resultPersistence,
    telemetryEmitter
  );
  const profileStore: ProfileStore =
    config.profileStore ?? profilePersistence!;
  const resultStateWriter: ResultStateWriter = createResultStateWriter({
    store: resultPersistence,
    writer: resultWriter,
  });

  let adapters: ProductionDiscoveryAdapters;
  try {
    adapters = createProductionDiscoveryAdapters({
      ...config.production,
      transport,
      rateLimiter,
      rawContentStore,
    });
  } catch (err) {
    try {
      resultPersistence.close();
    } finally {
      try {
        profilePersistence?.close();
      } finally {
        try {
          schedulerPersistence.close();
        } finally {
          try {
            notificationPersistence.close();
          } finally {
            try {
              queuePersistence?.close();
            } finally {
              lockPersistence?.close();
            }
          }
        }
      }
    }
    if (err instanceof DiscoveryConfigurationError) {
      throw err;
    }
    const raw = err instanceof Error ? err.message : String(err);
    throw new DiscoveryRuntimeConstructionError(
      sanitizeRuntimeErrorMessage(
        `Failed to construct production adapters: ${raw}`,
        secrets
      )
    );
  }

  const pipelineExecutor = createPipelineRunExecutor({
    registry: config.registry,
    profileStore,
    adapters: {
      search: adapters.search,
      fetch: adapters.fetch,
      extract: adapters.extract,
      verify: adapters.verify,
      ai: adapters.ai,
    },
    enginePolicy: config.enginePolicy,
    resultStore: resultPersistence,
    resultWriter,
    now: () => clock.now().toISOString(),
    signal: config.signal,
    adapterTimeoutMs: config.adapterTimeoutMs,
    telemetry: telemetryEmitter,
    clock,
    adapterProviders: {
      search: 'brave',
      fetch: 'http',
      extract: 'html',
      verify: 'http',
      ai: 'openai',
    },
  });

  const channelAdapters =
    config.notificationAdapters ??
    buildDefaultNotificationAdapters(config.production, transport, rateLimiter);

  const hasAnyNotificationAdapter = Object.keys(channelAdapters).length > 0;
  const notificationAdapter: NotificationAdapter | null = hasAnyNotificationAdapter
    ? createChannelRoutingNotificationAdapter(channelAdapters)
    : null;

  const notificationService = notificationAdapter
    ? createDiscoveryNotificationService({
        store: notificationPersistence,
        adapter: notificationAdapter,
        clock,
        telemetry: telemetryEmitter,
        resultStateWriter,
      })
    : null;

  const innerScheduler = createDiscoveryScheduler({
    scheduleStore: schedulerPersistence.scheduleStore,
    runStore: schedulerPersistence.runStore,
    queue,
    clock,
    runIdGenerator: config.runIdGenerator ?? createIncrementingRunIdGenerator('run'),
    jobIdGenerator: config.jobIdGenerator ?? createIncrementingJobIdGenerator('job'),
    schedulerLock,
    runtimeInstanceId: config.runtimeInstanceId,
    schedulerLockLeaseMs: config.schedulerLockLeaseMs,
    telemetry: telemetryEmitter,
    profileStore,
  });

  const innerWorker = createDiscoveryExecutionWorker({
    queue,
    executor: pipelineExecutor,
    runStore: schedulerPersistence.runStore,
    scheduleStore: schedulerPersistence.scheduleStore,
    clock,
    workerId: config.workerId,
    notificationService: notificationService ?? undefined,
    resolveNotificationTarget: config.resolveNotificationTarget,
    retryConfig: config.retry,
    telemetry: telemetryEmitter,
    runtimeInstanceId: config.runtimeInstanceId,
  });

  let closed = false;

  telemetryEmitter.emit({
    eventName: 'runtime.created',
    runtimeInstanceId: config.runtimeInstanceId,
    attributes: {
      ownsQueue,
      ownsLock,
    },
  });

  const whenOpen = <T>(fn: () => Promise<T>): Promise<T> => {
    if (closed) {
      return Promise.reject(new DiscoveryRuntimeClosedError());
    }
    return fn();
  };

  const scheduler: DiscoveryScheduler = {
    registerSchedule: (input) => whenOpen(() => innerScheduler.registerSchedule(input)),
    disableSchedule: (scheduleId) =>
      whenOpen(() => innerScheduler.disableSchedule(scheduleId)),
    enableSchedule: (scheduleId) =>
      whenOpen(() => innerScheduler.enableSchedule(scheduleId)),
    triggerDueRuns: () => whenOpen(() => innerScheduler.triggerDueRuns()),
    triggerNow: (scheduleId) => whenOpen(() => innerScheduler.triggerNow(scheduleId)),
  };

  const worker: DiscoveryExecutionWorker = {
    processNext: () => whenOpen(() => innerWorker.processNext()),
    process: (jobId) => whenOpen(() => innerWorker.process(jobId)),
  };

  const guardedPipelineExecutor: DiscoveryRunExecutor = {
    execute: (request) => whenOpen(() => pipelineExecutor.execute(request)),
  };

  const providerEnablement =
    providers ?? getDiscoveryProviderEnablement(config.production);

  return {
    scheduler,
    worker,
    queue,
    pipelineExecutor: guardedPipelineExecutor,
    adapters,
    scheduleStore: schedulerPersistence.scheduleStore,
    runStore: schedulerPersistence.runStore,
    resultStore: resultPersistence,
    profileStore,
    notificationStore: notificationPersistence,
    notificationService,
    schedulerLock,
    clock,
    providers: providerEnablement,
    isClosed: () => closed,
    redactedConfig: () => redactedSnapshot,
    recoverQueueClaims: () =>
      whenOpen(() => queue.recoverExpiredClaims(clockIso(clock))),
    recoverSchedulerLocks: () =>
      whenOpen(() => schedulerLock.recoverExpired(clockIso(clock))),
    async getHealth() {
      const checkedAt = clockIso(clock);
      const observations = observationTracker.snapshot();

      if (closed) {
        return buildDiscoveryRuntimeHealth({
          checkedAt,
          runtimeOpen: false,
          runtimeInstanceId,
          queue: {
            queuedCount: 0,
            runningCount: 0,
            failedCount: 0,
            recoverableClaimCount: 0,
          },
          schedules: [],
          heldLockCount: 0,
          recentRuns: [],
          providers: providerEnablement,
          observations,
          persistenceClosed: true,
        });
      }

      try {
        const [queueHealth, schedules, recentRuns, heldLockCount] =
          await Promise.all([
            queue.getHealthStats(checkedAt, { visibilityTimeoutMs }),
            schedulerPersistence.scheduleStore.listAll(),
            schedulerPersistence.runStore.listRecent(5),
            schedulerLock.countActive(checkedAt),
          ]);

        return buildDiscoveryRuntimeHealth({
          checkedAt,
          runtimeOpen: true,
          runtimeInstanceId,
          queue: queueHealth,
          schedules,
          heldLockCount,
          recentRuns,
          providers: providerEnablement,
          observations,
          persistenceClosed: false,
        });
      } catch {
        return buildDiscoveryRuntimeHealth({
          checkedAt,
          runtimeOpen: true,
          runtimeInstanceId,
          queue: {
            queuedCount: 0,
            runningCount: 0,
            failedCount: 0,
            recoverableClaimCount: 0,
          },
          schedules: [],
          heldLockCount: 0,
          recentRuns: [],
          providers: providerEnablement,
          observations,
          persistenceClosed: false,
          persistenceError: true,
        });
      }
    },
    close() {
      if (closed) return;
      closed = true;
      telemetryEmitter.emit({
        eventName: 'runtime.closed',
        runtimeInstanceId: config.runtimeInstanceId,
      });
      try {
        resultPersistence.close();
      } finally {
        try {
          if (ownsProfileStore) {
            profilePersistence?.close();
          }
        } finally {
          try {
            schedulerPersistence.close();
          } finally {
            try {
              notificationPersistence.close();
            } finally {
              try {
                if (ownsQueue) {
                  queuePersistence?.close();
                }
              } finally {
                if (ownsLock) {
                  lockPersistence?.close();
                }
              }
            }
          }
        }
      }
    },
  };
}

function buildDefaultNotificationAdapters(
  production: DiscoveryProductionConfig,
  transport: HttpTransport,
  rateLimiter: RateLimiter
): ChannelNotificationAdapters {
  const out: ChannelNotificationAdapters = {};
  if (production.email) {
    out.EMAIL = createProductionEmailNotificationAdapter({
      apiKey: production.email.apiKey,
      from: production.email.from,
      baseUrl: production.email.baseUrl,
      timeoutMs: production.email.timeoutMs,
      transport,
      rateLimiter,
    });
  }
  if (production.telegram) {
    out.TELEGRAM = createProductionTelegramNotificationAdapter({
      botToken: production.telegram.botToken,
      baseUrl: production.telegram.baseUrl,
      timeoutMs: production.telegram.timeoutMs,
      transport,
      rateLimiter,
    });
  }
  return out;
}
