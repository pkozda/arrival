import { describe, expect, it } from 'vitest';
import {
  createDiscoveryRuntime,
  createFakeClock,
  createInMemoryProfileStore,
  redactDiscoveryProductionConfig,
  validateDiscoveryProductionConfig,
} from '../index.js';
import {
  createRuntimeHarness,
  createRuntimeHttpTransport,
  happyPathTransport,
  jobProfile,
  registerDueSchedule,
  runDueOnce,
  RUNTIME_NOW,
  SECRETS,
  smokeRegistry,
  tempPersistencePaths,
} from './runtime-test-helpers.js';

describe('E4.7 runtime happy path', () => {
  it('schedule → queue → worker → pipeline → Result → Digest → Email SENT → ACK', async () => {
    const transport = happyPathTransport();
    const { runtime, persistence } = createRuntimeHarness({
      transport,
      channel: 'EMAIL',
    });

    try {
      await registerDueSchedule(runtime);
      const { tick, workerResult } = await runDueOnce(runtime);

      expect(tick.outcomes[0]?.kind).toBe('enqueued');
      expect(workerResult).toMatchObject({
        kind: 'processed',
        pipelineStatus: 'SUCCESS',
      });

      const schedule = await runtime.scheduleStore.get('sched-runtime');
      expect(schedule?.nextRunAt).toBe('2026-08-31T11:00:00.000Z');
      expect(schedule?.runningRunId).toBeNull();

      const runs = await runtime.runStore.listBySchedule('sched-runtime');
      expect(runs).toHaveLength(1);
      expect(runs[0]?.status).toBe('SUCCESS');
      expect(await runtime.queue.getPending()).toHaveLength(0);

      const completed = await runtime.queue.getByRunId(runs[0]!.runId);
      expect(completed?.status).toBe('COMPLETED');

      expect(
        (runtime.resultStore as { count(): number }).count()
      ).toBeGreaterThanOrEqual(1);
      expect(
        (runtime.notificationStore as { count(): number }).count()
      ).toBe(1);

      expect(
        transport.requests.filter((r) => r.url.includes('resend')).length
      ).toBe(1);

      const serialized = JSON.stringify({
        runs,
        schedule,
        diagnostics: runs[0],
      });
      expect(serialized).not.toContain(SECRETS.brave);
      expect(serialized).not.toContain(SECRETS.openai);
      expect(serialized).not.toContain(SECRETS.resend);
    } finally {
      runtime.close();
      persistence.cleanup();
    }
  });

  it('Telegram provider path through same runtime composition', async () => {
    const transport = happyPathTransport();
    const { runtime, persistence } = createRuntimeHarness({
      transport,
      channel: 'TELEGRAM',
      email: false,
      telegram: true,
    });

    try {
      await registerDueSchedule(runtime, 'sched-tg');
      const { workerResult } = await runDueOnce(runtime);
      expect(workerResult).toMatchObject({
        kind: 'processed',
        pipelineStatus: 'SUCCESS',
      });
      expect(
        (runtime.notificationStore as { count(): number }).count()
      ).toBe(1);
      expect(
        transport.requests.some((r) => r.url.includes('api.telegram.org'))
      ).toBe(true);
    } finally {
      runtime.close();
      persistence.cleanup();
    }
  });

  it('pipeline works without notification providers', async () => {
    const transport = happyPathTransport();
    const persistence = tempPersistencePaths();
    const runtime = createDiscoveryRuntime({
      production: {
        brave: { apiKey: SECRETS.brave },
        openai: { apiKey: SECRETS.openai },
        transport,
      },
      persistence,
      registry: smokeRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      transport,
      clock: createFakeClock(RUNTIME_NOW),
    });

    try {
      expect(runtime.notificationService).toBeNull();
      await registerDueSchedule(runtime, 'sched-no-notify');
      const { workerResult } = await runDueOnce(runtime);
      expect(workerResult).toMatchObject({
        kind: 'processed',
        pipelineStatus: 'SUCCESS',
      });
      expect(
        (runtime.notificationStore as { count(): number }).count()
      ).toBe(0);
    } finally {
      runtime.close();
      persistence.cleanup();
    }
  });
});

