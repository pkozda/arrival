import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../build-app.js';
import { authTokenService, resolveAuthSubject } from './auth.token.service.js';
import { buildAuthContext } from './auth.context.js';
import {
  resetTestStateStore,
  setupTestStateStore,
  teardownTestStateStore,
} from '../test-state.js';
import type { FastifyRequest } from 'fastify';

function mockRequest(headers: Record<string, string>): FastifyRequest {
  return { headers } as FastifyRequest;
}

describe('auth token service', () => {
  beforeEach(() => {
    process.env.ARRIVAL_ATLAS_AUTH_SECRET = 'arrival-atlas-test-auth-secret';
  });

  it('creates and verifies a token payload', () => {
    const token = authTokenService.createToken({
      accountId: 'acct_1',
      sessionId: 'sess_1',
      authSubject: 'account:acct_1',
    });

    const payload = authTokenService.verifyToken(token);
    expect(payload.accountId).toBe('acct_1');
    expect(payload.sessionId).toBe('sess_1');
    expect(payload.authSubject).toBe('account:acct_1');
  });

  it('rejects tampered tokens', () => {
    const token = authTokenService.createToken({
      accountId: null,
      sessionId: 'sess_1',
    });

    const tampered = `${token}x`;
    expect(() => authTokenService.verifyToken(tampered)).toThrow();
  });

  it('refreshToken re-issues a valid token', () => {
    const token = authTokenService.createToken({
      accountId: null,
      sessionId: 'sess_1',
    });

    const refreshed = authTokenService.refreshToken(token);
    expect(refreshed).toBeTruthy();
    expect(authTokenService.verifyToken(refreshed!).sessionId).toBe('sess_1');
  });

  it('resolveAuthSubject returns account subject for claimed accounts', () => {
    expect(resolveAuthSubject('acct_1')).toBe('account:acct_1');
    expect(resolveAuthSubject(null)).toBeNull();
  });
});

describe('auth middleware integration', () => {
  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
  });

  afterEach(() => {
    teardownTestStateStore();
  });

  async function createSession(): Promise<{ sessionId: string; token: string }> {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: {},
    });
    const body = res.json() as { sessionId: string; token: string };
    return body;
  }

  async function claimSession(sessionId: string): Promise<{
    accountId: string;
    token: string;
    authSubject: string;
  }> {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/account/claim',
      headers: { 'x-session-id': sessionId },
    });
    return res.json() as { accountId: string; token: string; authSubject: string };
  }

  it('accepts Bearer token for protected routes', async () => {
    const app = await buildApp();
    const { token } = await createSession();

    const res = await app.inject({
      method: 'GET',
      url: '/api/ui-snapshot',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
  });

  it('falls back to legacy x-session-id when no token is provided', async () => {
    const app = await buildApp();
    const { sessionId } = await createSession();

    const res = await app.inject({
      method: 'GET',
      url: '/api/ui-snapshot',
      headers: { 'x-session-id': sessionId },
    });

    expect(res.statusCode).toBe(200);
  });

  it('rejects invalid Bearer tokens with 401', async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: 'GET',
      url: '/api/ui-snapshot',
      headers: { authorization: 'Bearer invalid.token.value' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'Invalid authentication token' });
  });

  it('rejects revoked session tokens with 403', async () => {
    const app = await buildApp();
    const { sessionId, token } = await createSession();
    const { accountId } = await claimSession(sessionId);

    const revokeRes = await app.inject({
      method: 'POST',
      url: `/api/sessions/${sessionId}/revoke`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(revokeRes.statusCode).toBe(200);

    const snapshotRes = await app.inject({
      method: 'GET',
      url: '/api/ui-snapshot',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(snapshotRes.statusCode).toBe(403);
    expect(snapshotRes.json()).toEqual({ error: 'Session revoked' });

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/accounts/${accountId}/sessions`,
      headers: { 'x-session-id': sessionId },
    });
    expect(listRes.statusCode).toBe(403);
  });

  it('rejects token when account in token does not match session state', async () => {
    const app = await buildApp();
    const { sessionId } = await createSession();

    const mismatchedToken = authTokenService.createToken({
      accountId: 'acct_other',
      sessionId,
      authSubject: 'account:acct_other',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/ui-snapshot',
      headers: { authorization: `Bearer ${mismatchedToken}` },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'Account identity drift detected' });
  });

  it('allows pre-claim token after account claim with TOKEN_ACCOUNT_IGNORED semantics', async () => {
    const app = await buildApp();
    const { sessionId, token } = await createSession();
    await claimSession(sessionId);

    const res = await app.inject({
      method: 'GET',
      url: '/api/ui-snapshot',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
  });

  it('allows legacy x-session-id flow unchanged', async () => {
    const app = await buildApp();
    const { sessionId } = await createSession();

    const res = await app.inject({
      method: 'GET',
      url: '/api/ui-snapshot',
      headers: { 'x-session-id': sessionId },
    });

    expect(res.statusCode).toBe(200);
  });

  it('issues token on session creation', async () => {
    const { sessionId, token } = await createSession();
    const payload = authTokenService.verifyToken(token);
    expect(payload.sessionId).toBe(sessionId);
    expect(payload.accountId).toBeNull();
  });

  it('issues claimed-account token on claim', async () => {
    const { sessionId } = await createSession();
    const claim = await claimSession(sessionId);

    expect(claim.authSubject).toBe(`account:${claim.accountId}`);
    const payload = authTokenService.verifyToken(claim.token);
    expect(payload.accountId).toBe(claim.accountId);
    expect(payload.sessionId).toBe(sessionId);
  });

  it('accepts arrival_auth cookie as credential', async () => {
    const app = await buildApp();
    const { token } = await createSession();

    const res = await app.inject({
      method: 'GET',
      url: '/api/ui-snapshot',
      headers: { cookie: `arrival_auth=${encodeURIComponent(token)}` },
    });

    expect(res.statusCode).toBe(200);
  });
});

describe('buildAuthContext', () => {
  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
  });

  afterEach(() => {
    teardownTestStateStore();
  });

  it('resolves token mode from Bearer header', async () => {
    const app = await buildApp();
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: {},
    });
    const { sessionId, token } = createRes.json() as { sessionId: string; token: string };

    const result = await buildAuthContext(
      mockRequest({ authorization: `Bearer ${token}` })
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.auth.authMode).toBe('token');
      expect(result.auth.sessionId).toBe(sessionId);
    }
  });

  it('resolves session mode from legacy header', async () => {
    const app = await buildApp();
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: {},
    });
    const { sessionId } = createRes.json() as { sessionId: string };

    const result = await buildAuthContext(
      mockRequest({ 'x-session-id': sessionId })
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.auth.authMode).toBe('session');
      expect(result.auth.authSubject).toBeNull();
    }
  });
});
