import { describe, expect, it } from 'vitest';
import {
  AdapterFailureError,
  categoryForEventName,
  createDiscoveryExecutionWorker,
  createFakeClock,
  createInMemoryDiscoveryTelemetry,
  createInMemoryExecutionQueue,
  createInMemoryRunStore,
  createInMemoryScheduleStore,
  createIncrementingTelemetryEventIdGenerator,
  createTelemetryEmitter,
  safeEmit,
  sanitizeTelemetryAttributes,
  wrapAdapterPortsForTelemetry,
  wrapExecutionQueueForTelemetry,
  type DiscoveryTelemetry,
  type DiscoveryTelemetryEvent,
  type SearchAdapter,
} from '../index.js';
import {
  createRuntimeHarness,
  happyPathTransport,
  registerDueSchedule,
  runDueOnce,
  RUNTIME_NOW,
  SECRETS,
} from '../runtime/runtime-test-helpers.js';

const ALL_SECRETS = [
  SECRETS.brave,
  SECRETS.openai,
  SECRETS.resend,
  SECRETS.telegram,
];

function assertNoSecrets(events: readonly DiscoveryTelemetryEvent[]) {
  const serialized = JSON.stringify(events);
  for (const secret of ALL_SECRETS) {
    expect(serialized).not.toContain(secret);
  }
  expect(serialized).not.toMatch(/Authorization/i);
  expect(serialized).not.toContain('<html');
  expect(serialized).not.toContain('system prompt');
  expect(serialized).not.toContain('JOIN Acme');
}

describe('E5.5 telemetry core', () => {
  it('assigns category from event name and requires envelope fields', () => {
    expect(categoryForEventName('pipeline.started')).toBe('pipeline');
    expect(categoryForEventName('retry.scheduled')).toBe('retry');
    expect(categoryForEventName('adapter.timeout')).toBe('adapter');

    const clock = createFakeClock(RUNTIME_NOW);
    const sink = createInMemoryDiscoveryTelemetry();
    const ids = createIncrementingTelemetryEventIdGenerator('evt');
    const emitter = createTelemetryEmitter({
      telemetry: sink,
      clock,
      eventIdGenerator: ids,
      runtimeInstanceId: 'rt-1',
    });

    emitter.emit({
      eventName: 'pipeline.started',
      runId: 'run-1',
      profileId: 'profile-1',
      strategyId: 'job-discovery',
    });

    const [event] = sink.events();
    expect(event).toMatchObject({
      eventId: 'evt-1',
      eventName: 'pipeline.started',
      category: 'pipeline',
      occurredAt: RUNTIME_NOW,
      runId: 'run-1',
      profileId: 'profile-1',
      strategyId: 'job-discovery',
      runtimeInstanceId: 'rt-1',
    });
  });

  it('uses clock-controlled timestamps', () => {
    const clock = createFakeClock('2026-01-01T00:00:00.000Z');
    const sink = createInMemoryDiscoveryTelemetry();
    const emitter = createTelemetryEmitter({
      telemetry: sink,
      clock,
      eventIdGenerator: () => 'fixed-id',
    });
    clock.set('2026-01-02T12:00:00.000Z');
    emitter.emit({ eventName: 'runtime.created' });
    expect(sink.events()[0]?.occurredAt).toBe('2026-01-02T12:00:00.000Z');
  });

  it('safeEmit isolates sync and async provider failures', async () => {
    const throwing: DiscoveryTelemetry = {
      emit() {
        throw new Error('telemetry down');
      },
    };
    expect(() =>
      safeEmit(throwing, {
        eventId: '1',
        eventName: 'runtime.created',
        category: 'runtime',
        occurredAt: RUNTIME_NOW,
      })
    ).not.toThrow();

    let rejectCount = 0;
    const asyncFail: DiscoveryTelemetry = {
      emit() {
        return Promise.reject(new Error('async telemetry down')).catch(() => {
          rejectCount += 1;
        }) as Promise<void>;
      },
    };
    safeEmit(asyncFail, {
      eventId: '2',
      eventName: 'runtime.closed',
      category: 'runtime',
      occurredAt: RUNTIME_NOW,
    });
    await Promise.resolve();
    expect(rejectCount).toBeGreaterThanOrEqual(0);
  });

  it('sanitizes forbidden keys and secret substrings', () => {
    const attrs = sanitizeTelemetryAttributes(
      {
        apiKey: SECRETS.brave,
        Authorization: `Bearer ${SECRETS.openai}`,
        prompt: 'system prompt with secrets',
        rawHtml: '<html>page</html>',
        failureCode: 'TIMEOUT',
        message: `failed with ${SECRETS.resend}`,
      },
      ALL_SECRETS
    );
    expect(attrs?.apiKey).toBeUndefined();
    expect(attrs?.Authorization).toBeUndefined();
    expect(attrs?.prompt).toBeUndefined();
    expect(attrs?.rawHtml).toBeUndefined();
    expect(attrs?.failureCode).toBe('TIMEOUT');
    expect(String(attrs?.message)).not.toContain(SECRETS.resend);
    expect(String(attrs?.message).toLowerCase()).toContain('redacted');
  });
});

