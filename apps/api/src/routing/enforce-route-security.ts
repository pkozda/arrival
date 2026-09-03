import { resolveAuthError } from '../auth/auth-error-mapper.js';
import type { ResolvedIdentity } from '../auth/resolved-identity.js';
import { RouteSecurityMisconfigurationError } from './iam-strict-mode.js';
import { matchRoute } from './match-route.js';
import { RouteSecurityMap } from './route-security-map.js';
import type { RouteSecurityRule } from './route-security.js';

/** @deprecated Use RouteSecurityMisconfigurationError */
export class UnclassifiedRouteError extends RouteSecurityMisconfigurationError {}

export { RouteSecurityMisconfigurationError };

export type EnforceRouteSecurityInput = {
  method: string;
  path: string;
  identity?: ResolvedIdentity;
};

export type EnforceRouteSecurityResult =
  | { ok: true; rule: RouteSecurityRule }
  | {
      ok: false;
      status: 401 | 403 | 500;
      error: string;
      code?: string;
    };

export function findMatchingRouteRule(
  method: string,
  path: string,
  map: readonly RouteSecurityRule[] = RouteSecurityMap
): RouteSecurityRule | null {
  const normalizedMethod = method.toUpperCase();
  return (
    map.find(
      (rule) =>
        rule.method.toUpperCase() === normalizedMethod && matchRoute(rule.path, path)
    ) ?? null
  );
}

export function evaluateRouteAccess(
  identity: ResolvedIdentity | undefined,
  rule: RouteSecurityRule
): EnforceRouteSecurityResult {
  switch (rule.tier) {
    case 'public':
    case 'anonymous-create':
      return { ok: true, rule };

    case 'credential-required':
      if (!identity) {
        const mapped = resolveAuthError('authentication_required');
        return {
          ok: false,
          status: mapped.status as 401,
          error: mapped.error,
        };
      }
      return { ok: true, rule };

    case 'account-required':
      if (!identity) {
        const authRequired = resolveAuthError('authentication_required');
        return {
          ok: false,
          status: authRequired.status as 401,
          error: authRequired.error,
        };
      }
      if (identity.accountId == null) {
        const mapped = resolveAuthError('insufficient_account_scope');
        return {
          ok: false,
          status: mapped.status as 403,
          error: mapped.error,
        };
      }
      return { ok: true, rule };

    case 'ops-token-required':
      // Token validation is performed in applySecurityPipeline (request headers).
      // evaluateRouteAccess only confirms the tier is recognized for map tests.
      return { ok: true, rule };

    default: {
      const exhaustive: never = rule.tier;
      throw new Error(`Unknown route security tier: ${exhaustive}`);
    }
  }
}

export function enforceRouteSecurity(
  input: EnforceRouteSecurityInput
): EnforceRouteSecurityResult {
  const rule = findMatchingRouteRule(input.method, input.path);

  if (!rule) {
    throw new UnclassifiedRouteError(input.method, input.path);
  }

  return evaluateRouteAccess(input.identity, rule);
}
