import { rmSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './build-app.js';
import {
  resetDiscoveryRuntimeForTests,
  resolveDiscoveryPersistenceScope,
  resolveDiscoveryUserId,
} from './discovery/discovery-user-runtime.js';
import {
  resetTestStateStore,
  setupTestStateStore,
  teardownTestStateStore,
} from './test-state.js';

function jobsCreatePayload(id: string, name: string) {
  return {
    id,
    name,
    strategyId: 'job-discovery',
    strategyVersion: '1',
    criteria: {
      required: [{ key: 'country', value: 'DE' }],
      preferred: [{ key: 'role', value: 'Engineer' }],
      excluded: [],
      flexible: [],
    },
    schedule: { cadence: 'manual' },
    notification: { emailEnabled: true, skipEmptyDigest: true },
    enabled: true,
  };
}

const PD006_STATE_DIR = `${process.cwd()}/.arrival-atlas-state-pd006-test`;

describe('PD-006 Discovery persistence', () => {
  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
    // Fixed profile IDs require a clean Discovery SQLite; stale WAL causes 409 collisions.
    rmSync(PD006_STATE_DIR, { recursive: true, force: true });
    process.env.ARRIVAL_ATLAS_STATE_DIR = PD006_STATE_DIR;
    resetDiscoveryRuntimeForTests();
  });

  afterEach(() => {
    resetDiscoveryRuntimeForTests();
    teardownTestStateStore();
  });

  async function createSession(app: Awaited<ReturnType<typeof buildApp>>) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { context: { userProfile: { language: 'en' } } },
    });
    expect(res.statusCode).toBe(200);
    return res.json() as { sessionId: string; token?: string };
  }

  async function claimSession(
    app: Awaited<ReturnType<typeof buildApp>>,
    sessionId: string,
    token?: string
  ) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/account/claim',
      headers: {
        'x-session-id': sessionId,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    expect(res.statusCode).toBe(200);
    return res.json() as { accountId: string; sessionId: string; token: string };
  }

  function authHeaders(sessionId: string, token?: string) {
    return {
      'x-session-id': sessionId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  it('E — identity precedence: accountId wins over sessionId', () => {
    expect(
      resolveDiscoveryUserId({ sessionId: 'sess_1', accountId: 'acct_1' })
    ).toBe('acct_1');
    expect(resolveDiscoveryUserId({ sessionId: 'sess_1', accountId: null })).toBe('sess_1');
    expect(resolveDiscoveryPersistenceScope({ accountId: 'acct_1' })).toBe('account');
    expect(resolveDiscoveryPersistenceScope({ accountId: null })).toBe('session');
  });

  it('A/H — account-backed profile survives linked session change', async () => {
    const app = await buildApp();
    const session = await createSession(app);
    const claimed = await claimSession(app, session.sessionId, session.token);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/modules/discovery/profiles',
      headers: authHeaders(claimed.sessionId, claimed.token),
      payload: jobsCreatePayload('pd006-account-profile', 'Account Jobs'),
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json() as {
      profile: { id: string; userId: string; name: string };
      persistenceScope: string;
    };
    expect(created.persistenceScope).toBe('account');
    expect(created.profile.userId).toBe(claimed.accountId);

    const linked = await app.inject({
      method: 'POST',
      url: `/api/accounts/${claimed.accountId}/sessions`,
      headers: authHeaders(claimed.sessionId, claimed.token),
      payload: {},
    });
    expect(linked.statusCode).toBe(200);
    const linkedBody = linked.json() as {
      sessionId: string;
      accountId: string;
      token: string;
    };
    expect(linkedBody.sessionId).not.toBe(claimed.sessionId);
    expect(linkedBody.accountId).toBe(claimed.accountId);

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/modules/discovery/profiles',
      headers: authHeaders(linkedBody.sessionId, linkedBody.token),
    });
    expect(listRes.statusCode).toBe(200);
    const list = listRes.json() as {
      profiles: Array<{ id: string; name: string }>;
      persistenceScope: string;
    };
    expect(list.persistenceScope).toBe('account');
    expect(list.profiles.some((p) => p.id === 'pd006-account-profile')).toBe(true);
  });

  it('B/H — account isolation: Account B cannot see Account A profiles', async () => {
    const app = await buildApp();
    const sessionA = await createSession(app);
    const accountA = await claimSession(app, sessionA.sessionId, sessionA.token);
    const sessionB = await createSession(app);
    const accountB = await claimSession(app, sessionB.sessionId, sessionB.token);

    await app.inject({
      method: 'POST',
      url: '/api/modules/discovery/profiles',
      headers: authHeaders(accountA.sessionId, accountA.token),
      payload: jobsCreatePayload('pd006-owner-a', 'Owner A'),
    });

    const listB = await app.inject({
      method: 'GET',
      url: '/api/modules/discovery/profiles',
      headers: authHeaders(accountB.sessionId, accountB.token),
    });
    expect(listB.statusCode).toBe(200);
    const bodyB = listB.json() as { profiles: Array<{ id: string }> };
    expect(bodyB.profiles.some((p) => p.id === 'pd006-owner-a')).toBe(false);

    const getB = await app.inject({
      method: 'GET',
      url: '/api/modules/discovery/profiles/pd006-owner-a',
      headers: authHeaders(accountB.sessionId, accountB.token),
    });
    expect(getB.statusCode).toBe(404);
  });

  it('C — session profile survives reload within same session', async () => {
    const app = await buildApp();
    const session = await createSession(app);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/modules/discovery/profiles',
      headers: { 'x-session-id': session.sessionId },
      payload: jobsCreatePayload('pd006-session-profile', 'Session Jobs'),
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json() as {
      profile: { userId: string };
      persistenceScope: string;
    };
    expect(created.persistenceScope).toBe('session');
    expect(created.profile.userId).toBe(session.sessionId);

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/modules/discovery/profiles',
      headers: { 'x-session-id': session.sessionId },
    });
    expect(listRes.statusCode).toBe(200);
    const list = listRes.json() as {
      profiles: Array<{ id: string }>;
      persistenceScope: string;
    };
    expect(list.persistenceScope).toBe('session');
    expect(list.profiles.some((p) => p.id === 'pd006-session-profile')).toBe(true);
  });

  it('D — session isolation: Session B cannot see Session A profiles', async () => {
    const app = await buildApp();
    const sessionA = await createSession(app);
    const sessionB = await createSession(app);

    await app.inject({
      method: 'POST',
      url: '/api/modules/discovery/profiles',
      headers: { 'x-session-id': sessionA.sessionId },
      payload: jobsCreatePayload('pd006-sess-a', 'Session A'),
    });

    const listB = await app.inject({
      method: 'GET',
      url: '/api/modules/discovery/profiles',
      headers: { 'x-session-id': sessionB.sessionId },
    });
    expect(listB.statusCode).toBe(200);
    const bodyB = listB.json() as { profiles: Array<{ id: string }> };
    expect(bodyB.profiles.some((p) => p.id === 'pd006-sess-a')).toBe(false);
  });

  it('F/G — guided and self-directed create share ownership semantics', async () => {
    const app = await buildApp();
    const session = await createSession(app);
    const claimed = await claimSession(app, session.sessionId, session.token);

    const guidedLike = await app.inject({
      method: 'POST',
      url: '/api/modules/discovery/profiles',
      headers: authHeaders(claimed.sessionId, claimed.token),
      payload: jobsCreatePayload('pd006-guided', 'Guided Jobs'),
    });
    const selfDirected = await app.inject({
      method: 'POST',
      url: '/api/modules/discovery/profiles',
      headers: authHeaders(claimed.sessionId, claimed.token),
      payload: jobsCreatePayload('pd006-self', 'Self Jobs'),
    });

    expect(guidedLike.statusCode).toBe(201);
    expect(selfDirected.statusCode).toBe(201);
    const guidedBody = guidedLike.json() as { profile: { userId: string }; persistenceScope: string };
    const selfBody = selfDirected.json() as { profile: { userId: string }; persistenceScope: string };
    expect(guidedBody.profile.userId).toBe(claimed.accountId);
    expect(selfBody.profile.userId).toBe(claimed.accountId);
    expect(guidedBody.persistenceScope).toBe('account');
    expect(selfBody.persistenceScope).toBe('account');
  });

  it('I — mutation isolation: cannot patch another owner profile', async () => {
    const app = await buildApp();
    const sessionA = await createSession(app);
    const accountA = await claimSession(app, sessionA.sessionId, sessionA.token);
    const sessionB = await createSession(app);
    const accountB = await claimSession(app, sessionB.sessionId, sessionB.token);

    await app.inject({
      method: 'POST',
      url: '/api/modules/discovery/profiles',
      headers: authHeaders(accountA.sessionId, accountA.token),
      payload: jobsCreatePayload('pd006-mutate-a', 'Mutable A'),
    });

    const patchB = await app.inject({
      method: 'PATCH',
      url: '/api/modules/discovery/profiles/pd006-mutate-a',
      headers: authHeaders(accountB.sessionId, accountB.token),
      payload: { name: 'Hijacked' },
    });
    expect(patchB.statusCode).toBe(404);

    const getA = await app.inject({
      method: 'GET',
      url: '/api/modules/discovery/profiles/pd006-mutate-a',
      headers: authHeaders(accountA.sessionId, accountA.token),
    });
    expect(getA.statusCode).toBe(200);
    expect((getA.json() as { profile: { name: string } }).profile.name).toBe('Mutable A');
  });

  it('J — disclosure field distinguishes account vs session', async () => {
    const app = await buildApp();
    const session = await createSession(app);

    const sessionList = await app.inject({
      method: 'GET',
      url: '/api/modules/discovery/profiles',
      headers: { 'x-session-id': session.sessionId },
    });
    expect(sessionList.json()).toMatchObject({ persistenceScope: 'session' });

    const claimed = await claimSession(app, session.sessionId, session.token);
    const accountList = await app.inject({
      method: 'GET',
      url: '/api/modules/discovery/profiles',
      headers: authHeaders(claimed.sessionId, claimed.token),
    });
    expect(accountList.json()).toMatchObject({ persistenceScope: 'account' });
  });

  it('K — creating/listing profiles does not invent a Discovery run', async () => {
    const app = await buildApp();
    const session = await createSession(app);
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/modules/discovery/profiles',
      headers: { 'x-session-id': session.sessionId },
      payload: jobsCreatePayload('pd006-no-run', 'No Run'),
    });
    expect(createRes.statusCode).toBe(201);
    const summary = await app.inject({
      method: 'GET',
      url: '/api/modules/discovery/profiles/pd006-no-run/run-summary',
      headers: { 'x-session-id': session.sessionId },
    });
    expect(summary.statusCode).toBe(200);
    const body = summary.json() as { lastRun: unknown; lifecycle: string };
    expect(body.lastRun).toBeNull();
    expect(body.lifecycle).toBe('IDLE');
  });
});