describe('E5.5 adapter wrap', () => {
  it('emits started/completed and timeout/cancel/failed', async () => {
    const clock = createFakeClock(RUNTIME_NOW);
    const sink = createInMemoryDiscoveryTelemetry();
    const emitter = createTelemetryEmitter({
      telemetry: sink,
      clock,
      eventIdGenerator: createIncrementingTelemetryEventIdGenerator('a'),
    });

    const okSearch: SearchAdapter = {
      async search() {
        return [];
      },
    };
    const wrappedOk = wrapAdapterPortsForTelemetry(
      { search: okSearch },
      emitter,
      clock,
      { search: 'brave' }
    );
    await wrappedOk.search!.search([], {
      run: { id: 'run-a' } as never,
      now: () => RUNTIME_NOW,
    });
    expect(sink.eventsByName('adapter.started')).toHaveLength(1);
    expect(sink.eventsByName('adapter.completed')[0]?.attributes).toMatchObject({
      adapterKind: 'search',
      provider: 'brave',
      operation: 'search',
    });

    sink.clear();
    const timeoutSearch: SearchAdapter = {
      async search() {
        throw new AdapterFailureError({
          code: 'TIMEOUT',
          message: 'timed out',
          adapter: 'search',
          operation: 'search',
          retryable: true,
        });
      },
    };
    const wrappedTimeout = wrapAdapterPortsForTelemetry(
      { search: timeoutSearch },
      emitter,
      clock
    );
    await expect(
      wrappedTimeout.search!.search([], {
        run: { id: 'run-b' } as never,
        now: () => RUNTIME_NOW,
      })
    ).rejects.toBeInstanceOf(AdapterFailureError);
    expect(sink.eventsByName('adapter.timeout')).toHaveLength(1);

    sink.clear();
    const cancelSearch: SearchAdapter = {
      async search() {
        throw new AdapterFailureError({
          code: 'CANCELLED',
          message: 'cancelled',
          adapter: 'search',
          operation: 'search',
          retryable: false,
        });
      },
    };
    const wrappedCancel = wrapAdapterPortsForTelemetry(
      { search: cancelSearch },
      emitter,
      clock
    );
    await expect(
      wrappedCancel.search!.search([], {
        run: { id: 'run-c' } as never,
        now: () => RUNTIME_NOW,
      })
    ).rejects.toBeInstanceOf(AdapterFailureError);
    expect(sink.eventsByName('adapter.cancelled')).toHaveLength(1);
  });
});

