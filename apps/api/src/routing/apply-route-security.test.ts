import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../build-app.js';
import {
  hasAuthCredential,
  wrapRouteWithSecurity,
} from './apply-route-security.js';
import { requireRouteSecurityRule } from './route-security-map.js';
import {
  resetTestStateStore,
  setupTestStateStore,
  teardownTestStateStore,
} from '../test-state.js';

describe('applySecurityPipeline', () => {
  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
  });

  afterEach(() => {
    teardownTestStateStore();
  });

  it('registers every route through the security map at bootstrap', async () => {
    await expect(buildApp()).resolves.toBeDefined();
  });

  it('allows public routes without identity', async () => {
    const app = await buildApp();
    const rule = requireRouteSecurityRule('GET', '/health');

    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.statusCode).toBe(200);
    expect(rule.tier).toBe('public');
  });

  it('allows anonymous-create routes without identity', async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: {},
    });

    expect(res.statusCode).toBe(200);
  });

  it('requires identity for credential-required routes', async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: 'GET',
      url: '/api/ui-snapshot',
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'Authentication required' });
  });

  it('requires accountId for account-required routes', async () => {
    const app = await buildApp();
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: {},
    });
    const { sessionId } = createRes.json() as { sessionId: string };

    const res = await app.inject({
      method: 'GET',
      url: '/api/accounts/acct_missing/sessions',
      headers: { 'x-session-id': sessionId },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'Account access forbidden' });
  });

  it('wrapRouteWithSecurity always runs pipeline before handler', async () => {
    const Fastify = (await import('fastify')).default;
    const app = Fastify({ logger: false });
    const rule = requireRouteSecurityRule('GET', '/health');
    let handlerCalled = false;

    app.get(
      '/health',
      wrapRouteWithSecurity(rule, async () => {
        handlerCalled = true;
        return { ok: true };
      })
    );

    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(handlerCalled).toBe(true);
    await app.close();
  });
});

describe('hasAuthCredential', () => {
  it('detects bearer, cookie, and legacy session headers', () => {
    expect(
      hasAuthCredential({
        headers: { authorization: 'Bearer token' },
      } as never)
    ).toBe(true);

    expect(
      hasAuthCredential({
        headers: { cookie: 'arrival_auth=abc' },
      } as never)
    ).toBe(true);

    expect(
      hasAuthCredential({
        headers: { 'x-session-id': 'sess_1' },
      } as never)
    ).toBe(true);
  });
});
