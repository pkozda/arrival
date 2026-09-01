import { describe, expect, it } from 'vitest';
import {
  aggregateDiscoveryHealth,
  createFakeClock,
  createInMemoryDiscoveryTelemetry,
  createInMemoryExecutionQueue,
  DEFAULT_QUEUE_BACKLOG_THRESHOLD,
  type DiscoveryRuntimeHealth,
} from '../index.js';
import {
  createRuntimeHarness,
  happyPathTransport,
  registerDueSchedule,
  runDueOnce,
  RUNTIME_NOW,
  SECRETS,
} from './runtime-test-helpers.js';

const ALL_SECRETS = [
  SECRETS.brave,
  SECRETS.openai,
  SECRETS.resend,
  SECRETS.telegram,
];

function assertNoSecrets(health: DiscoveryRuntimeHealth) {
  const serialized = JSON.stringify(health);
  for (const secret of ALL_SECRETS) {
    expect(serialized).not.toContain(secret);
  }
  expect(serialized).not.toMatch(/Authorization/i);
  expect(serialized).not.toContain('<html');
  expect(serialized).not.toContain('sk-');
}

describe('E5.6 health aggregation', () => {
  it('aggregates HEALTHY / DEGRADED / UNAVAILABLE deterministically', () => {
    const base = {
      checkedAt: RUNTIME_NOW,
      runtimeInstanceId: 'rt-1',
      queue: {
        queuedCount: 0,
        runningCount: 0,
        failedCount: 0,
        recoverableClaimCount: 0,
      },
      scheduler: {
        enabledSchedules: 1,
        disabledSchedules: 0,
        activeRuns: 0,
        heldLockCount: 0,
        contentionObserved: false,
      },
      persistence: {
        results: 'AVAILABLE' as const,
        scheduler: 'AVAILABLE' as const,
        notifications: 'AVAILABLE' as const,
        queue: 'AVAILABLE' as const,
      },
      providers: [
        {
          kind: 'search' as const,
          provider: 'brave',
          configured: true,
          enabled: true,
          lastObservedStatus: 'UNKNOWN' as const,
        },
      ],
      recentRuns: [],
      observability: { status: 'AVAILABLE' as const },
    };

    expect(
      aggregateDiscoveryHealth({ ...base, runtimeOpen: true }).status
    ).toBe('HEALTHY');

    expect(
      aggregateDiscoveryHealth({
        ...base,
        runtimeOpen: true,
        queue: { ...base.queue, recoverableClaimCount: 2 },
      }).status
    ).toBe('DEGRADED');

    expect(
      aggregateDiscoveryHealth({
        ...base,
        runtimeOpen: false,
      }).status
    ).toBe('UNAVAILABLE');

    expect(
      aggregateDiscoveryHealth({
        ...base,
        runtimeOpen: true,
        queue: {
          ...base.queue,
          queuedCount: DEFAULT_QUEUE_BACKLOG_THRESHOLD,
        },
      }).warnings.some((w) => w.code === 'QUEUE_BACKLOG')
    ).toBe(true);
  });

  it('telemetry unavailable does not force UNAVAILABLE/DEGRADED status', () => {
    const health = aggregateDiscoveryHealth({
      checkedAt: RUNTIME_NOW,
      runtimeOpen: true,
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
        results: 'AVAILABLE',
        scheduler: 'AVAILABLE',
        notifications: 'AVAILABLE',
        queue: 'AVAILABLE',
      },
      providers: [],
      recentRuns: [],
      observability: { status: 'UNAVAILABLE' },
    });
    expect(health.status).toBe('HEALTHY');
    expect(health.warnings.some((w) => w.code === 'TELEMETRY_UNAVAILABLE')).toBe(
      true
    );
  });
});

