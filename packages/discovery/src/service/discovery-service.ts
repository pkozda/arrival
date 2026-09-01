import {
  createDiscoveryRuntime,
  type DiscoveryRuntime,
  type DiscoveryRuntimeConfig,
  type DiscoveryRuntimeHealth,
} from '../runtime/discovery-runtime.js';
import { DiscoveryRuntimeClosedError } from '../runtime/errors.js';
import {
  collectConfigSecrets,
  sanitizeRuntimeErrorMessage,
  type RedactedDiscoveryRuntimeConfig,
} from '../runtime/runtime-config.js';
import { clockIso, createSystemClock } from '../scheduler/clock.js';
import type {
  RegisterScheduleInput,
  ScheduledRunRecord,
  SchedulerTickResult,
  TriggerRunOutcome,
  DiscoveryScheduleRecord,
} from '../scheduler/types.js';
import type { WorkerProcessResult } from '../queue/types.js';
import {
  DiscoveryServiceNotStartedError,
  DiscoveryServiceStartupError,
  DiscoveryServiceStoppedError,
} from './errors.js';

/**
 * Explicit service lifecycle (E6.1).
 * Pull-driven — no background worker/scheduler threads.
 */
export type DiscoveryServiceLifecycle =
  | 'created'
  | 'starting'
  | 'ready'
  | 'stopping'
  | 'stopped';

export type DiscoveryServiceConfig = DiscoveryRuntimeConfig;

export type RunNowInput = {
  scheduleId: string;
};

/**
 * Application/service boundary around DiscoveryRuntime.
 * Orchestration only — no discovery business logic.
 */
export type DiscoveryService = {
  lifecycle(): DiscoveryServiceLifecycle;
  /**
   * Idempotent start: construct runtime (once), recover expired queue claims
   * and scheduler locks. Does not execute jobs.
   */
  start(): Promise<void>;
  /**
   * Idempotent stop: close owned runtime. Subsequent mutating ops fail.
   */
  stop(): Promise<void>;
  /**
   * Manual trigger via scheduler → queue. Does not execute the pipeline,
   * does not advance nextRunAt.
   */
  runNow(input: RunNowInput): Promise<TriggerRunOutcome>;
  /** Read-only run metadata. */
  getRun(runId: string): Promise<ScheduledRunRecord | null>;
  /**
   * Delegates to runtime.getHealth() when available.
   * Before start / after stop without runtime: structured UNAVAILABLE (no side effects).
   */
  getHealth(): Promise<DiscoveryRuntimeHealth>;
  /**
   * Thin schedule registration (application orchestration).
   * Required for hosts that do not inject pre-seeded schedule stores.
   */
  registerSchedule(
    input: RegisterScheduleInput
  ): Promise<DiscoveryScheduleRecord>;
  /** List all schedules (enabled + disabled). */
  listSchedules(): Promise<DiscoveryScheduleRecord[]>;
  /** Read one schedule; null if missing. */
  getSchedule(scheduleId: string): Promise<DiscoveryScheduleRecord | null>;
  enableSchedule(scheduleId: string): Promise<DiscoveryScheduleRecord | null>;
  disableSchedule(scheduleId: string): Promise<DiscoveryScheduleRecord | null>;
  /** Safe redacted config snapshot; null before runtime construction. */
  redactedConfig(): RedactedDiscoveryRuntimeConfig | null;
  /**
   * Pull one queued job through the existing worker (enqueue → worker → pipeline).
   * Does not bypass the queue.
   */
  processNext(): Promise<WorkerProcessResult>;
  /** Scheduled tick: due schedules → enqueue only. */
  triggerDueRuns(): Promise<SchedulerTickResult>;
};

function unavailableHealth(
  checkedAt: string,
  reason: 'not_started' | 'stopped'
): DiscoveryRuntimeHealth {
  return {
    status: 'UNAVAILABLE',
    checkedAt,
    runtimeOpen: false,
    canAcceptWork: false,
    queue: {
      queuedCount: 0,
      runningCount: 0,
      failedCount: 0,
      recoverableClaimCount: 0,
    },
    scheduler: {
      enabledSchedules: 0,
      disabledSchedules: 0,
      activeRuns: 0,
      heldLockCount: 0,
      contentionObserved: false,
    },
    persistence: {
      results: 'UNKNOWN',
      scheduler: 'UNKNOWN',
      notifications: 'UNKNOWN',
      queue: 'UNKNOWN',
    },
    providers: [],
    recentRuns: [],
    observability: { status: 'UNKNOWN' },
    warnings: [
      {
        code: reason === 'stopped' ? 'RUNTIME_CLOSED' : 'RUNTIME_CLOSED',
        message:
          reason === 'stopped'
            ? 'Discovery service is stopped'
            : 'Discovery service is not started',
      },
    ],
  };
}

