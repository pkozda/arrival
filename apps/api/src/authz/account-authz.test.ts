import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildApp } from '../build-app.js';
import {
  AccountSessionMismatchError,
  resolveAccountFromSession,
} from './account-context.js';
import {
  AccountAccessForbiddenError,
  validateAccountAccess,
} from './account-session.guard.js';
import { systemStateCoordinator } from '../state/system-state-coordinator.js';
import {
  resetTestStateStore,
  setupTestStateStore,
  teardownTestStateStore,
} from '../test-state.js';

describe('validateAccountAccess', () => {
  it('allows anonymous sessions regardless of target account', () => {
    expect(() =>
      validateAccountAccess({ sessionId: 'sess_a', accountId: null }, 'acct_other')
    ).not.toThrow();
  });

  it('allows claimed sessions when no target account is specified', () => {
    expect(() =>
      validateAccountAccess({ sessionId: 'sess_a', accountId: 'acct_1' })
    ).not.toThrow();
  });

  it('allows claimed sessions when target account matches', () => {
    expect(() =>
      validateAccountAccess(
        { sessionId: 'sess_a', accountId: 'acct_1' },
        'acct_1'
      )
    ).not.toThrow();
  });

  it('rejects claimed sessions when target account mismatches', () => {
    expect(() =>
      validateAccountAccess(
        { sessionId: 'sess_a', accountId: 'acct_1' },
        'acct_2'
      )
    ).toThrow(AccountAccessForbiddenError);
  });
});

describe('account authz middleware', () => {
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

  it('Case 1 — anonymous session access is allowed', async () => {
    const app = await buildApp();
    const sessionId = await createSession();

    const snapshotRes = await app.inject({
      method: 'GET',
      url: '/api/ui-snapshot',
      headers: { 'x-session-id': sessionId },
    });

    expect(snapshotRes.statusCode).toBe(200);
  });

  it('Case 2 — claimed session can access its own scoped routes', async () => {
    const app = await buildApp();
    const sessionId = await createSession();
    const accountId = await claimSession(sessionId);

    const snapshotRes = await app.inject({
      method: 'GET',
      url: '/api/ui-snapshot',
      headers: { 'x-session-id': sessionId },
    });

    expect(snapshotRes.statusCode).toBe(200);

    const state = await systemStateCoordinator.getState(sessionId);
    expect(state?.accountId).toBe(accountId);
    expect(state?.version.lastActor).toEqual({
      sessionId,
      accountId,
      authSubject: `account:${accountId}`,
    });
  });

  it('Case 3 — rejects mismatched x-account-id on claimed session', async () => {
    const app = await buildApp();
    const sessionId = await createSession();
    await claimSession(sessionId);

    const snapshotRes = await app.inject({
      method: 'GET',
      url: '/api/ui-snapshot',
      headers: {
        'x-session-id': sessionId,
        'x-account-id': '00000000-0000-0000-0000-000000000099',
      },
    });

    expect(snapshotRes.statusCode).toBe(403);
    expect(snapshotRes.json()).toEqual({ error: 'Account access forbidden' });
  });

  it('Case 3 — rejects profile access with mismatched x-account-id', async () => {
    const app = await buildApp();
    const sessionId = await createSession();
    const accountId = await claimSession(sessionId);

    const res = await app.inject({
      method: 'GET',
      url: '/api/profile',
      headers: {
        'x-session-id': sessionId,
        'x-account-id': '00000000-0000-0000-0000-000000000099',
      },
    });

    expect(res.statusCode).toBe(403);

    const allowed = await app.inject({
      method: 'GET',
      url: '/api/profile',
      headers: {
        'x-session-id': sessionId,
        'x-account-id': accountId,
      },
    });

    expect(allowed.statusCode).toBe(404);
  });

  it('Case 4 — legacy SystemState without accountId remains accessible', async () => {
    const stateDir = process.env.ARRIVALOS_STATE_DIR!;
    const legacySessionId = 'sess_legacy_authz';
    const legacyState = {
      session: {
        id: legacySessionId,
        createdAt: '2026-06-01T00:00:00.000Z',
        lastActiveAt: '2026-06-01T00:00:00.000Z',
        context: { userProfile: { language: 'en' } },
      },
      profileRecord: null,
      profileRevisions: [],
      executionsByModuleId: {},
      executionTracesByModuleId: {},
      events: [],
      modules: [{ id: 'financial-reality', name: 'Financial Reality' }],
      projectionConfig: { uxSnapshotEnabled: false },
      generatedAt: '2026-06-01T00:00:00.000Z',
      version: {
        snapshotVersion: 1,
        stateHash: 'abc',
        lastMutationId: 'legacy',
      },
    };

    await mkdir(stateDir, { recursive: true });
    await writeFile(join(stateDir, `${legacySessionId}.json`), JSON.stringify(legacyState));
    systemStateCoordinator.resetCache();

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/ui-snapshot',
      headers: { 'x-session-id': legacySessionId },
    });

    expect(res.statusCode).toBe(200);
  });

  it('rejects session identifier mismatch between header and persisted state', async () => {
    const stateDir = process.env.ARRIVALOS_STATE_DIR!;
    const fileSessionId = 'sess_file_key';
    const internalSessionId = 'sess_internal_id';
    const mismatchedState = {
      accountId: 'acct_bound',
      session: {
        id: internalSessionId,
        createdAt: '2026-06-01T00:00:00.000Z',
        lastActiveAt: '2026-06-01T00:00:00.000Z',
        context: {},
      },
      profileRecord: null,
      profileRevisions: [],
      executionsByModuleId: {},
      executionTracesByModuleId: {},
      events: [],
      modules: [],
      projectionConfig: { uxSnapshotEnabled: false },
      generatedAt: '2026-06-01T00:00:00.000Z',
      version: {
        snapshotVersion: 1,
        stateHash: 'abc',
        lastMutationId: 'legacy',
      },
    };

    await mkdir(stateDir, { recursive: true });
    await writeFile(join(stateDir, `${fileSessionId}.json`), JSON.stringify(mismatchedState));
    systemStateCoordinator.resetCache();

    await expect(resolveAccountFromSession(fileSessionId)).rejects.toThrow(
      AccountSessionMismatchError
    );

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/ui-snapshot',
      headers: { 'x-session-id': fileSessionId },
    });

    expect(res.statusCode).toBe(403);
  });

  it('rejects module execute without session header', async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/api/modules/financial-reality/execute',
      payload: {
        grossMonthlyIncome: 2000,
      },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'Authentication required' });
  });

  it('enforces authz on module execute when session header is present', async () => {
    const app = await buildApp();
    const sessionId = await createSession();
    await claimSession(sessionId);

    const res = await app.inject({
      method: 'POST',
      url: '/api/modules/financial-reality/execute',
      headers: {
        'x-session-id': sessionId,
        'x-account-id': '00000000-0000-0000-0000-000000000099',
      },
      payload: {
        grossMonthlyIncome: 2000,
      },
    });

    expect(res.statusCode).toBe(403);
  });
});
