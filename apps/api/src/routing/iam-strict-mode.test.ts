import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authTokenService } from '../auth/auth.token.service.js';
import * as iamEvents from '../observability/iam-events.js';
import { IAMEventType } from '../observability/iam-events.js';
import { sessionRegistryService } from '../sessions/registry/session-registry.service.js';
import { buildApp } from '../build-app.js';
import { applySecurityPipeline } from './apply-route-security.js';
import * as enforceRouteSecurityModule from './enforce-route-security.js';
import {
  handleRouteSecurityMisconfiguration,
  isIamStrictModeEnabled,
  RouteSecurityMisconfigurationError,
} from './iam-strict-mode.js';
import { requireRouteSecurityRule } from './route-security-map.js';
import {
  resetTestStateStore,
  setupTestStateStore,
  teardownTestStateStore,
} from '../test-state.js';

describe('isIamStrictModeEnabled', () => {
  const originalStrict = process.env.ARRIVAL_ATLAS_IAM_STRICT;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalStrict === undefined) {
      delete process.env.ARRIVAL_ATLAS_IAM_STRICT;
    } else {
      process.env.ARRIVAL_ATLAS_IAM_STRICT = originalStrict;
    }
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('defaults to strict in test environment', () => {
    delete process.env.ARRIVAL_ATLAS_IAM_STRICT;
    process.env.NODE_ENV = 'test';
    expect(isIamStrictModeEnabled()).toBe(true);
  });

  it('respects explicit false', () => {
    process.env.ARRIVAL_ATLAS_IAM_STRICT = 'false';
    expect(isIamStrictModeEnabled()).toBe(false);
  });

  it('respects explicit true', () => {
    process.env.ARRIVAL_ATLAS_IAM_STRICT = 'true';
    expect(isIamStrictModeEnabled()).toBe(true);
  });
});

describe('handleRouteSecurityMisconfiguration', () => {
  const originalStrict = process.env.ARRIVAL_ATLAS_IAM_STRICT;

  afterEach(() => {
    if (originalStrict === undefined) {
      delete process.env.ARRIVAL_ATLAS_IAM_STRICT;
    } else {
      process.env.ARRIVAL_ATLAS_IAM_STRICT = originalStrict;
    }
  });

  it('emits ROUTE_UNCLASSIFIED and throws in strict mode', () => {
    process.env.ARRIVAL_ATLAS_IAM_STRICT = 'true';
    const logger = { warn: vi.fn() };

    expect(() =>
      handleRouteSecurityMisconfiguration(logger, 'GET', '/api/unknown')
    ).toThrow(RouteSecurityMisconfigurationError);

    expect(logger.warn).toHaveBeenCalledWith({
      iamEvent: IAMEventType.ROUTE_UNCLASSIFIED,
      method: 'GET',
      path: '/api/unknown',
    });
  });

  it('emits ROUTE_UNCLASSIFIED and continues in non-strict mode', () => {
    process.env.ARRIVAL_ATLAS_IAM_STRICT = 'false';
    const logger = { warn: vi.fn() };

    expect(
      handleRouteSecurityMisconfiguration(logger, 'GET', '/api/unknown')
    ).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith({
      iamEvent: IAMEventType.ROUTE_UNCLASSIFIED,
      method: 'GET',
      path: '/api/unknown',
    });
  });
});

describe('session registry service', () => {
  it('does not expose assertActiveSession', () => {
    expect(
      'assertActiveSession' in sessionRegistryService &&
        typeof (sessionRegistryService as { assertActiveSession?: unknown })
          .assertActiveSession === 'function'
    ).toBe(false);
  });
});

describe('TOKEN_MISMATCH emission', () => {
  beforeEach(async () => {
    process.env.ARRIVAL_ATLAS_AUTH_SECRET = 'arrival-atlas-test-auth-secret';
    setupTestStateStore();
    await resetTestStateStore();
  });

  afterEach(() => {
    teardownTestStateStore();
    vi.restoreAllMocks();
  });

  it('emits TOKEN_MISMATCH when token account drifts from state', async () => {
    const emitSpy = vi.spyOn(iamEvents, 'emitIAMEvent');
    const app = await buildApp();
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: {},
    });
    const { sessionId } = createRes.json() as { sessionId: string };
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
    expect(emitSpy).toHaveBeenCalledWith(
      expect.anything(),
      IAMEventType.TOKEN_MISMATCH,
      expect.objectContaining({
        sessionId,
        tokenAccountId: 'acct_other',
      })
    );
  });
});

describe('applySecurityPipeline strict mode integration', () => {
  const originalStrict = process.env.ARRIVAL_ATLAS_IAM_STRICT;

  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
  });

  afterEach(() => {
    teardownTestStateStore();
    vi.restoreAllMocks();
    if (originalStrict === undefined) {
      delete process.env.ARRIVAL_ATLAS_IAM_STRICT;
    } else {
      process.env.ARRIVAL_ATLAS_IAM_STRICT = originalStrict;
    }
  });

  function createMockReply() {
    return {
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      send() {},
    };
  }

  it('throws in strict mode when route map lookup fails', async () => {
    process.env.ARRIVAL_ATLAS_IAM_STRICT = 'true';
    vi.spyOn(enforceRouteSecurityModule, 'findMatchingRouteRule').mockReturnValue(null);

    const request = {
      method: 'GET',
      routeOptions: { url: '/health' },
      url: '/health',
      log: { warn: vi.fn() },
      headers: {},
    } as never;
    const rule = requireRouteSecurityRule('GET', '/health');

    await expect(
      applySecurityPipeline(request, createMockReply() as never, rule)
    ).rejects.toThrow(RouteSecurityMisconfigurationError);
  });

  it('continues in non-strict mode when route map lookup fails', async () => {
    process.env.ARRIVAL_ATLAS_IAM_STRICT = 'false';
    const warn = vi.fn();
    vi.spyOn(enforceRouteSecurityModule, 'findMatchingRouteRule').mockReturnValue(null);

    const request = {
      method: 'GET',
      routeOptions: { url: '/health' },
      url: '/health',
      log: { warn },
      headers: {},
    } as never;
    const rule = requireRouteSecurityRule('GET', '/health');

    await expect(
      applySecurityPipeline(request, createMockReply() as never, rule)
    ).resolves.toBe(true);

    expect(warn).toHaveBeenCalledWith({
      iamEvent: IAMEventType.ROUTE_UNCLASSIFIED,
      method: 'GET',
      path: '/health',
    });
  });
});
