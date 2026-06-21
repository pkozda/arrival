import { describe, expect, it } from 'vitest';
import { buildApp } from '../build-app.js';
import {
  enforceRouteSecurity,
  evaluateRouteAccess,
  findMatchingRouteRule,
  RouteSecurityMisconfigurationError,
} from './enforce-route-security.js';
import { matchRoute } from './match-route.js';
import {
  RouteSecurityMap,
  validateRouteSecurityMap,
  UndeclaredRouteSecurityError,
} from './route-security-map.js';

describe('matchRoute', () => {
  it('matches static paths', () => {
    expect(matchRoute('/health', '/health')).toBe(true);
    expect(matchRoute('/health', '/other')).toBe(false);
  });

  it('matches parameterized paths', () => {
    expect(matchRoute('/api/sessions/:id', '/api/sessions/sess_123')).toBe(true);
    expect(matchRoute('/api/accounts/:id/sessions', '/api/accounts/acct_1/sessions')).toBe(
      true
    );
    expect(matchRoute('/api/sessions/:id', '/api/sessions')).toBe(false);
  });
});

describe('validateRouteSecurityMap', () => {
  it('throws when a registered route is missing from the map', () => {
    expect(() =>
      validateRouteSecurityMap(RouteSecurityMap, [
        { method: 'GET', path: '/api/unknown' },
      ])
    ).toThrow(UndeclaredRouteSecurityError);
  });

  it('throws when the map contains a route not registered in the app', () => {
    expect(() =>
      validateRouteSecurityMap(
        [{ method: 'GET', path: '/api/ghost', tier: 'public' }],
        [{ method: 'GET', path: '/health' }]
      )
    ).toThrow(UndeclaredRouteSecurityError);
  });
});

describe('RouteSecurityMap', () => {
  it('classifies every known API route pattern', () => {
    const routes = [
      ['GET', '/health'],
      ['GET', '/api/health/governance'],
      ['GET', '/api/health/modules'],
      ['GET', '/api/modules'],
      ['GET', '/api/modules/financial-reality'],
      ['GET', '/api/modules/financial-reality/schema'],
      ['GET', '/api/modules/financial-reality/capabilities'],
      ['GET', '/api/i18n/languages'],
      ['GET', '/api/i18n/en'],
      ['POST', '/api/sessions'],
      ['GET', '/api/sessions/sess_1'],
      ['PATCH', '/api/sessions/sess_1'],
      ['GET', '/api/events'],
      ['GET', '/api/modules/financial-reality/trace'],
      ['GET', '/api/modules/financial-reality/explain'],
      ['POST', '/api/modules/financial-reality/execute'],
      ['POST', '/api/mutations'],
      ['GET', '/api/user-context'],
      ['GET', '/api/profile-insights'],
      ['GET', '/api/modules/life-event/plan'],
      ['GET', '/api/modules/economic-reality/plan'],
      ['POST', '/api/modules/economic-reality/action/execute'],
      ['POST', '/api/modules/economic-reality/events'],
      ['GET', '/api/ui-snapshot'],
      ['POST', '/api/profile'],
      ['GET', '/api/profile'],
      ['PATCH', '/api/profile'],
      ['GET', '/api/profile/revisions'],
      ['POST', '/api/account/claim'],
      ['GET', '/api/accounts/acct_1/sessions'],
      ['POST', '/api/accounts/acct_1/sessions'],
      ['POST', '/api/accounts/acct_1/sessions/revoke-all'],
      ['POST', '/api/sessions/sess_1/revoke'],
      ['POST', '/api/dev/reset-user-data'],
      ['POST', '/api/dev/reset-all-state'],
      ['GET', '/api/dev/demo/presets'],
      ['POST', '/api/dev/demo/load-preset'],
    ] as const;

    for (const [method, path] of routes) {
      expect(findMatchingRouteRule(method, path)).not.toBeNull();
    }

    expect(RouteSecurityMap.length).toBe(routes.length);
  });

  it('locks bootstrap contract for all registered Fastify routes', async () => {
    await expect(buildApp()).resolves.toBeDefined();
  });
});

describe('evaluateRouteAccess', () => {
  const identity = {
    sessionId: 'sess_1',
    accountId: 'acct_1',
    authSubject: 'account:acct_1',
    source: 'token' as const,
    verified: true,
  };

  it('allows public and anonymous-create tiers without identity', () => {
    expect(
      evaluateRouteAccess(undefined, {
        method: 'GET',
        path: '/health',
        tier: 'public',
      })
    ).toEqual({
      ok: true,
      rule: { method: 'GET', path: '/health', tier: 'public' },
    });

    expect(
      evaluateRouteAccess(undefined, {
        method: 'POST',
        path: '/api/sessions',
        tier: 'anonymous-create',
      }).ok
    ).toBe(true);
  });

  it('requires identity for credential-required routes', () => {
    const denied = evaluateRouteAccess(undefined, {
      method: 'GET',
      path: '/api/ui-snapshot',
      tier: 'credential-required',
    });

    expect(denied).toEqual({
      ok: false,
      status: 401,
      error: 'Authentication required',
    });

    const allowed = evaluateRouteAccess(
      { ...identity, accountId: null },
      {
        method: 'GET',
        path: '/api/ui-snapshot',
        tier: 'credential-required',
      }
    );

    expect(allowed.ok).toBe(true);
  });

  it('requires accountId for account-required routes', () => {
    const denied = evaluateRouteAccess(
      { ...identity, accountId: null },
      {
        method: 'GET',
        path: '/api/accounts/:id/sessions',
        tier: 'account-required',
      }
    );

    expect(denied).toEqual({
      ok: false,
      status: 403,
      error: 'Account access forbidden',
    });
  });
});

describe('enforceRouteSecurity', () => {
  it('allows credential-required routes when identity is present', () => {
    const result = enforceRouteSecurity({
      method: 'GET',
      path: '/api/ui-snapshot',
      identity: {
        sessionId: 'sess_1',
        accountId: null,
        authSubject: null,
        source: 'legacy',
        verified: true,
      },
    });

    expect(result.ok).toBe(true);
  });

  it('throws for unclassified routes', () => {
    expect(() =>
      enforceRouteSecurity({
        method: 'GET',
        path: '/api/unknown',
      })
    ).toThrow(RouteSecurityMisconfigurationError);
  });
});
