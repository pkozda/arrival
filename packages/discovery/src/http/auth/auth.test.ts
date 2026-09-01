import { describe, expect, it, vi } from 'vitest';
import {
  ALL_DISCOVERY_ADMIN_PERMISSIONS,
  createDiscoveryHttpHandler,
  createPermissionAuthorizer,
  createStaticTokenAuthenticator,
  loadDiscoveryAdminAuthConfig,
  redactDiscoveryAdminAuthConfig,
  resolveAdminRoutePolicy,
  validateDiscoveryAdminAuthConfig,
  createAuthenticatorFromAdminAuthConfig,
  type DiscoveryHttpHandler,
  type DiscoveryHttpRequest,
  type DiscoveryService,
  type DiscoveryRuntimeHealth,
  type DiscoveryScheduleRecord,
  type ScheduledRunRecord,
  type TriggerRunOutcome,
  type WorkerProcessResult,
} from '../index.js';

const ADMIN_TOKEN = 'test-admin-token-32chars-minimum';
const READER_TOKEN = 'test-reader-token-32chars-minxx';
const SECRETS = [ADMIN_TOKEN, READER_TOKEN];

function req(
  method: string,
  path: string,
  opts: { body?: unknown; headers?: Record<string, string> } = {}
): DiscoveryHttpRequest {
  const headers: Record<string, string> = { ...opts.headers };
  let bodyText: string | undefined;
  if (opts.body !== undefined) {
    bodyText = JSON.stringify(opts.body);
    headers['content-type'] = 'application/json';
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

function healthy(): DiscoveryRuntimeHealth {
  return {
    status: 'HEALTHY',
    checkedAt: '2026-08-31T10:00:00.000Z',
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

function createSpyService(): DiscoveryService & {
  calls: string[];
} {
  const calls: string[] = [];
  const schedules = new Map<string, DiscoveryScheduleRecord>();
  const runs = new Map<string, ScheduledRunRecord>();

  return {
    calls,
    lifecycle: () => 'ready',
    async start() {},
    async stop() {},
    async runNow({ scheduleId }) {
      calls.push(`runNow:${scheduleId}`);
      const outcome: TriggerRunOutcome = {
        kind: 'enqueued',
        scheduleId,
        runId: 'run-1',
        jobId: 'job-1',
        trigger: 'manual',
      };
      runs.set('run-1', {
        runId: 'run-1',
        scheduleId,
        profileId: 'p',
        trigger: 'manual',
        startedAt: '2026-08-31T10:00:00.000Z',
        status: 'PENDING',
      });
      return outcome;
    },
    async getRun(runId) {
      calls.push(`getRun:${runId}`);
      return runs.get(runId) ?? null;
    },
    async getHealth() {
      calls.push('getHealth');
      return healthy();
    },
    async registerSchedule(input) {
      calls.push('registerSchedule');
      const record: DiscoveryScheduleRecord = {
        scheduleId: input.scheduleId,
        profileId: input.profileId,
        strategyId: input.strategyId,
        strategyVersion: input.strategyVersion,
        enabled: true,
        interval: {
          kind: 'fixed_interval',
          intervalSeconds: input.intervalSeconds,
        },
        timezone: 'UTC',
        nextRunAt: '2026-08-31T10:00:00.000Z',
        createdAt: '2026-08-31T10:00:00.000Z',
        updatedAt: '2026-08-31T10:00:00.000Z',
        runningRunId: null,
      };
      schedules.set(record.scheduleId, record);
      return record;
    },
    async listSchedules() {
      calls.push('listSchedules');
      return [...schedules.values()];
    },
    async getSchedule(id) {
      return schedules.get(id) ?? null;
    },
    async enableSchedule(id) {
      calls.push(`enable:${id}`);
      const s = schedules.get(id);
      if (!s) return null;
      s.enabled = true;
      return s;
    },
    async disableSchedule(id) {
      calls.push(`disable:${id}`);
      const s = schedules.get(id);
      if (!s) return null;
      s.enabled = false;
      return s;
    },
    redactedConfig: () => null,
    async processNext(): Promise<WorkerProcessResult> {
      calls.push('processNext');
      return { kind: 'empty' };
    },
    async triggerDueRuns() {
      return { outcomes: [] };
    },
  };
}

function authHandler(service: DiscoveryService) {
  return createDiscoveryHttpHandler(service, {
    secrets: SECRETS,
    authenticator: createStaticTokenAuthenticator({
      tokens: [
        {
          token: ADMIN_TOKEN,
          principalId: 'admin',
          permissions: ALL_DISCOVERY_ADMIN_PERMISSIONS,
        },
        {
          token: READER_TOKEN,
          principalId: 'reader',
          permissions: ['discovery:read'],
        },
      ],
    }),
    authorizer: createPermissionAuthorizer(),
  });
}

describe('E6.3 authn/authz', () => {
  it('GET /health remains public and does not invoke authenticator', async () => {
    const authenticate = vi.fn(() => ({
      ok: false as const,
      reason: 'unauthenticated' as const,
    }));
    const service = createSpyService();
    const handler = createDiscoveryHttpHandler(service, {
      authenticator: { authenticate },
      secrets: SECRETS,
    });
    const res = await parse(handler, req('GET', '/health'));
    expect(res.status).toBe(200);
    expect(authenticate).not.toHaveBeenCalled();
    expect(service.calls).toContain('getHealth');
  });

  it('protected endpoint without Authorization → 401 + WWW-Authenticate', async () => {
    const service = createSpyService();
    const handler = authHandler(service);
    const res = await parse(handler, req('GET', '/status'));
    expect(res.status).toBe(401);
    expect(res.headers['www-authenticate']).toBe('Bearer');
    expect(
      (res.json as { error: { code: string; requestId: string } }).error.code
    ).toBe('UNAUTHENTICATED');
    expect(
      (res.json as { error: { requestId: string } }).error.requestId
    ).toBeTruthy();
    expect(service.calls).not.toContain('getHealth');
  });

  it('malformed Authorization and invalid token → 401', async () => {
    const handler = authHandler(createSpyService());
    for (const authorization of [
      'Basic abc',
      'Bearer',
      'Bearer ',
      `Bearer wrong-token-value-xxxxxxxx`,
    ]) {
      const res = await parse(
        handler,
        req('GET', '/schedules', { headers: { authorization } })
      );
      expect(res.status).toBe(401);
      expect(JSON.stringify(res.json)).not.toContain(ADMIN_TOKEN);
    }
  });

  it('valid read token → 200 for read endpoints', async () => {
    const service = createSpyService();
    const handler = authHandler(service);
    const res = await parse(
      handler,
      req('GET', '/status', {
        headers: { authorization: `Bearer ${READER_TOKEN}` },
      })
    );
    expect(res.status).toBe(200);
  });

  it('reader cannot mutate → 403 and service not called', async () => {
    const service = createSpyService();
    const handler = authHandler(service);
    const res = await parse(
      handler,
      req('POST', '/schedules', {
        headers: { authorization: `Bearer ${READER_TOKEN}` },
        body: {
          scheduleId: 's1',
          profileId: 'p',
          strategyId: 'job-discovery',
          strategyVersion: '1',
          intervalSeconds: 60,
        },
      })
    );
    expect(res.status).toBe(403);
    expect(
      (res.json as { error: { code: string; requestId: string } }).error
    ).toMatchObject({ code: 'FORBIDDEN' });
    expect(
      (res.json as { error: { requestId: string } }).error.requestId
    ).toBeTruthy();
    expect(service.calls).not.toContain('registerSchedule');
  });

  it('admin token can run and process-next', async () => {
    const service = createSpyService();
    await service.registerSchedule({
      scheduleId: 'sched-1',
      profileId: 'p',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      intervalSeconds: 60,
    });
    service.calls.length = 0;
    const handler = authHandler(service);

    const run = await parse(
      handler,
      req('POST', '/schedules/sched-1/run', {
        headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      })
    );
    expect(run.status).toBe(202);
    expect(service.calls).toContain('runNow:sched-1');

    const proc = await parse(
      handler,
      req('POST', '/worker/process-next', {
        headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      })
    );
    expect(proc.status).toBe(200);
    expect(service.calls).toContain('processNext');
  });

  it('token never appears in errors/responses', async () => {
    const handler = authHandler(createSpyService());
    const res = await parse(
      handler,
      req('GET', '/status', {
        headers: {
          authorization: `Bearer ${ADMIN_TOKEN}`,
          'x-request-id': 'req-auth-1',
        },
      })
    );
    expect(res.status).toBe(200);
    expect(JSON.stringify(res)).not.toContain(ADMIN_TOKEN);
    expect(res.headers['x-request-id']).toBe('req-auth-1');
  });

  it('permission matrix covers every protected endpoint', () => {
    const cases: Array<[string, string, string]> = [
      ['GET', '/status', 'discovery:read'],
      ['GET', '/schedules', 'discovery:read'],
      ['GET', '/runs/r1', 'discovery:read'],
      ['POST', '/schedules', 'discovery:schedule:write'],
      ['POST', '/schedules/s1/enable', 'discovery:schedule:write'],
      ['POST', '/schedules/s1/disable', 'discovery:schedule:write'],
      ['POST', '/schedules/s1/run', 'discovery:run'],
      ['POST', '/worker/process-next', 'discovery:worker:process'],
    ];
    for (const [method, path, permission] of cases) {
      const policy = resolveAdminRoutePolicy(method, path);
      expect(policy).toEqual({ kind: 'protected', permission });
    }
    expect(resolveAdminRoutePolicy('GET', '/health')).toEqual({
      kind: 'public',
    });
  });

  it('authenticator throw maps to 401 without leaking secrets', async () => {
    const handler = createDiscoveryHttpHandler(createSpyService(), {
      secrets: SECRETS,
      authenticator: {
        authenticate() {
          throw new Error(`auth provider boom ${ADMIN_TOKEN}`);
        },
      },
    });
    const res = await parse(handler, req('GET', '/status'));
    expect(res.status).toBe(401);
    expect(JSON.stringify(res.json)).not.toContain(ADMIN_TOKEN);
  });

  it('programmatic DiscoveryService remains usable without HTTP auth', async () => {
    const service = createSpyService();
    await service.registerSchedule({
      scheduleId: 'local',
      profileId: 'p',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      intervalSeconds: 60,
    });
    expect(await service.listSchedules()).toHaveLength(1);
  });

  it('allowUnauthenticated is explicit open mode', async () => {
    const service = createSpyService();
    const handler = createDiscoveryHttpHandler(service, {
      allowUnauthenticated: true,
    });
    const res = await parse(handler, req('GET', '/status'));
    expect(res.status).toBe(200);
  });

  it('requires authenticator or allowUnauthenticated', () => {
    expect(() =>
      createDiscoveryHttpHandler(createSpyService(), {})
    ).toThrow(/authenticator or allowUnauthenticated/);
  });
});

describe('E6.3 admin auth config', () => {
  it('loads bearer token from env map and redacts it', () => {
    const config = loadDiscoveryAdminAuthConfig({
      DISCOVERY_ADMIN_TOKEN: ADMIN_TOKEN,
    });
    expect(config).toEqual({ mode: 'bearer', adminToken: ADMIN_TOKEN });
    expect(redactDiscoveryAdminAuthConfig(config)).toEqual({
      mode: 'bearer',
      adminTokenConfigured: true,
    });
    const auth = createAuthenticatorFromAdminAuthConfig(config);
    expect(auth).not.toBeNull();
    expect(
      auth!.authenticate({ authorizationHeader: `Bearer ${ADMIN_TOKEN}` })
    ).toMatchObject({ ok: true });
  });

  it('supports explicit unauthenticated mode', () => {
    const result = validateDiscoveryAdminAuthConfig({
      DISCOVERY_ADMIN_AUTH_MODE: 'unauthenticated',
    });
    expect(result).toEqual({
      ok: true,
      config: { mode: 'unauthenticated' },
    });
    expect(
      createAuthenticatorFromAdminAuthConfig(result.ok ? result.config : { mode: 'unauthenticated' })
    ).toBeNull();
  });

  it('rejects missing token by default', () => {
    const result = validateDiscoveryAdminAuthConfig({});
    expect(result.ok).toBe(false);
  });
});