describe('E4.7 scheduler semantics at runtime', () => {
  it('scheduled trigger advances nextRunAt; manual does not', async () => {
    const transport = happyPathTransport();
    const { runtime, clock, persistence } = createRuntimeHarness({ transport });

    try {
      await runtime.scheduler.registerSchedule({
        scheduleId: 'sched-manual',
        profileId: 'profile-job',
        strategyId: 'job-discovery',
        strategyVersion: '1',
        intervalSeconds: 3600,
        nextRunAt: '2026-08-31T15:00:00.000Z',
      });

      const manual = await runtime.scheduler.triggerNow('sched-manual');
      expect(manual.kind).toBe('enqueued');
      expect((await runtime.scheduleStore.get('sched-manual'))?.nextRunAt).toBe(
        '2026-08-31T15:00:00.000Z'
      );
      await runtime.worker.processNext();

      await runtime.scheduler.registerSchedule({
        scheduleId: 'sched-due',
        profileId: 'profile-job',
        strategyId: 'job-discovery',
        strategyVersion: '1',
        intervalSeconds: 3600,
        nextRunAt: RUNTIME_NOW,
      });
      clock.set(RUNTIME_NOW);
      const due = await runtime.scheduler.triggerDueRuns();
      expect(due.outcomes[0]?.kind).toBe('enqueued');
      expect((await runtime.scheduleStore.get('sched-due'))?.nextRunAt).toBe(
        '2026-08-31T11:00:00.000Z'
      );
    } finally {
      runtime.close();
      persistence.cleanup();
    }
  });

  it('missed intervals coalesce to one enqueue', async () => {
    const transport = happyPathTransport();
    const { runtime, persistence } = createRuntimeHarness({
      transport,
      start: '2026-08-31T12:30:00.000Z',
    });

    try {
      await registerDueSchedule(
        runtime,
        'sched-miss',
        '2026-08-31T10:00:00.000Z'
      );
      const tick = await runtime.scheduler.triggerDueRuns();
      expect(tick.outcomes).toHaveLength(1);
      expect(await runtime.queue.getPending()).toHaveLength(1);
      expect((await runtime.scheduleStore.get('sched-miss'))?.nextRunAt).toBe(
        '2026-08-31T13:00:00.000Z'
      );
    } finally {
      runtime.close();
      persistence.cleanup();
    }
  });

  it('duplicate due tick while job queued does not create second job', async () => {
    const transport = happyPathTransport();
    const { runtime, persistence } = createRuntimeHarness({ transport });

    try {
      await registerDueSchedule(runtime, 'sched-dup');
      await runtime.scheduler.triggerDueRuns();
      const again = await runtime.scheduler.triggerDueRuns();
      expect(again.outcomes).toHaveLength(0);
      expect(await runtime.queue.getPending()).toHaveLength(1);
    } finally {
      runtime.close();
      persistence.cleanup();
    }
  });
});

describe('E4.7 configuration + lifecycle', () => {
  it('invalid production config fails before network', () => {
    expect(
      validateDiscoveryProductionConfig({
        brave: { apiKey: '' },
        openai: { apiKey: 'o' },
      }).ok
    ).toBe(false);

    const persistence = tempPersistencePaths();
    expect(() =>
      createDiscoveryRuntime({
        production: {
          brave: { apiKey: '' },
          openai: { apiKey: SECRETS.openai },
        },
        persistence,
        registry: smokeRegistry(),
        profileStore: createInMemoryProfileStore([]),
      })
    ).toThrow(/Invalid discovery (runtime|production) config/);
    persistence.cleanup();
  });

  it('secrets redacted in production config view', () => {
    const redacted = redactDiscoveryProductionConfig({
      brave: { apiKey: SECRETS.brave },
      openai: { apiKey: SECRETS.openai },
      email: { apiKey: SECRETS.resend, from: 'a@b.com' },
      telegram: { botToken: SECRETS.telegram },
    });
    const json = JSON.stringify(redacted);
    expect(json).not.toContain(SECRETS.brave);
    expect(json).not.toContain(SECRETS.openai);
    expect(json).not.toContain(SECRETS.resend);
    expect(json).not.toContain(SECRETS.telegram);
  });

  it('close is idempotent', async () => {
    const transport = happyPathTransport();
    const { runtime, persistence } = createRuntimeHarness({ transport });
    await registerDueSchedule(runtime);
    runtime.close();
    runtime.close();
    persistence.cleanup();
  });

  it('queue jobs survive restart (E5.2 durable queue)', async () => {
    const transport = happyPathTransport();
    const persistence = tempPersistencePaths();
    const { runtime } = createRuntimeHarness({ transport, persistence });

    await registerDueSchedule(runtime);
    await runtime.scheduler.triggerDueRuns();
    expect(await runtime.queue.getPending()).toHaveLength(1);
    expect(
      (await runtime.scheduleStore.get('sched-runtime'))?.runningRunId
    ).toBeTruthy();
    runtime.close();

    const { runtime: runtimeB } = createRuntimeHarness({
      transport,
      persistence,
    });
    try {
      expect(await runtimeB.queue.getPending()).toHaveLength(1);
      const schedule = await runtimeB.scheduleStore.get('sched-runtime');
      expect(schedule?.nextRunAt).toBe('2026-08-31T11:00:00.000Z');
      expect(schedule?.runningRunId).toBeTruthy();
      const workerResult = await runtimeB.worker.processNext();
      expect(workerResult).toMatchObject({
        kind: 'processed',
        pipelineStatus: 'SUCCESS',
      });
      expect(
        (await runtimeB.scheduleStore.get('sched-runtime'))?.runningRunId
      ).toBeNull();
    } finally {
      runtimeB.close();
      persistence.cleanup();
    }
  });

  it('unexpected HTTP request fails the suite transport', async () => {
    const transport = createRuntimeHttpTransport({});
    await expect(
      transport.request({ url: 'https://evil.example/', method: 'GET' })
    ).rejects.toThrow(/UNEXPECTED_NETWORK_REQUEST/);
  });
});
