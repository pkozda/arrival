import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createDefaultDiscoveryRegistry,
  createDiscoveryService,
  createDiscoveryUserHttpHandler,
  createDiscoveryUserService,
  createFakeClock,
  createInMemoryProfileStore,
  createInMemoryRateLimiter,
  createInMemoryResultStore,
  createInMemoryRunStore,
  createResultStateWriter,
  createSqliteProfilePersistence,
  createSqliteResultPersistence,
  createSqliteSchedulerPersistence,
  createStaticUserTokenRegistryAuthenticator,
  emptyCriteria,
  happyPathTransport,
  resultIdentityKey,
  smokeRegistry,
  type DiscoveryHttpHandler,
  type DiscoveryHttpRequest,
  type DiscoveryProfile,
  type DiscoveryResult,
  type ScheduledRunRecord,
} from '../index.js';

const USER_A = 'user-a';
const USER_B = 'user-b';
const TOKEN_A = 'token-user-a';
const TOKEN_B = 'token-user-b';
const NOW = '2026-09-01T10:00:00.000Z';

function jobProfile(overrides: Partial<DiscoveryProfile> = {}): DiscoveryProfile {
  return {
    id: 'profile-job',
    userId: USER_A,
    name: 'Jobs',
    strategyId: 'job-discovery',
    strategyVersion: '1',
    criteria: {
      ...emptyCriteria(),
      required: [{ key: 'country', value: 'DE' }],
    },
    schedule: { cadence: 'manual' },
    notification: { emailEnabled: true, skipEmptyDigest: true },
    enabled: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function sampleResult(overrides: Partial<DiscoveryResult> = {}): DiscoveryResult {
  const identity = {
    externalIds: { url: 'https://employer.example/jobs/1' },
    canonicalUrl: 'https://employer.example/jobs/1',
    fingerprintMaterial: { title: 'Frontend Engineer', company: 'Acme' },
  };
  const fields = ['title', 'company'] as const;
  return {
    id: `result:profile-job:${resultIdentityKey(identity, fields)}`,
    profileId: 'profile-job',
    strategyId: 'job-discovery',
    strategyVersion: '1',
    identity,
    canonicalPresentation: {
      title: 'Frontend Engineer',
      summary: 'Great role',
      primaryUrl: 'https://employer.example/jobs/1',
    },
    source: { trust: 'AGGREGATOR', url: 'https://employer.example/jobs/1' },
    verification: {
      status: 'PASS',
      sourceTrust: 'OFFICIAL',
      freshness: 'CURRENT',
      checks: [
        { id: 'official_source', outcome: 'TRUE', required: true, evidenceIds: ['ev-1'] },
      ],
      evidenceIds: ['ev-1'],
      verifiedAt: NOW,
    },
    evidence: [
      {
        id: 'ev-1',
        type: 'OFFICIAL_SOURCE',
        sourceUrl: 'https://employer.example/jobs/1',
        statement: 'We are hiring',
        capturedAt: NOW,
      },
    ],
    score: {
      matchScore: 0.9,
      confidenceScore: 0.85,
      breakdown: {
        dimensions: [
          { id: 'role', labelKey: 'discovery.score.role', value: 80, weight: 0.3 },
        ],
      },
      scoredAt: NOW,
      strategyVersion: '1',
    },
    lifecycle: 'ACTIVE',
    userState: 'NEW',
    firstSeenAt: NOW,
    lastVerifiedAt: NOW,
    lastChangedAt: NOW,
    materialFields: { salary: '60000' },
    ...overrides,
  };
}

function tempDb(prefix: string): { path: string; cleanup: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  return {
    path: path.join(dir, 'data.sqlite'),
    cleanup() {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    },
  };
}

function buildService(opts?: {
  profileStore?: ReturnType<typeof createInMemoryProfileStore>;
  resultStore?: ReturnType<typeof createInMemoryResultStore>;
  runStore?: ReturnType<typeof createInMemoryRunStore>;
}) {
  const profileStore = opts?.profileStore ?? createInMemoryProfileStore([jobProfile()]);
  const resultStore = opts?.resultStore ?? createInMemoryResultStore([sampleResult()]);
  const runStore =
    opts?.runStore ??
    createInMemoryRunStore([
      {
        runId: 'run-1',
        scheduleId: 'sched-1',
        profileId: 'profile-job',
        trigger: 'scheduled',
        startedAt: NOW,
        finishedAt: '2026-09-01T10:05:00.000Z',
        status: 'SUCCESS',
      } satisfies ScheduledRunRecord,
    ]);
  const resultStateWriter = createResultStateWriter({
    store: resultStore,
    writer: resultStore,
  });
  const service = createDiscoveryUserService({
    profileStore,
    resultStore,
    resultStateWriter,
    runStore,
    registry: createDefaultDiscoveryRegistry(),
    clock: createFakeClock(NOW),
  });
  return { service, profileStore, resultStore, runStore };
}

function httpReq(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {}
): DiscoveryHttpRequest {
  const headers: Record<string, string> = {};
  if (opts.token) {
    headers.authorization = `Bearer ${opts.token}`;
  }
  if (opts.body !== undefined) {
    headers['content-type'] = 'application/json';
  }
  return {
    method,
    path,
    headers,
    bodyText: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  };
}

async function parse(handler: DiscoveryHttpHandler, request: DiscoveryHttpRequest) {
  const res = await handler.handle(request);
  return {
    ...res,
    json: res.bodyText ? (JSON.parse(res.bodyText) as unknown) : null,
  };
}

describe('E9.1 DiscoveryUserService', () => {
  it('lists and gets owned profiles', async () => {
    const { service } = buildService();
    const profiles = await service.listProfiles(USER_A);
    expect(profiles).toHaveLength(1);
    expect(profiles[0]?.id).toBe('profile-job');
    const profile = await service.getProfile(USER_A, 'profile-job');
    expect(profile.enabled).toBe(true);
  });

  it('creates and updates a profile', async () => {
    const profileStore = createInMemoryProfileStore([]);
    const { service } = buildService({ profileStore });
    const created = await service.createProfile(USER_A, {
      id: 'profile-new',
      name: 'Giveaways',
      strategyId: 'giveaway-discovery',
      strategyVersion: '1',
      criteria: emptyCriteria(),
    });
    expect(created.userId).toBe(USER_A);
    const updated = await service.updateProfile(USER_A, 'profile-new', {
      name: 'Giveaways Updated',
    });
    expect(updated.name).toBe('Giveaways Updated');
  });

  it('enables and disables profile', async () => {
    const { service } = buildService();
    const disabled = await service.disableProfile(USER_A, 'profile-job');
    expect(disabled.enabled).toBe(false);
    const enabled = await service.enableProfile(USER_A, 'profile-job');
    expect(enabled.enabled).toBe(true);
  });

  it('lists and gets results with evidence and score', async () => {
    const { service } = buildService();
    const results = await service.listResults(USER_A, 'profile-job');
    expect(results).toHaveLength(1);
    expect(results[0]?.verification.status).toBe('PASS');
    expect(results[0]?.evidence).toHaveLength(1);
    expect(results[0]?.score.matchScore).toBe(0.9);
    expect(results[0]?.changeMetadata.inferredNovelty).toBe('NEW');

    const detail = await service.getResult(USER_A, 'profile-job', results[0]!.id);
    expect(detail.userState).toBe('NEW');
    expect(detail.lifecycle).toBe('ACTIVE');
  });

  it('updates userState using transition rules', async () => {
    const { service } = buildService();
    const result = sampleResult();
    const updated = await service.updateResultUserState(
      USER_A,
      'profile-job',
      result.id,
      'SEEN'
    );
    expect(updated.userState).toBe('SEEN');
    await expect(
      service.updateResultUserState(USER_A, 'profile-job', result.id, 'NEW')
    ).rejects.toThrow(/USER_CANNOT_SET_NEW/);
  });

  it('returns last run summary', async () => {
    const { service } = buildService();
    const summary = await service.getProfileRunSummary(USER_A, 'profile-job');
    expect(summary.lastRun?.runId).toBe('run-1');
    expect(summary.lastRun?.status).toBe('SUCCESS');
  });

  it('denies access to another user profile', async () => {
    const { service } = buildService();
    await expect(service.getProfile(USER_B, 'profile-job')).rejects.toThrow(/not found/i);
    await expect(service.listResults(USER_B, 'profile-job')).rejects.toThrow(/not found/i);
  });

  it('projects persisted changedFields through user API', async () => {
    const { service } = buildService({
      resultStore: createInMemoryResultStore([
        sampleResult({ changedFields: ['extracted.salary'] }),
      ]),
    });
    const results = await service.listResults(USER_A, 'profile-job');
    expect(results[0]?.changeMetadata.changedFields).toEqual(['extracted.salary']);
    const detail = await service.getResult(USER_A, 'profile-job', results[0]!.id);
    expect(detail.changeMetadata.changedFields).toEqual(['extracted.salary']);
  });

  it('rejects runProfileNow without discovery execution', async () => {
    const { service } = buildService();
    await expect(service.runProfileNow(USER_A, 'profile-job')).rejects.toThrow(
      /not available/i
    );
  });
});

describe('E9.1 DiscoveryUserHttpHandler', () => {
  function handlerFor(profileStore = createInMemoryProfileStore([jobProfile()])) {
    const resultStore = createInMemoryResultStore([
      sampleResult({ id: 'result:profile-job:simple' }),
    ]);
    const service = createDiscoveryUserService({
      profileStore,
      resultStore,
      resultStateWriter: createResultStateWriter({ store: resultStore, writer: resultStore }),
      runStore: createInMemoryRunStore(),
      registry: createDefaultDiscoveryRegistry(),
      clock: createFakeClock(NOW),
    });
    return createDiscoveryUserHttpHandler(service, {
      registry: createDefaultDiscoveryRegistry(),
      authenticator: createStaticUserTokenRegistryAuthenticator([
        { token: TOKEN_A, userId: USER_A },
        { token: TOKEN_B, userId: USER_B },
      ]),
    });
  }

  it('requires authentication', async () => {
    const handler = handlerFor();
    const res = await parse(handler, httpReq('GET', '/user/profiles'));
    expect(res.status).toBe(401);
  });

  it('profile CRUD via HTTP', async () => {
    const handler = handlerFor(createInMemoryProfileStore([]));
    let res = await parse(
      handler,
      httpReq('POST', '/user/profiles', {
        token: TOKEN_A,
        body: {
          id: 'profile-http',
          name: 'HTTP Jobs',
          strategyId: 'job-discovery',
          strategyVersion: '1',
          criteria: emptyCriteria(),
        },
      })
    );
    expect(res.status).toBe(201);

    res = await parse(handler, httpReq('GET', '/user/profiles', { token: TOKEN_A }));
    expect(res.status).toBe(200);
    expect((res.json as { profiles: unknown[] }).profiles).toHaveLength(1);

    res = await parse(
      handler,
      httpReq('POST', '/user/profiles/profile-http/disable', { token: TOKEN_A })
    );
    expect(res.status).toBe(200);
    expect((res.json as { profile: DiscoveryProfile }).profile.enabled).toBe(false);
  });

  it('lists results and patches user state', async () => {
    const handler = handlerFor();
    const list = await parse(
      handler,
      httpReq('GET', '/user/profiles/profile-job/results', { token: TOKEN_A })
    );
    expect(list.status).toBe(200);
    const results = (list.json as { results: DiscoveryResult[] }).results;
    expect(results[0]?.evidence.length).toBeGreaterThan(0);

    const resultId = results[0]!.id;
    const patch = await parse(
      handler,
      httpReq('PATCH', `/user/profiles/profile-job/results/${resultId}/user-state`, {
        token: TOKEN_A,
        body: { userState: 'OPENED' },
      })
    );
    expect(patch.status).toBe(200);
    expect((patch.json as { result: DiscoveryResult }).result.userState).toBe('OPENED');
  });

  it('user B cannot access user A profile', async () => {
    const handler = handlerFor();
    const res = await parse(
      handler,
      httpReq('GET', '/user/profiles/profile-job', { token: TOKEN_B })
    );
    expect(res.status).toBe(404);
  });

  it('user B cannot run profile for user A', async () => {
    const handler = handlerFor();
    const res = await parse(
      handler,
      httpReq('POST', '/user/profiles/profile-job/run-now', { token: TOKEN_B })
    );
    expect(res.status).toBe(404);
  });
});

describe('E10.4 notification preferences — user API', () => {
  it('updates emailEnabled, skipEmptyDigest, and both with partial merge', async () => {
    const profileStore = createInMemoryProfileStore([
      jobProfile({
        notification: { emailEnabled: true, skipEmptyDigest: true },
      }),
    ]);
    const { service } = buildService({ profileStore });

    const emailOff = await service.updateProfile(USER_A, 'profile-job', {
      notification: { emailEnabled: false },
    });
    expect(emailOff.notification).toEqual({
      emailEnabled: false,
      skipEmptyDigest: true,
    });

    const skipOff = await service.updateProfile(USER_A, 'profile-job', {
      notification: { skipEmptyDigest: false },
    });
    expect(skipOff.notification).toEqual({
      emailEnabled: false,
      skipEmptyDigest: false,
    });

    const both = await service.updateProfile(USER_A, 'profile-job', {
      notification: { emailEnabled: true, skipEmptyDigest: true },
    });
    expect(both.notification).toEqual({
      emailEnabled: true,
      skipEmptyDigest: true,
    });
  });

  it('rejects invalid notification payload', async () => {
    const { service } = buildService();
    await expect(
      service.updateProfile(USER_A, 'profile-job', {
        notification: { emailEnabled: 'yes' } as unknown as { emailEnabled: boolean },
      })
    ).rejects.toThrow(/emailEnabled must be boolean/i);
  });
});

describe('E9.1 SQLite persistence', () => {
  it('profiles and results survive reopen via user API', async () => {
    const profilesDb = tempDb('e91-prof-');
    const resultsDb = tempDb('e91-res-');
    const schedulerDb = tempDb('e91-sched-');

    const profiles1 = createSqliteProfilePersistence({ databasePath: profilesDb.path });
    const results1 = createSqliteResultPersistence({ databasePath: resultsDb.path });
    const scheduler1 = createSqliteSchedulerPersistence({ databasePath: schedulerDb.path });

    const service1 = createDiscoveryUserService({
      profileStore: profiles1,
      resultStore: results1,
      resultStateWriter: createResultStateWriter({ store: results1, writer: results1 }),
      runStore: scheduler1.runStore,
      registry: createDefaultDiscoveryRegistry(),
      clock: createFakeClock(NOW),
    });

    await service1.createProfile(USER_A, {
      id: 'profile-sqlite',
      name: 'SQLite Jobs',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      criteria: emptyCriteria(),
    });
    await results1.create(sampleResult({ profileId: 'profile-sqlite', id: 'result:profile-sqlite:test' }));

    profiles1.close();
    results1.close();
    scheduler1.close();

    const profiles2 = createSqliteProfilePersistence({ databasePath: profilesDb.path });
    const results2 = createSqliteResultPersistence({ databasePath: resultsDb.path });
    const service2 = createDiscoveryUserService({
      profileStore: profiles2,
      resultStore: results2,
      resultStateWriter: createResultStateWriter({ store: results2, writer: results2 }),
      runStore: createInMemoryRunStore(),
      registry: createDefaultDiscoveryRegistry(),
      clock: createFakeClock(NOW),
    });

    const listed = await service2.listProfiles(USER_A);
    expect(listed).toHaveLength(1);
    const results = await service2.listResults(USER_A, 'profile-sqlite');
    expect(results).toHaveLength(1);
    expect(results[0]?.verification.status).toBe('PASS');

    profiles2.close();
    results2.close();
    profilesDb.cleanup();
    resultsDb.cleanup();
    schedulerDb.cleanup();
  });
});

describe('E9.3 runProfileNow integration', () => {
  it('executes pull-driven run and persists results', async () => {
    const db = tempDb('e93-run-');
    const profileStore = createSqliteProfilePersistence({ databasePath: db.path });
    const resultStore = createSqliteResultPersistence({ databasePath: db.path });
    const scheduler = createSqliteSchedulerPersistence({ databasePath: db.path });
    await profileStore.upsert(jobProfile({ id: 'profile-run-now', userId: USER_A }));

    const discoveryService = createDiscoveryService({
      production: {
        brave: { apiKey: 'smoke-brave-key' },
        openai: { apiKey: 'smoke-openai-key', model: 'gpt-4o-mini' },
        email: {
          apiKey: 'smoke-resend-key',
          from: 'Arrival Atlas <noreply@example.com>',
        },
        transport: happyPathTransport(),
        rateLimiter: createInMemoryRateLimiter(),
      },
      persistence: {
        resultsDatabasePath: db.path,
        schedulerDatabasePath: db.path,
        notificationsDatabasePath: db.path,
        queueDatabasePath: db.path,
        profilesDatabasePath: db.path,
      },
      registry: smokeRegistry(),
      resolveNotificationTarget: () => null,
    });

    const service = createDiscoveryUserService({
      profileStore,
      resultStore,
      resultStateWriter: createResultStateWriter({
        store: resultStore,
        writer: resultStore,
      }),
      runStore: scheduler.runStore,
      registry: createDefaultDiscoveryRegistry(),
      discoveryService,
      clock: createFakeClock(NOW),
    });

    const outcome = await service.runProfileNow(USER_A, 'profile-run-now');
    expect(['success', 'partial_success']).toContain(outcome.status);

    const results = await service.listResults(USER_A, 'profile-run-now');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.verification.status).toBe('PASS');

    profileStore.close();
    resultStore.close();
    scheduler.close();
    db.cleanup();
  });
});