describe('E5.6 queue health stats', () => {
  it('reports empty / queued / running / failed / recoverable without mutating', async () => {
    const clock = createFakeClock(RUNTIME_NOW);
    const queue = createInMemoryExecutionQueue([], { clock });

    let stats = await queue.getHealthStats(RUNTIME_NOW, {
      visibilityTimeoutMs: 60_000,
    });
    expect(stats).toMatchObject({
      queuedCount: 0,
      runningCount: 0,
      failedCount: 0,
      recoverableClaimCount: 0,
    });

    await queue.enqueue({
      jobId: 'job-1',
      runId: 'run-1',
      scheduleId: 'sched-1',
      profileId: 'p1',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      trigger: 'scheduled',
      requestedAt: RUNTIME_NOW,
    });
    stats = await queue.getHealthStats(RUNTIME_NOW);
    expect(stats.queuedCount).toBe(1);
    expect(stats.oldestQueuedAt).toBe(RUNTIME_NOW);

    await queue.dequeue({ claimOwner: 'w1' });
    stats = await queue.getHealthStats(RUNTIME_NOW, {
      visibilityTimeoutMs: 60_000,
    });
    expect(stats.runningCount).toBe(1);
    expect(stats.recoverableClaimCount).toBe(0);

    // Expire lease window without recovering
    clock.set('2026-08-31T10:02:00.000Z');
    stats = await queue.getHealthStats(clock.now().toISOString(), {
      visibilityTimeoutMs: 60_000,
    });
    expect(stats.recoverableClaimCount).toBe(1);
    expect((await queue.get('job-1'))?.status).toBe('RUNNING');

    await queue.fail('job-1', clock.now().toISOString(), 'boom');
    stats = await queue.getHealthStats(clock.now().toISOString());
    expect(stats.failedCount).toBe(1);
    expect(stats.runningCount).toBe(0);
  });
});

