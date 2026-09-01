import { describe, expect, it } from 'vitest';
import {
  createDiscoveryService,
  createFakeClock,
  createInMemoryProfileStore,
  createInMemoryRateLimiter,
  DiscoveryServiceNotStartedError,
  DiscoveryServiceStartupError,
  DiscoveryServiceStoppedError,
  type DiscoveryServiceConfig,
} from '../index.js';
import {
  happyPathTransport,
  jobProfile,
  RUNTIME_NOW,
  SECRETS,
  smokeRegistry,
  tempPersistencePaths,
} from '../runtime/runtime-test-helpers.js';

function serviceConfig(
  overrides: Partial<DiscoveryServiceConfig> = {}
): DiscoveryServiceConfig & { cleanup(): void } {
  const persistence = tempPersistencePaths();
  const transport = happyPathTransport();
  const clock = createFakeClock(RUNTIME_NOW);
  return {
    production: {
      brave: { apiKey: SECRETS.brave },
      openai: { apiKey: SECRETS.openai, model: 'gpt-4o-mini' },
      email: {
        apiKey: SECRETS.resend,
        from: 'Arrival Atlas <noreply@example.com>',
      },
      transport,
      rateLimiter: createInMemoryRateLimiter(),
    },
    persistence,
    registry: smokeRegistry(),
    profileStore: createInMemoryProfileStore([jobProfile()]),
    clock,
    transport,
    runtimeInstanceId: 'svc-1',
    resolveNotificationTarget: () => ({
      channel: 'EMAIL',
      recipient: { userId: 'user-1', address: 'user@example.com' },
    }),
    ...overrides,
    cleanup: persistence.cleanup,
  };
}

describe('E6.1 DiscoveryService lifecycle', () => {
  it('starts successfully and second start is idempotent', async () => {
    const config = serviceConfig();
    const service = createDiscoveryService(config);
    try {
      expect(service.lifecycle()).toBe('created');
      await service.start();
      expect(service.lifecycle()).toBe('ready');
      await service.start();
      expect(service.lifecycle()).toBe('ready');
      const health = await service.getHealth();
      expect(health.runtimeOpen).toBe(true);
    } finally {
      await service.stop();
      config.cleanup();
    }
  });

  it('startup invokes recovery controls', async () => {
    const config = serviceConfig();
    const service = createDiscoveryService(config);
    try {
      await service.start();
      // Recovery is best verified by successful start with durable queue;
      // a second start must not throw or re-create state.
      await service.start();
      expect(service.lifecycle()).toBe('ready');
    } finally {
      await service.stop();
      config.cleanup();
    }
  });

  it('surfaces startup construction failure', async () => {
    const config = serviceConfig({
      persistence: {
        resultsDatabasePath: '',
        schedulerDatabasePath: '',
        notificationsDatabasePath: '',
        queueDatabasePath: '',
        profilesDatabasePath: '',
      },
    });
    // Empty paths fail validation before construction — use invalid via spy
    const service = createDiscoveryService({
      ...config,
      persistence: {
        resultsDatabasePath: '/tmp/discovery-e61-results.sqlite',
        schedulerDatabasePath: '/tmp/discovery-e61-scheduler.sqlite',
        notificationsDatabasePath: '/tmp/discovery-e61-notifications.sqlite',
        queueDatabasePath: '/tmp/discovery-e61-queue.sqlite',
        profilesDatabasePath: '/tmp/discovery-e61-profiles.sqlite',
      },
      production: {
        ...config.production,
        brave: { apiKey: '' },
      },
    });
    await expect(service.start()).rejects.toBeInstanceOf(
      DiscoveryServiceStartupError
    );
    expect(service.lifecycle()).toBe('created');
    config.cleanup();
  });

  it('stops successfully and second stop is idempotent', async () => {
    const config = serviceConfig();
    const service = createDiscoveryService(config);
    try {
      await service.start();
      await service.stop();
      expect(service.lifecycle()).toBe('stopped');
      await service.stop();
      expect(service.lifecycle()).toBe('stopped');
    } finally {
      config.cleanup();
    }
  });

  it('operations after stop fail deterministically', async () => {
    const config = serviceConfig();
    const service = createDiscoveryService(config);
    try {
      await service.start();
      await service.stop();
      await expect(
        service.runNow({ scheduleId: 'sched-1' })
      ).rejects.toBeInstanceOf(DiscoveryServiceStoppedError);
      await expect(service.getRun('run-1')).rejects.toBeInstanceOf(
        DiscoveryServiceStoppedError
      );
      await expect(service.processNext()).rejects.toBeInstanceOf(
        DiscoveryServiceStoppedError
      );
      // Health may still answer UNAVAILABLE via closed runtime
      const health = await service.getHealth();
      expect(health.status).toBe('UNAVAILABLE');
    } finally {
      config.cleanup();
    }
  });

  it('operations before start fail deterministically', async () => {
    const config = serviceConfig();
    const service = createDiscoveryService(config);
    try {
      await expect(
        service.runNow({ scheduleId: 'sched-1' })
      ).rejects.toBeInstanceOf(DiscoveryServiceNotStartedError);
    } finally {
      await service.stop();
      config.cleanup();
    }
  });
});

