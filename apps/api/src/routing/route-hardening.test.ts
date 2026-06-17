import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../build-app.js';
import { emitIdentityObservabilityEvents } from './apply-route-security.js';
import { IAMEventType } from '../observability/iam-events.js';
import {
  resetTestStateStore,
  setupTestStateStore,
  teardownTestStateStore,
} from '../test-state.js';

describe('route hardening (IAM Phase 3.1 Step 7)', () => {
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
    return res.json() as { sessionId: string; token: string };
  }

  describe('GET/PATCH /api/sessions/:id', () => {
    it('returns 401 when credential is missing', async () => {
      const app = await buildApp();
      const { sessionId } = await createSession();

      const getRes = await app.inject({
        method: 'GET',
        url: `/api/sessions/${sessionId}`,
      });
      expect(getRes.statusCode).toBe(401);
      expect(getRes.json()).toEqual({ error: 'Authentication required' });

      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/sessions/${sessionId}`,
        payload: { context: { userProfile: { language: 'de' } } },
      });
      expect(patchRes.statusCode).toBe(401);
    });

    it('returns 403 when accessing a foreign session', async () => {
      const app = await buildApp();
      const first = await createSession();
      const second = await createSession();

      const res = await app.inject({
        method: 'GET',
        url: `/api/sessions/${second.sessionId}`,
        headers: { 'x-session-id': first.sessionId },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual({ error: 'Account access forbidden' });
    });

    it('returns 200 for own session', async () => {
      const app = await buildApp();
      const { sessionId } = await createSession();

      const res = await app.inject({
        method: 'GET',
        url: `/api/sessions/${sessionId}`,
        headers: { 'x-session-id': sessionId },
      });

      expect(res.statusCode).toBe(200);
      expect((res.json() as { id: string }).id).toBe(sessionId);
    });
  });

  describe('GET /api/events', () => {
    it('returns 401 without credential', async () => {
      const app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/events?sessionId=sess_any',
      });

      expect(res.statusCode).toBe(401);
    });

    it('returns 403 when querying a foreign sessionId', async () => {
      const app = await buildApp();
      const first = await createSession();
      const second = await createSession();

      const res = await app.inject({
        method: 'GET',
        url: `/api/events?sessionId=${second.sessionId}`,
        headers: { 'x-session-id': first.sessionId },
      });

      expect(res.statusCode).toBe(403);
    });

    it('returns events for the authenticated session', async () => {
      const app = await buildApp();
      const { sessionId } = await createSession();

      const res = await app.inject({
        method: 'GET',
        url: `/api/events?sessionId=${sessionId}`,
        headers: { 'x-session-id': sessionId },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ events: expect.any(Array) });
    });
  });

  describe('GET /api/modules/:id/trace', () => {
    it('returns 403 for revoked session', async () => {
      const app = await buildApp();
      const { sessionId, token } = await createSession();

      const claimRes = await app.inject({
        method: 'POST',
        url: '/api/account/claim',
        headers: { authorization: `Bearer ${token}` },
      });
      const { accountId } = claimRes.json() as { accountId: string };

      await app.inject({
        method: 'POST',
        url: `/api/sessions/${sessionId}/revoke`,
        headers: { authorization: `Bearer ${token}` },
      });

      const traceRes = await app.inject({
        method: 'GET',
        url: '/api/modules/financial-reality/trace',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(traceRes.statusCode).toBe(403);
      expect(traceRes.json()).toEqual({ error: 'Session revoked' });

      const listRes = await app.inject({
        method: 'GET',
        url: `/api/accounts/${accountId}/sessions`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(listRes.statusCode).toBe(403);
    });
  });

  describe('POST /api/modules/:id/execute', () => {
    it('returns 401 without credential (R12)', async () => {
      const app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: '/api/modules/financial-reality/execute',
        payload: { grossMonthlyIncome: 2000 },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({ error: 'Authentication required' });
    });
  });

  describe('IAM observability', () => {
    it('emits LEGACY_USED for x-session-id authentication', () => {
      const warn = vi.fn();
      emitIdentityObservabilityEvents(
        { warn },
        { sessionId: 'sess_1', accountId: null, authSubject: null, authMode: 'session' },
        {
          sessionId: 'sess_1',
          accountId: null,
          authSubject: null,
          source: 'legacy',
          verified: true,
        }
      );

      expect(warn).toHaveBeenCalledWith(
        expect.objectContaining({ iamEvent: IAMEventType.LEGACY_USED, sessionId: 'sess_1' })
      );
    });

    it('emits AUTH_SUBJECT_NULL for claimed legacy sessions', () => {
      const warn = vi.fn();
      emitIdentityObservabilityEvents(
        { warn },
        { sessionId: 'sess_1', accountId: 'acct_1', authSubject: null, authMode: 'session' },
        {
          sessionId: 'sess_1',
          accountId: 'acct_1',
          authSubject: null,
          source: 'legacy',
          verified: true,
        }
      );

      expect(warn).toHaveBeenCalledWith(
        expect.objectContaining({
          iamEvent: IAMEventType.AUTH_SUBJECT_NULL,
          sessionId: 'sess_1',
          accountId: 'acct_1',
        })
      );
    });
  });
});