describe('E5.6 runtime.getHealth', () => {
  it('returns HEALTHY open runtime and is side-effect free', async () => {
    const transport = happyPathTransport();
    const { runtime, persistence } = createRuntimeHarness({
      transport,
      runtimeInstanceId: 'health-1',
    });

    try {
      const before = await runtime.getHealth();
      expect(before.status).toBe('HEALTHY');
      expect(before.runtimeOpen).toBe(true);
      expect(before.canAcceptWork).toBe(true);
      expect(before.queue.queuedCount).toBe(0);
      expect(before.providers.find((p) => p.kind === 'search')?.configured).toBe(
        true
      );
      expect(
        before.providers.find((p) => p.kind === 'email')?.enabled
      ).toBe(true);
      expect(
        before.providers.find((p) => p.kind === 'search')?.lastObservedStatus
      ).toBe('UNKNOWN');

      await registerDueSchedule(runtime);
      const mid = await runtime.getHealth();
      expect(mid.scheduler.enabledSchedules).toBe(1);
      expect(mid.scheduler.nextScheduledRunAt).toBe(RUNTIME_NOW);

      // Health must not enqueue / advance
      expect(await runtime.queue.getPending()).toHaveLength(0);

      const again = await runtime.getHealth();
      expect(again.scheduler.nextScheduledRunAt).toBe(
        mid.scheduler.nextScheduledRunAt
      );
      assertNoSecrets(again);
    } finally {
      runtime.close();
      persistence.cleanup();
    }
  });

  it('closed runtime returns UNAVAILABLE without throwing', async () => {
    const transport = happyPathTransport();
    const { runtime, persistence } = createRuntimeHarness({ transport });
    try {
      runtime.close();
      const health = await runtime.getHealth();
      expect(health.status).toBe('UNAVAILABLE');
      expect(health.runtimeOpen).toBe(false);
      expect(health.canAcceptWork).toBe(false);
      expect(health.warnings.some((w) => w.code === 'RUNTIME_CLOSED')).toBe(
        true
      );
      assertNoSecrets(health);
    } finally {
      persistence.cleanup();
    }
  });

  it('reflects queue / run / notification after successful work', async () => {
    const sink = createInMemoryDiscoveryTelemetry();
    const transport = happyPathTransport();
    const { runtime, persistence } = createRuntimeHarness({
      transport,
      telemetry: sink,
      runtimeInstanceId: 'health-run',
    });

    try {
      await registerDueSchedule(runtime);
      const { workerResult } = await runDueOnce(runtime);
      expect(workerResult).toMatchObject({
        kind: 'processed',
        pipelineStatus: 'SUCCESS',
      });

      const health = await runtime.getHealth();
      expect(health.status).toBe('HEALTHY');
      expect(health.recentRuns.length).toBeGreaterThan(0);
      expect(health.recentRuns[0]?.status).toBe('SUCCESS');
      expect(
        health.providers.find((p) => p.kind === 'search')?.lastObservedStatus
      ).toBe('HEALTHY');
      expect(
        health.providers.find((p) => p.kind === 'email')?.lastObservedStatus
      ).toBe('HEALTHY');
      assertNoSecrets(health);
    } finally {
      runtime.close();
      persistence.cleanup();
    }
  });

  it('reports recoverable claims as DEGRADED without recovering them', async () => {
    const transport = happyPathTransport();
    const { runtime, clock, persistence } = createRuntimeHarness({
      transport,
      queueVisibilityTimeoutMs: 60_000,
      workerId: 'worker-health',
    });

    try {
      await registerDueSchedule(runtime);
      await runtime.scheduler.triggerDueRuns();
      const job = await runtime.queue.dequeue({ claimOwner: 'worker-health' });
      expect(job?.status).toBe('RUNNING');

      clock.set('2026-08-31T10:05:00.000Z');
      const health = await runtime.getHealth();
      expect(health.queue.recoverableClaimCount).toBe(1);
      expect(health.status).toBe('DEGRADED');
      expect(
        health.warnings.some((w) => w.code === 'QUEUE_CLAIMS_EXPIRED')
      ).toBe(true);

      // Still RUNNING — health did not recover
      expect((await runtime.queue.get(job!.jobId))?.status).toBe('RUNNING');

      const recovered = await runtime.recoverQueueClaims();
      expect(recovered.recoveredJobIds).toContain(job!.jobId);
      const after = await runtime.getHealth();
      expect(after.queue.recoverableClaimCount).toBe(0);
    } finally {
      runtime.close();
      persistence.cleanup();
    }
  });

  it('broken telemetry does not break health', async () => {
    const broken = {
      emit() {
        throw new Error(`telemetry boom ${SECRETS.brave}`);
      },
    };
    const transport = happyPathTransport();
    const { runtime, persistence } = createRuntimeHarness({
      transport,
      telemetry: broken,
    });

    try {
      await registerDueSchedule(runtime);
      await runDueOnce(runtime);
      const health = await runtime.getHealth();
      expect(['HEALTHY', 'DEGRADED']).toContain(health.status);
      expect(health.runtimeOpen).toBe(true);
      assertNoSecrets(health);
    } finally {
      runtime.close();
      persistence.cleanup();
    }
  });

  it('disabled telegram is not treated as failure', async () => {
    const transport = happyPathTransport();
    const { runtime, persistence } = createRuntimeHarness({
      transport,
      channel: 'EMAIL',
      telegram: false,
    });
    try {
      const health = await runtime.getHealth();
      const tg = health.providers.find((p) => p.kind === 'telegram');
      expect(tg?.enabled).toBe(false);
      expect(tg?.configured).toBe(false);
      expect(health.status).toBe('HEALTHY');
    } finally {
      runtime.close();
      persistence.cleanup();
    }
  });

  it('getHealth does not acquire scheduler locks', async () => {
    const transport = happyPathTransport();
    const { runtime, persistence } = createRuntimeHarness({
      transport,
      runtimeInstanceId: 'no-lock',
    });

    try {
      await registerDueSchedule(runtime);
      const before = await runtime.schedulerLock.countActive(RUNTIME_NOW);
      await runtime.getHealth();
      await runtime.getHealth();
      const after = await runtime.schedulerLock.countActive(RUNTIME_NOW);
      expect(after).toBe(before);
      expect(after).toBe(0);
    } finally {
      runtime.close();
      persistence.cleanup();
    }
  });
});