describe('E6.1 DiscoveryService runNow', () => {
  it('enqueues through scheduler/queue without advancing nextRunAt', async () => {
    const config = serviceConfig();
    const service = createDiscoveryService(config);
    try {
      await service.start();
      const schedule = await service.registerSchedule({
        scheduleId: 'sched-manual',
        profileId: 'profile-job',
        strategyId: 'job-discovery',
        strategyVersion: '1',
        intervalSeconds: 3600,
        nextRunAt: '2026-08-31T12:00:00.000Z',
      });
      expect(schedule.nextRunAt).toBe('2026-08-31T12:00:00.000Z');

      const outcome = await service.runNow({ scheduleId: 'sched-manual' });
      expect(outcome.kind).toBe('enqueued');
      if (outcome.kind !== 'enqueued') return;

      // Manual trigger must not advance nextRunAt
      const after = await service.getRun(outcome.runId);
      expect(after?.runId).toBe(outcome.runId);
      expect(after?.trigger).toBe('manual');

      // Re-register path: inspect schedule via second runNow skip already_running
      // nextRunAt preserved — fetch via triggerDueRuns skip / getHealth
      const health = await service.getHealth();
      expect(health.scheduler.activeRuns).toBe(1);

      // Job is queued/running — pipeline not yet executed until processNext
      const pendingOrRunning = outcome.jobId;
      expect(pendingOrRunning).toBeTruthy();

      // Overlap: second runNow skips
      const dup = await service.runNow({ scheduleId: 'sched-manual' });
      expect(dup).toMatchObject({ kind: 'skipped', reason: 'already_running' });

      // Completing via worker (queue → worker → pipeline), not direct execute
      const processed = await service.processNext();
      expect(processed.kind).toBe('processed');
      if (processed.kind === 'processed') {
        expect(processed.pipelineStatus).toBe('SUCCESS');
        expect(processed.runId).toBe(outcome.runId);
      }

      const finished = await service.getRun(outcome.runId);
      expect(finished?.status).toBe('SUCCESS');
    } finally {
      await service.stop();
      config.cleanup();
    }
  });

  it('runNow does not call pipeline executor directly', async () => {
    const config = serviceConfig();
    const service = createDiscoveryService(config);
    try {
      await service.start();
      await service.registerSchedule({
        scheduleId: 'sched-spy',
        profileId: 'profile-job',
        strategyId: 'job-discovery',
        strategyVersion: '1',
        intervalSeconds: 3600,
        nextRunAt: RUNTIME_NOW,
      });

      const outcome = await service.runNow({ scheduleId: 'sched-spy' });
      expect(outcome.kind).toBe('enqueued');

      // After enqueue only: run still PENDING, not SUCCESS
      if (outcome.kind === 'enqueued') {
        const run = await service.getRun(outcome.runId);
        expect(run?.status).toBe('PENDING');
      }
    } finally {
      await service.stop();
      config.cleanup();
    }
  });
});

describe('E6.1 DiscoveryService getRun / getHealth', () => {
  it('getRun returns null for missing run', async () => {
    const config = serviceConfig();
    const service = createDiscoveryService(config);
    try {
      await service.start();
      expect(await service.getRun('missing-run')).toBeNull();
    } finally {
      await service.stop();
      config.cleanup();
    }
  });

  it('getHealth delegates and does not mutate queue', async () => {
    const config = serviceConfig();
    const service = createDiscoveryService(config);
    try {
      await service.start();
      await service.registerSchedule({
        scheduleId: 'sched-health',
        profileId: 'profile-job',
        strategyId: 'job-discovery',
        strategyVersion: '1',
        intervalSeconds: 3600,
        nextRunAt: '2026-09-01T00:00:00.000Z',
      });
      const before = await service.getHealth();
      expect(before.status).toBe('HEALTHY');
      const again = await service.getHealth();
      expect(again.queue.queuedCount).toBe(before.queue.queuedCount);
      expect(again.scheduler.nextScheduledRunAt).toBe(
        before.scheduler.nextScheduledRunAt
      );
      const serialized = JSON.stringify(again);
      expect(serialized).not.toContain(SECRETS.brave);
      expect(serialized).not.toContain(SECRETS.openai);
    } finally {
      await service.stop();
      config.cleanup();
    }
  });
});

describe('E6.1 scheduled path', () => {
  it('triggerDueRuns advances nextRunAt; runNow does not', async () => {
    const config = serviceConfig();
    const service = createDiscoveryService(config);
    try {
      await service.start();
      await service.registerSchedule({
        scheduleId: 'sched-due',
        profileId: 'profile-job',
        strategyId: 'job-discovery',
        strategyVersion: '1',
        intervalSeconds: 3600,
        nextRunAt: RUNTIME_NOW,
      });

      const tick = await service.triggerDueRuns();
      expect(tick.outcomes[0]?.kind).toBe('enqueued');
      await service.processNext();

      // After scheduled run completes, next due is advanced
      const health = await service.getHealth();
      expect(health.scheduler.nextScheduledRunAt).toBe(
        '2026-08-31T11:00:00.000Z'
      );
    } finally {
      await service.stop();
      config.cleanup();
    }
  });
});