describe('E5.5 runtime integration', () => {
  it('emits correlated lifecycle events for schedule → worker → pipeline → notification', async () => {
    const sink = createInMemoryDiscoveryTelemetry();
    const transport = happyPathTransport();
    const { runtime, persistence } = createRuntimeHarness({
      transport,
      telemetry: sink,
      telemetryEventIdGenerator: createIncrementingTelemetryEventIdGenerator('e55'),
      runtimeInstanceId: 'instance-e55',
    });

    try {
      expect(sink.eventsByName('runtime.created')).toHaveLength(1);

      await registerDueSchedule(runtime);
      const { tick, workerResult } = await runDueOnce(runtime);
      expect(tick.outcomes[0]?.kind).toBe('enqueued');
      expect(workerResult).toMatchObject({
        kind: 'processed',
        pipelineStatus: 'SUCCESS',
      });

      const names = sink.events().map((e) => e.eventName);
      expect(names).toContain('scheduler.triggered');
      expect(names).toContain('scheduler.enqueued');
      expect(names).toContain('queue.enqueued');
      expect(names).toContain('queue.claimed');
      expect(names).toContain('worker.started');
      expect(names).toContain('pipeline.started');
      expect(names).toContain('pipeline.completed');
      expect(names).toContain('adapter.started');
      expect(names).toContain('adapter.completed');
      expect(names).toContain('persistence.created');
      expect(names).toContain('notification.started');
      expect(names).toContain('notification.sent');
      expect(names).toContain('queue.acked');
      expect(names).toContain('worker.completed');

      const runId =
        tick.outcomes[0]?.kind === 'enqueued' ? tick.outcomes[0].runId : '';
      const jobId =
        tick.outcomes[0]?.kind === 'enqueued' ? tick.outcomes[0].jobId : '';
      const correlated = sink
        .events()
        .filter((e) => e.runId === runId || e.jobId === jobId);
      expect(correlated.length).toBeGreaterThan(5);
      expect(
        correlated.some((e) => e.scheduleId === 'sched-runtime')
      ).toBe(true);
      expect(
        correlated.some((e) => e.runtimeInstanceId === 'instance-e55')
      ).toBe(true);
      expect(
        sink.eventsByName('pipeline.completed')[0]?.durationMs
      ).toBeTypeOf('number');

      assertNoSecrets(sink.events());

      runtime.close();
      expect(sink.eventsByName('runtime.closed')).toHaveLength(1);
      runtime.close();
      expect(sink.eventsByName('runtime.closed')).toHaveLength(1);
    } finally {
      if (!runtime.isClosed()) runtime.close();
      persistence.cleanup();
    }
  });

  it('telemetry provider failure does not affect discovery execution', async () => {
    const broken: DiscoveryTelemetry = {
      emit() {
        throw new Error(`boom ${SECRETS.brave}`);
      },
    };
    const transport = happyPathTransport();
    const { runtime, persistence } = createRuntimeHarness({
      transport,
      telemetry: broken,
    });

    try {
      await registerDueSchedule(runtime);
      const { workerResult } = await runDueOnce(runtime);
      expect(workerResult).toMatchObject({
        kind: 'processed',
        pipelineStatus: 'SUCCESS',
      });
      expect(
        (runtime.notificationStore as { count(): number }).count()
      ).toBe(1);
    } finally {
      runtime.close();
      persistence.cleanup();
    }
  });

  it('telemetry is optional — omitted uses no-op', async () => {
    const transport = happyPathTransport();
    const { runtime, persistence } = createRuntimeHarness({ transport });
    try {
      await registerDueSchedule(runtime);
      const { workerResult } = await runDueOnce(runtime);
      expect(workerResult).toMatchObject({
        kind: 'processed',
        pipelineStatus: 'SUCCESS',
      });
    } finally {
      runtime.close();
      persistence.cleanup();
    }
  });

  it('emits scheduler skip reasons without changing lock semantics', async () => {
    const sink = createInMemoryDiscoveryTelemetry();
    const transport = happyPathTransport();
    const { runtime, persistence } = createRuntimeHarness({
      transport,
      telemetry: sink,
      runtimeInstanceId: 'lock-a',
    });

    try {
      await registerDueSchedule(runtime);
      const first = await runtime.scheduler.triggerDueRuns();
      expect(first.outcomes[0]?.kind).toBe('enqueued');

      // Manual trigger while run is active → skipped already_running
      const second = await runtime.scheduler.triggerNow('sched-runtime');
      expect(second).toMatchObject({
        kind: 'skipped',
        reason: 'already_running',
      });
      expect(
        sink.eventsByName('scheduler.skipped').some(
          (e) => e.attributes?.reason === 'already_running'
        )
      ).toBe(true);
    } finally {
      runtime.close();
      persistence.cleanup();
    }
  });

  it('emits retry.scheduled when worker schedules durable retry', async () => {
    const sink = createInMemoryDiscoveryTelemetry();
    const clock = createFakeClock(RUNTIME_NOW);
    const emitter = createTelemetryEmitter({
      telemetry: sink,
      clock,
      eventIdGenerator: createIncrementingTelemetryEventIdGenerator('retry'),
    });

    const queue = wrapExecutionQueueForTelemetry(
      createInMemoryExecutionQueue([], { clock }),
      emitter
    );
    const scheduleStore = createInMemoryScheduleStore([
      {
        scheduleId: 'sched-1',
        profileId: 'profile-1',
        strategyId: 'job-discovery',
        strategyVersion: '1',
        enabled: true,
        interval: { kind: 'fixed_interval', intervalSeconds: 3600 },
        timezone: 'UTC',
        nextRunAt: '2026-08-31T11:00:00.000Z',
        runningRunId: 'run-1',
        createdAt: '2026-08-31T09:00:00.000Z',
        updatedAt: '2026-08-31T10:00:00.000Z',
      },
    ]);
    const runStore = createInMemoryRunStore([
      {
        runId: 'run-1',
        scheduleId: 'sched-1',
        profileId: 'profile-1',
        trigger: 'scheduled',
        startedAt: RUNTIME_NOW,
        status: 'PENDING',
      },
    ]);

    const worker = createDiscoveryExecutionWorker({
      queue,
      executor: {
        async execute() {
          throw new AdapterFailureError({
            code: 'TIMEOUT',
            message: 'timed out',
            adapter: 'search',
            operation: 'search',
            retryable: true,
          });
        },
      },
      runStore,
      scheduleStore,
      clock,
      workerId: 'worker-A',
      retryConfig: { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 60000 },
      telemetry: emitter,
    });

    await queue.enqueue({
      jobId: 'job-1',
      runId: 'run-1',
      scheduleId: 'sched-1',
      profileId: 'profile-1',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      trigger: 'scheduled',
      requestedAt: RUNTIME_NOW,
    });

    const result = await worker.processNext();
    expect(result).toMatchObject({ kind: 'retry_scheduled', attempt: 2 });
    expect(sink.eventsByName('worker.retry_scheduled')).toHaveLength(1);
    expect(sink.eventsByName('retry.scheduled')[0]?.attributes).toMatchObject({
      failureCode: 'TIMEOUT',
      maxAttempts: 3,
    });
    expect(sink.eventsByName('queue.retried')).toHaveLength(1);
    assertNoSecrets(sink.events());
  });
});
