import { describe, expect, it, vi } from 'vitest';
import {
  createDiscoveryHttpHandler,
  createDiscoveryService,
  createFakeClock,
  createInMemoryProfileStore,
  createInMemoryRateLimiter,
  DISCOVERY_REQUEST_ID_HEADER,
  type DiscoveryHttpHandler,
  type DiscoveryHttpRequest,
  type DiscoveryService,
  type DiscoveryServiceLifecycle,
  type DiscoveryRuntimeHealth,
  type TriggerRunOutcome,
  type DiscoveryScheduleRecord,
  type ScheduledRunRecord,
  type WorkerProcessResult,
} from '../index.js';
import {
  happyPathTransport,
  jobProfile,
  RUNTIME_NOW,
  SECRETS,
  smokeRegistry,
  tempPersistencePaths,
} from '../runtime/runtime-test-helpers.js';

const SECRETS_LIST = [
  SECRETS.brave,
  SECRETS.openai,
  SECRETS.resend,
  SECRETS.telegram,
];

function req(
  method: string,
  path: string,
  opts: {
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
): DiscoveryHttpRequest {
  const headers: Record<string, string> = { ...opts.headers };
  let bodyText: string | undefined;
  if (opts.body !== undefined) {
    bodyText = JSON.stringify(opts.body);
    headers['content-type'] = headers['content-type'] ?? 'application/json';
  }
  return { method, path, headers, bodyText };
}

async function parse(handler: DiscoveryHttpHandler, request: DiscoveryHttpRequest) {
  const res = await handler.handle(request);
  return {
    ...res,
    json: res.bodyText ? (JSON.parse(res.bodyText) as unknown) : null,
  };
}

function healthySnapshot(): DiscoveryRuntimeHealth {
  return {
    status: 'HEALTHY',
    checkedAt: RUNTIME_NOW,
    runtimeInstanceId: 'http-rt',
    runtimeOpen: true,
    canAcceptWork: true,
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
    observability: { status: 'AVAILABLE' },
    warnings: [],
  };
}

function createFakeService(
  overrides: Partial<DiscoveryService> & {
    life?: DiscoveryServiceLifecycle;
  } = {}
): DiscoveryService {
  let life: DiscoveryServiceLifecycle = overrides.life ?? 'ready';
  const schedules = new Map<string, DiscoveryScheduleRecord>();
  const runs = new Map<string, ScheduledRunRecord>();

  const base: DiscoveryService = {
    lifecycle: () => life,
    async start() {
      life = 'ready';
    },
    async stop() {
      life = 'stopped';
    },
    async runNow({ scheduleId }) {
      const s = schedules.get(scheduleId);
      if (!s) return { kind: 'skipped', scheduleId, reason: 'not_found' };
      if (s.runningRunId) {
        return { kind: 'skipped', scheduleId, reason: 'already_running' };
      }
      const outcome: TriggerRunOutcome = {
        kind: 'enqueued',
        scheduleId,
        runId: 'run-http-1',
        jobId: 'job-http-1',
        trigger: 'manual',
      };
      s.runningRunId = outcome.runId;
      runs.set(outcome.runId, {
        runId: outcome.runId,
        scheduleId,
        profileId: s.profileId,
        trigger: 'manual',
        startedAt: RUNTIME_NOW,
        status: 'PENDING',
      });
      return outcome;
    },
    async getRun(runId) {
      return runs.get(runId) ?? null;
    },
    async getHealth() {
      if (life === 'stopped') {
        return { ...healthySnapshot(), status: 'UNAVAILABLE', runtimeOpen: false };
      }
      return healthySnapshot();
    },
    async registerSchedule(input) {
      const record: DiscoveryScheduleRecord = {
        scheduleId: input.scheduleId,
        profileId: input.profileId,
        strategyId: input.strategyId,
        strategyVersion: input.strategyVersion,
        enabled: input.enabled ?? true,
        interval: {
          kind: 'fixed_interval',
          intervalSeconds: input.intervalSeconds,
        },
        timezone: input.timezone ?? 'UTC',
        nextRunAt: input.nextRunAt ?? RUNTIME_NOW,
        createdAt: RUNTIME_NOW,
        updatedAt: RUNTIME_NOW,
        runningRunId: null,
      };
      schedules.set(record.scheduleId, record);
      return structuredClone(record);
    },
    async listSchedules() {
      return [...schedules.values()].map((s) => structuredClone(s));
    },
    async getSchedule(id) {
      const s = schedules.get(id);
      return s ? structuredClone(s) : null;
    },
    async enableSchedule(id) {
      const s = schedules.get(id);
      if (!s) return null;
      s.enabled = true;
      return structuredClone(s);
    },
    async disableSchedule(id) {
      const s = schedules.get(id);
      if (!s) return null;
      s.enabled = false;
      return structuredClone(s);
    },
    redactedConfig() {
      return {
        production: {
          brave: { apiKey: '[redacted]' },
          openai: { apiKey: '[redacted]', model: 'gpt-4o-mini' },
        },
        persistence: {
          resultsDatabasePath: '/tmp/r.sqlite',
          schedulerDatabasePath: '/tmp/s.sqlite',
          notificationsDatabasePath: '/tmp/n.sqlite',
          queueDatabasePath: '/tmp/q.sqlite',
          profilesDatabasePath: '/tmp/p.sqlite',
        },
        providers: {
          search: 'brave',
          ai: 'openai',
          email: true,
          telegram: false,
        },
        application: {
          hasNotificationTargetResolver: true,
          hasEnginePolicy: false,
          hasCustomRunIdGenerator: false,
          hasCustomJobIdGenerator: false,
        },
        ownership: {
          runtimeOwnsSqlite: true,
          callerOwnsInjectedTransport: true,
          callerOwnsInjectedRateLimiter: true,
          callerOwnsInjectedRawContentStore: false,
          callerOwnsInjectedQueue: false,
          callerOwnsInjectedSchedulerLock: false,
        },
      } as ReturnType<DiscoveryService['redactedConfig']>;
    },
    async processNext(): Promise<WorkerProcessResult> {
      return { kind: 'empty' };
    },
    async triggerDueRuns() {
      return { outcomes: [] };
    },
    ...overrides,
  };
  return base;
}

describe('E6.2 HTTP admin API — health/status', () => {
  it('GET /health returns 200 when healthy', async () => {
    const handler = createDiscoveryHttpHandler(createFakeService(), {
      allowUnauthenticated: true,
      secrets: SECRETS_LIST,
    });
    const res = await parse(handler, req('GET', '/health'));
    expect(res.status).toBe(200);
    expect((res.json as { status: string }).status).toBe('HEALTHY');
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('preserves degraded and unavailable health', async () => {
    const degraded = createFakeService({
      async getHealth() {
        return { ...healthySnapshot(), status: 'DEGRADED' };
      },
    });
    const unavailable = createFakeService({
      async getHealth() {
        return {
          ...healthySnapshot(),
          status: 'UNAVAILABLE',
          runtimeOpen: false,
        };
      },
    });
    expect(
      (await parse(createDiscoveryHttpHandler(degraded, { allowUnauthenticated: true }), req('GET', '/health')))
        .json
    ).toMatchObject({ status: 'DEGRADED' });
    expect(
      (
        await parse(
          createDiscoveryHttpHandler(unavailable, { allowUnauthenticated: true }),
          req('GET', '/health')
        )
      ).json
    ).toMatchObject({ status: 'UNAVAILABLE' });
  });

  it('GET /status never exposes secrets', async () => {
    const handler = createDiscoveryHttpHandler(createFakeService(), {
      allowUnauthenticated: true,
      secrets: SECRETS_LIST,
    });
    const res = await parse(handler, req('GET', '/status'));
    expect(res.status).toBe(200);
    const serialized = JSON.stringify(res.json);
    for (const secret of SECRETS_LIST) {
      expect(serialized).not.toContain(secret);
    }
    expect(serialized).not.toContain(SECRETS.brave);
    expect((res.json as { lifecycle: string }).lifecycle).toBe('ready');
    expect(
      (res.json as { providers: { search: string } }).providers.search
    ).toBe('brave');
  });
});

describe('E6.2 HTTP admin API — schedules', () => {
  it('lists, registers, enables, disables schedules', async () => {
    const service = createFakeService();
    const handler = createDiscoveryHttpHandler(service, {
      allowUnauthenticated: true,
      secrets: SECRETS_LIST,
    });

    let res = await parse(
      handler,
      req('POST', '/schedules', {
        body: {
          scheduleId: 'sched-1',
          profileId: 'profile-job',
          strategyId: 'job-discovery',
          strategyVersion: '1',
          intervalSeconds: 3600,
        },
      })
    );
    expect(res.status).toBe(201);

    res = await parse(handler, req('GET', '/schedules'));
    expect(res.status).toBe(200);
    expect(
      (res.json as { schedules: unknown[] }).schedules
    ).toHaveLength(1);

    res = await parse(handler, req('POST', '/schedules/sched-1/disable'));
    expect(res.status).toBe(200);
    expect(
      (res.json as { schedule: { enabled: boolean } }).schedule.enabled
    ).toBe(false);

    res = await parse(handler, req('POST', '/schedules/sched-1/enable'));
    expect(res.status).toBe(200);
    expect(
      (res.json as { schedule: { enabled: boolean } }).schedule.enabled
    ).toBe(true);
  });

  it('invalid schedule request → 400', async () => {
    const handler = createDiscoveryHttpHandler(createFakeService(), { allowUnauthenticated: true });
    const res = await parse(
      handler,
      req('POST', '/schedules', {
        body: { scheduleId: 'x', intervalSeconds: -1 },
      })
    );
    expect(res.status).toBe(400);
    expect(
      (res.json as { error: { code: string; requestId: string } }).error.code
    ).toBe('INVALID_REQUEST');
    expect(
      (res.json as { error: { requestId: string } }).error.requestId
    ).toBeTruthy();
  });

  it('missing schedule enable → 404', async () => {
    const handler = createDiscoveryHttpHandler(createFakeService(), { allowUnauthenticated: true });
    const res = await parse(
      handler,
      req('POST', '/schedules/missing/enable')
    );
    expect(res.status).toBe(404);
  });

  it('malformed JSON → 400', async () => {
    const handler = createDiscoveryHttpHandler(createFakeService(), { allowUnauthenticated: true });
    const res = await parse(handler, {
      method: 'POST',
      path: '/schedules',
      headers: { 'content-type': 'application/json' },
      bodyText: '{not-json',
    });
    expect(res.status).toBe(400);
  });
});

describe('E6.2 HTTP admin API — manual run', () => {
  it('POST run → 202 with enqueue identity and does not process worker', async () => {
    const processNext = vi.fn(async () => ({ kind: 'empty' as const }));
    const service = createFakeService({ processNext });
    await service.registerSchedule({
      scheduleId: 'sched-run',
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      intervalSeconds: 3600,
    });
    const handler = createDiscoveryHttpHandler(service, { allowUnauthenticated: true });

    const res = await parse(
      handler,
      req('POST', '/schedules/sched-run/run')
    );
    expect(res.status).toBe(202);
    expect(res.json).toMatchObject({
      kind: 'enqueued',
      runId: 'run-http-1',
      jobId: 'job-http-1',
    });
    expect(processNext).not.toHaveBeenCalled();

    const run = await parse(handler, req('GET', '/runs/run-http-1'));
    expect(run.status).toBe(200);
    expect(
      (run.json as { run: { status: string } }).run.status
    ).toBe('PENDING');
  });

  it('already_running → 409', async () => {
    const service = createFakeService();
    await service.registerSchedule({
      scheduleId: 'sched-dup',
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      intervalSeconds: 3600,
    });
    const handler = createDiscoveryHttpHandler(service, { allowUnauthenticated: true });
    await parse(handler, req('POST', '/schedules/sched-dup/run'));
    const res = await parse(
      handler,
      req('POST', '/schedules/sched-dup/run')
    );
    expect(res.status).toBe(409);
    expect(
      (res.json as { error: { code: string } }).error.code
    ).toBe('CONFLICT');
  });

  it('missing run → 404', async () => {
    const handler = createDiscoveryHttpHandler(createFakeService(), { allowUnauthenticated: true });
    const res = await parse(handler, req('GET', '/runs/missing'));
    expect(res.status).toBe(404);
  });
});

describe('E6.2 HTTP admin API — lifecycle / errors / security', () => {
  it('mutations when not started → 503', async () => {
    const { DiscoveryServiceNotStartedError } = await import('../index.js');
    const service = createFakeService({
      life: 'created',
      async runNow() {
        throw new DiscoveryServiceNotStartedError();
      },
      async registerSchedule() {
        throw new DiscoveryServiceNotStartedError();
      },
    });
    const handler = createDiscoveryHttpHandler(service, { allowUnauthenticated: true });
    const res = await parse(
      handler,
      req('POST', '/schedules', {
        body: {
          scheduleId: 's',
          profileId: 'p',
          strategyId: 'job-discovery',
          strategyVersion: '1',
          intervalSeconds: 60,
        },
      })
    );
    expect(res.status).toBe(503);
    expect(
      (res.json as { error: { code: string } }).error.code
    ).toBe('SERVICE_NOT_STARTED');
  });

  it('stopped service mutations → 503', async () => {
    const { DiscoveryServiceStoppedError } = await import('../index.js');
    const service = createFakeService({
      life: 'stopped',
      async runNow() {
        throw new DiscoveryServiceStoppedError();
      },
    });
    const handler = createDiscoveryHttpHandler(service, { allowUnauthenticated: true });
    await service.registerSchedule({
      scheduleId: 'sched-x',
      profileId: 'p',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      intervalSeconds: 60,
    });
    // override after register
    service.runNow = async () => {
      throw new DiscoveryServiceStoppedError();
    };
    const res = await parse(
      handler,
      req('POST', '/schedules/sched-x/run')
    );
    expect(res.status).toBe(503);
  });

  it('unexpected error → 500 with redaction and request id', async () => {
    const service = createFakeService({
      async getHealth() {
        throw new Error(`boom ${SECRETS.brave} ${SECRETS.openai}`);
      },
    });
    const handler = createDiscoveryHttpHandler(service, {
      allowUnauthenticated: true,
      secrets: SECRETS_LIST,
    });
    const res = await parse(
      handler,
      req('GET', '/health', {
        headers: { [DISCOVERY_REQUEST_ID_HEADER]: 'req-fixed-1' },
      })
    );
    expect(res.status).toBe(500);
    expect(res.headers['x-request-id']).toBe('req-fixed-1');
    const body = JSON.stringify(res.json);
    expect(body).not.toContain(SECRETS.brave);
    expect(body).not.toContain(SECRETS.openai);
    expect(body).toContain('[redacted]');
  });

  it('does not reflect arbitrary body fields into errors', async () => {
    const handler = createDiscoveryHttpHandler(createFakeService(), { allowUnauthenticated: true });
    const res = await parse(
      handler,
      req('POST', '/schedules', {
        body: {
          scheduleId: 'ok',
          profileId: 'p',
          strategyId: 'job-discovery',
          strategyVersion: '1',
          intervalSeconds: 60,
          nested: { apiKey: SECRETS.brave },
        },
      })
    );
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.json)).not.toContain(SECRETS.brave);
  });
});

describe('E6.2 HTTP ↔ DiscoveryService integration', () => {
  it('HTTP runNow enqueues via service before pipeline execution', async () => {
    const persistence = tempPersistencePaths();
    const transport = happyPathTransport();
    const clock = createFakeClock(RUNTIME_NOW);
    const service = createDiscoveryService({
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
      runtimeInstanceId: 'http-int',
      resolveNotificationTarget: () => ({
        channel: 'EMAIL',
        recipient: { userId: 'user-1', address: 'user@example.com' },
      }),
    });

    const handler = createDiscoveryHttpHandler(service, {
      allowUnauthenticated: true,
      secrets: SECRETS_LIST,
    });

    try {
      await service.start();
      await parse(
        handler,
        req('POST', '/schedules', {
          body: {
            scheduleId: 'sched-http-int',
            profileId: 'profile-job',
            strategyId: 'job-discovery',
            strategyVersion: '1',
            intervalSeconds: 3600,
            nextRunAt: '2026-09-01T00:00:00.000Z',
          },
        })
      );

      const runRes = await parse(
        handler,
        req('POST', '/schedules/sched-http-int/run')
      );
      expect(runRes.status).toBe(202);
      const enqueued = runRes.json as {
        runId: string;
        jobId: string;
      };
      expect(enqueued.runId).toBeTruthy();
      expect(enqueued.jobId).toBeTruthy();

      const run = await service.getRun(enqueued.runId);
      expect(run?.status).toBe('PENDING');

      // Explicit process-next is separate from run endpoint
      const processed = await service.processNext();
      expect(processed).toMatchObject({
        kind: 'processed',
        pipelineStatus: 'SUCCESS',
      });
    } finally {
      await service.stop();
      persistence.cleanup();
    }
  });
});
