import type { StrategyRegistry } from '../registry/strategy-registry.js';
import { errorResponse } from '../http/errors.js';
import { resolveRequestId, headerValue } from '../http/request-id.js';
import type { DiscoveryHttpRequest, DiscoveryHttpResponse } from '../http/types.js';
import type { DiscoveryUserService } from './discovery-user-service.js';
import type { DiscoveryUserAuthenticator } from './types.js';
import {
  handleCreateProfile,
  handleDisableProfile,
  handleEnableProfile,
  handleGetProfile,
  handleGetProfileRunSummary,
  handleGetResult,
  handleListProfiles,
  handleListResults,
  handleRunProfileNow,
  handleUpdateProfile,
  handleUpdateResultUserState,
  mapUserApiError,
} from './handlers.js';
import { unauthenticatedResponse } from '../http/errors.js';

export type DiscoveryUserHttpHandlerOptions = {
  secrets?: readonly string[];
  authenticator?: DiscoveryUserAuthenticator;
  allowUnauthenticated?: boolean;
  /** Required for profile create validation. */
  registry: StrategyRegistry;
};

export type DiscoveryUserHttpHandler = {
  handle(request: DiscoveryHttpRequest): Promise<DiscoveryHttpResponse>;
};

/**
 * Framework-free user-facing discovery API (E9.1).
 * Distinct from the E6.2/E6.3 operator admin API.
 */
export function createDiscoveryUserHttpHandler(
  service: DiscoveryUserService,
  options: DiscoveryUserHttpHandlerOptions
): DiscoveryUserHttpHandler {
  const secrets = options.secrets ?? [];
  const allowUnauthenticated = options.allowUnauthenticated === true;
  const authenticator = options.authenticator;
  const registry = options.registry;

  if (!allowUnauthenticated && !authenticator) {
    throw new Error(
      'createDiscoveryUserHttpHandler requires authenticator or allowUnauthenticated: true'
    );
  }

  return {
    async handle(request): Promise<DiscoveryHttpResponse> {
      const requestId = resolveRequestId(request.headers);
      const method = request.method.toUpperCase();
      const path = normalizePath(request.path);

      let principal;
      if (allowUnauthenticated) {
        principal = { userId: 'anonymous', authenticationMethod: 'bearer' as const };
      } else {
        let authResult;
        try {
          authResult = await authenticator!.authenticate({
            authorizationHeader: headerValue(request.headers, 'authorization'),
          });
        } catch {
          return unauthenticatedResponse(requestId, secrets);
        }
        if (!authResult.ok) {
          return unauthenticatedResponse(requestId, secrets);
        }
        principal = authResult.principal;
      }

      const ctx = { service, registry, requestId, secrets, principal };

      try {
        if (method === 'GET' && path === '/user/profiles') {
          return await handleListProfiles(ctx);
        }
        if (method === 'POST' && path === '/user/profiles') {
          return await handleCreateProfile(ctx, request);
        }

        const profileMatch = path.match(/^\/user\/profiles\/([^/]+)$/);
        if (method === 'GET' && profileMatch) {
          return await handleGetProfile(
            ctx,
            decodeURIComponent(profileMatch[1]!)
          );
        }
        if (method === 'PUT' && profileMatch) {
          return await handleUpdateProfile(
            ctx,
            decodeURIComponent(profileMatch[1]!),
            request
          );
        }

        const enableMatch = path.match(/^\/user\/profiles\/([^/]+)\/enable$/);
        if (method === 'POST' && enableMatch) {
          return await handleEnableProfile(
            ctx,
            decodeURIComponent(enableMatch[1]!)
          );
        }
        const disableMatch = path.match(/^\/user\/profiles\/([^/]+)\/disable$/);
        if (method === 'POST' && disableMatch) {
          return await handleDisableProfile(
            ctx,
            decodeURIComponent(disableMatch[1]!)
          );
        }

        const resultsMatch = path.match(/^\/user\/profiles\/([^/]+)\/results$/);
        if (method === 'GET' && resultsMatch) {
          return await handleListResults(
            ctx,
            decodeURIComponent(resultsMatch[1]!)
          );
        }

        const resultMatch = path.match(
          /^\/user\/profiles\/([^/]+)\/results\/([^/]+)$/
        );
        if (method === 'GET' && resultMatch) {
          return await handleGetResult(
            ctx,
            decodeURIComponent(resultMatch[1]!),
            decodeURIComponent(resultMatch[2]!)
          );
        }

        const stateMatch = path.match(
          /^\/user\/profiles\/([^/]+)\/results\/([^/]+)\/user-state$/
        );
        if (method === 'PATCH' && stateMatch) {
          return await handleUpdateResultUserState(
            ctx,
            decodeURIComponent(stateMatch[1]!),
            decodeURIComponent(stateMatch[2]!),
            request
          );
        }

        const summaryMatch = path.match(/^\/user\/profiles\/([^/]+)\/run-summary$/);
        if (method === 'GET' && summaryMatch) {
          return await handleGetProfileRunSummary(
            ctx,
            decodeURIComponent(summaryMatch[1]!)
          );
        }

        const runNowMatch = path.match(/^\/user\/profiles\/([^/]+)\/run-now$/);
        if (method === 'POST' && runNowMatch) {
          return await handleRunProfileNow(
            ctx,
            decodeURIComponent(runNowMatch[1]!)
          );
        }

        return errorResponse(404, 'NOT_FOUND', 'Route not found', requestId, secrets);
      } catch (err) {
        return mapUserApiError(err, requestId, secrets);
      }
    },
  };
}

function normalizePath(path: string): string {
  if (!path) return '/';
  const q = path.indexOf('?');
  const bare = q >= 0 ? path.slice(0, q) : path;
  if (bare.length > 1 && bare.endsWith('/')) {
    return bare.slice(0, -1);
  }
  return bare.startsWith('/') ? bare : `/${bare}`;
}