/**
 * Create a managed Discovery application service.
 * Runtime is constructed on first successful start(); service owns close().
 */
export function createDiscoveryService(
  config: DiscoveryServiceConfig
): DiscoveryService {
  const secrets = collectConfigSecrets(config.production);
  const clock = config.clock ?? createSystemClock();
  let state: DiscoveryServiceLifecycle = 'created';
  let runtime: DiscoveryRuntime | null = null;
  let startPromise: Promise<void> | null = null;

  function assertReady(): DiscoveryRuntime {
    if (state === 'stopped' || state === 'stopping') {
      throw new DiscoveryServiceStoppedError();
    }
    if (state !== 'ready' || !runtime) {
      throw new DiscoveryServiceNotStartedError();
    }
    if (runtime.isClosed()) {
      throw new DiscoveryRuntimeClosedError();
    }
    return runtime;
  }

  return {
    lifecycle() {
      return state;
    },

    async start() {
      if (state === 'ready') {
        return;
      }
      if (state === 'stopped' || state === 'stopping') {
        throw new DiscoveryServiceStoppedError(
          'Cannot start a stopped discovery service'
        );
      }
      if (startPromise) {
        return startPromise;
      }

      startPromise = (async () => {
        state = 'starting';
        try {
          if (!runtime) {
            runtime = createDiscoveryRuntime(config);
          }
          await runtime.recoverQueueClaims();
          await runtime.recoverSchedulerLocks();
          state = 'ready';
        } catch (err) {
          state = 'created';
          try {
            runtime?.close();
          } catch {
            /* ignore close failures during failed start */
          }
          runtime = null;
          const raw = err instanceof Error ? err.message : String(err);
          throw new DiscoveryServiceStartupError(
            sanitizeRuntimeErrorMessage(raw, secrets)
          );
        } finally {
          startPromise = null;
        }
      })();

      return startPromise;
    },

    async stop() {
      if (state === 'stopped') {
        return;
      }
      if (state === 'created' && !runtime) {
        state = 'stopped';
        return;
      }
      state = 'stopping';
      try {
        runtime?.close();
      } finally {
        state = 'stopped';
      }
    },

    async runNow(input) {
      const rt = assertReady();
      return rt.scheduler.triggerNow(input.scheduleId);
    },

    async getRun(runId) {
      const rt = assertReady();
      return rt.runStore.get(runId);
    },

    async getHealth() {
      if (state === 'ready' && runtime && !runtime.isClosed()) {
        return runtime.getHealth();
      }
      if (state === 'stopped' || state === 'stopping') {
        if (runtime) {
          return runtime.getHealth();
        }
        return unavailableHealth(clockIso(clock), 'stopped');
      }
      return unavailableHealth(clockIso(clock), 'not_started');
    },

    async registerSchedule(input) {
      const rt = assertReady();
      return rt.scheduler.registerSchedule(input);
    },

    async listSchedules() {
      const rt = assertReady();
      return rt.scheduleStore.listAll();
    },

    async getSchedule(scheduleId) {
      const rt = assertReady();
      return rt.scheduleStore.get(scheduleId);
    },

    async enableSchedule(scheduleId) {
      const rt = assertReady();
      return rt.scheduler.enableSchedule(scheduleId);
    },

    async disableSchedule(scheduleId) {
      const rt = assertReady();
      return rt.scheduler.disableSchedule(scheduleId);
    },

    redactedConfig() {
      if (!runtime) return null;
      return runtime.redactedConfig();
    },

    async processNext() {
      const rt = assertReady();
      return rt.worker.processNext();
    },

    async triggerDueRuns() {
      const rt = assertReady();
      return rt.scheduler.triggerDueRuns();
    },
  };
}
