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
  validateDiscoveryProductionConfig,
} from '../adapters/production/production-composition.js';
import { createSqliteResultPersistence } from '../adapters/persistence/sqlite-result-persistence.js';
import { createSqliteSchedulerPersistence } from '../adapters/persistence/sqlite-scheduler-persistence.js';
import { createSqliteNotificationPersistence } from '../adapters/persistence/sqlite-notification-persistence.js';
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
import type { RawContentStore } from '../pipeline/fakes/raw-content-store.js';
import { createInMemoryRawContentStore } from '../pipeline/fakes/raw-content-store.js';
import {
  createInMemoryExecutionQueue,
} from '../queue/fakes/in-memory-execution-queue.js';
import type { DiscoveryExecutionQueue } from '../queue/execution-queue.js';
import {
  createDiscoveryExecutionWorker,
  type DiscoveryExecutionWorker,
  type NotificationTarget,
} from '../queue/worker.js';
import type { Clock } from '../scheduler/clock.js';
import { createSystemClock } from '../scheduler/clock.js';
import {
  createDiscoveryScheduler,
  createIncrementingJobIdGenerator,
  createIncrementingRunIdGenerator,
  type DiscoveryScheduler,
} from '../scheduler/scheduler.js';
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

export type DiscoveryRuntimePersistencePaths = {
  /** SQLite file for Results (E4.1) */
  resultsDatabasePath: string;
  /** SQLite file for schedules / run metadata (E4.2) */
  schedulerDatabasePath: string;
  /** SQLite file for notification idempotency (E4.4) */
  notificationsDatabasePath: string;
};

export type DiscoveryRuntimeConfig = {
  production: DiscoveryProductionConfig;
  persistence: DiscoveryRuntimePersistencePaths;
  registry: StrategyRegistry;
  profileStore: ProfileStore;
  clock?: Clock;
  runIdGenerator?: RunIdGenerator;
  jobIdGenerator?: JobIdGenerator;
  enginePolicy?: EnginePolicy;
  signal?: AbortSignal;
  adapterTimeoutMs?: number;
  /**
   * Resolve notification destination after a successful/partial pipeline run.
   * Return null to skip delivery for that run.
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
  /** Inject shared transport (required for deterministic tests). */
  transport?: HttpTransport;
  rateLimiter?: RateLimiter;
  rawContentStore?: RawContentStore;
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
  notificationStore: NotificationStore;
  notificationService: DiscoveryNotificationService | null;
  clock: Clock;
  /** Close SQLite resources owned by this runtime. Idempotent. */
  close(): void;
};

/**
 * Application/runtime composition root (E4.7).
 * Wires existing factories only — no domain logic.
 *
 * Lifecycle is pull/trigger driven (no background timers).
 * Queue remains in-memory (E4.3) — jobs do not survive process restart.
 */
export function createDiscoveryRuntime(
  config: DiscoveryRuntimeConfig
): DiscoveryRuntime {
  const validated = validateDiscoveryProductionConfig(config.production);
  if (!validated.ok) {
    throw new Error(
      `Invalid discovery production config: ${validated.issues.join('; ')}`
    );
  }

  const clock = config.clock ?? createSystemClock();
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

  const adapters = createProductionDiscoveryAdapters({
    ...config.production,
    transport,
    rateLimiter,
    rawContentStore,
  });

  const resultPersistence = createSqliteResultPersistence({
    databasePath: config.persistence.resultsDatabasePath,
  });
  const schedulerPersistence = createSqliteSchedulerPersistence({
    databasePath: config.persistence.schedulerDatabasePath,
  });
  const notificationPersistence = createSqliteNotificationPersistence({
    databasePath: config.persistence.notificationsDatabasePath,
  });

  const queue = createInMemoryExecutionQueue();

  const pipelineExecutor = createPipelineRunExecutor({
    registry: config.registry,
    profileStore: config.profileStore,
    adapters: {
      search: adapters.search,
      fetch: adapters.fetch,
      extract: adapters.extract,
      verify: adapters.verify,
      ai: adapters.ai,
    },
    enginePolicy: config.enginePolicy,
    resultStore: resultPersistence,
    resultWriter: resultPersistence,
    now: () => clock.now().toISOString(),
    signal: config.signal,
    adapterTimeoutMs: config.adapterTimeoutMs,
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
      })
    : null;

  const scheduler = createDiscoveryScheduler({
    scheduleStore: schedulerPersistence.scheduleStore,
    runStore: schedulerPersistence.runStore,
    queue,
    clock,
    runIdGenerator: config.runIdGenerator ?? createIncrementingRunIdGenerator('run'),
    jobIdGenerator: config.jobIdGenerator ?? createIncrementingJobIdGenerator('job'),
  });

  const worker = createDiscoveryExecutionWorker({
    queue,
    executor: pipelineExecutor,
    runStore: schedulerPersistence.runStore,
    scheduleStore: schedulerPersistence.scheduleStore,
    clock,
    notificationService: notificationService ?? undefined,
    resolveNotificationTarget: config.resolveNotificationTarget,
  });

  let closed = false;

  return {
    scheduler,
    worker,
    queue,
    pipelineExecutor,
    adapters,
    scheduleStore: schedulerPersistence.scheduleStore,
    runStore: schedulerPersistence.runStore,
    resultStore: resultPersistence,
    notificationStore: notificationPersistence,
    notificationService,
    clock,
    close() {
      if (closed) return;
      closed = true;
      try {
        resultPersistence.close();
      } finally {
        try {
          schedulerPersistence.close();
        } finally {
          notificationPersistence.close();
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
