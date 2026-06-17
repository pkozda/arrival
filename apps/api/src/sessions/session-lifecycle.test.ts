import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../build-app.js';
import { entitlementService } from '../entitlements/entitlement.service.js';
import { sessionRegistryService } from './registry/session-registry.service.js';
import {
  resetTestStateStore,
  setupTestStateStore,
  teardownTestStateStore,
} from '../test-state.js';

describe('session registry service', () => {
  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
  });

  afterEach(() => {
    teardownTestStateStore();
  });

  it('registers and lists account sessions', async () => {
    const session = await sessionRegistryService.registerSession('acct_1', 'sess_1');
    expect(session.status).toBe('active');

    const sessions = await sessionRegistryService.listAccountSessions('acct_1');
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.sessionId).toBe('sess_1');
  });

  it('records session lifecycle events', async () => {
    await sessionRegistryService.registerSession('acct_1', 'sess_1');
    await sessionRegistryService.revokeSession('sess_1');

    const events = await sessionRegistryService.getAccountEvents('acct_1');
    expect(events.some((event) => event.type === 'session.created')).toBe(true);
    expect(events.some((event) => event.type === 'session.revoked')).toBe(true);
  });
});

describe('session lifecycle API', () => {
  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
  });

  afterEach(() => {
    teardownTestStateStore();
  });

  async function createSession(): Promise<string> {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: {},
    });
    return (res.json() as { sessionId: string }).sessionId;
  }

  async function claimSession(sessionId: string): Promise<string> {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/account/claim',
      headers: { 'x-session-id': sessionId },
    });
    return (res.json() as { accountId: string }).accountId;
  }

  async function grantModule(accountId: string, moduleId: string): Promise<void> {
    await entitlementService.saveEntitlements({
      accountId,
      tier: 'free',
      modules: [moduleId],
      features: {},
    });
  }

  it('account can have multiple sessions', async () => {
    const app = await buildApp();
    const sessionOne = await createSession();
    const accountId = await claimSession(sessionOne);

    const createSecond = await app.inject({
      method: 'POST',
      url: `/api/accounts/${accountId}/sessions`,
      headers: { 'x-session-id': sessionOne },
      payload: {},
    });

    expect(createSecond.statusCode).toBe(200);
    const { sessionId: sessionTwo } = createSecond.json() as { sessionId: string };

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/accounts/${accountId}/sessions`,
      headers: { 'x-session-id': sessionOne },
    });

    expect(listRes.statusCode).toBe(200);
    const body = listRes.json() as { sessions: Array<{ sessionId: string }> };
    const sessionIds = body.sessions.map((session) => session.sessionId).sort();
    expect(sessionIds).toEqual([sessionOne, sessionTwo].sort());
  });

  it('revoked session cannot access protected routes', async () => {
    const app = await buildApp();
    const sessionId = await createSession();
    const accountId = await claimSession(sessionId);
    await grantModule(accountId, 'financial-reality');

    const revokeRes = await app.inject({
      method: 'POST',
      url: `/api/sessions/${sessionId}/revoke`,
      headers: { 'x-session-id': sessionId },
    });
    expect(revokeRes.statusCode).toBe(200);

    const snapshotRes = await app.inject({
      method: 'GET',
      url: '/api/ui-snapshot',
      headers: { 'x-session-id': sessionId },
    });
    expect(snapshotRes.statusCode).toBe(403);
    expect(snapshotRes.json()).toEqual({ error: 'Session revoked' });
  });

  it('revoke-all invalidates all account sessions', async () => {
    const app = await buildApp();
    const sessionOne = await createSession();
    const accountId = await claimSession(sessionOne);

    const sessionTwoRes = await app.inject({
      method: 'POST',
      url: `/api/accounts/${accountId}/sessions`,
      headers: { 'x-session-id': sessionOne },
      payload: {},
    });
    const sessionTwo = (sessionTwoRes.json() as { sessionId: string }).sessionId;

    const revokeAllRes = await app.inject({
      method: 'POST',
      url: `/api/accounts/${accountId}/sessions/revoke-all`,
      headers: { 'x-session-id': sessionOne },
    });
    expect(revokeAllRes.statusCode).toBe(200);

    for (const sessionId of [sessionOne, sessionTwo]) {
      const res = await app.inject({
        method: 'GET',
        url: '/api/ui-snapshot',
        headers: { 'x-session-id': sessionId },
      });
      expect(res.statusCode).toBe(403);
    }
  });

  it('anonymous sessions remain unaffected by registry', async () => {
    const app = await buildApp();
    const sessionId = await createSession();

    const snapshotRes = await app.inject({
      method: 'GET',
      url: '/api/ui-snapshot',
      headers: { 'x-session-id': sessionId },
    });

    expect(snapshotRes.statusCode).toBe(200);
  });

  it('cannot revoke sessions belonging to another account', async () => {
    const app = await buildApp();
    const sessionA = await createSession();
    const accountA = await claimSession(sessionA);
    const sessionB = await createSession();
    await claimSession(sessionB);

    const res = await app.inject({
      method: 'POST',
      url: `/api/sessions/${sessionB}/revoke`,
      headers: { 'x-session-id': sessionA, 'x-account-id': accountA },
    });

    expect(res.statusCode).toBe(403);
  });

  it('registers session on account claim', async () => {
    const sessionId = await createSession();
    const accountId = await claimSession(sessionId);

    const record = await sessionRegistryService.getSessionRecord(sessionId);
    expect(record).toMatchObject({
      sessionId,
      accountId,
      status: 'active',
    });
  });
});
