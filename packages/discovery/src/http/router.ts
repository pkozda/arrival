import type { DiscoveryService } from '../service/discovery-service.js';
import {
  errorResponse,
  mapApplicationError,
  unauthenticatedResponse,
  forbiddenResponse,
} from './errors.js';
import {
  handleCreateSchedule,
  handleDisableSchedule,
  handleEnableSchedule,
  handleGetHealth,
  handleGetRun,
  handleGetStatus,
  handleListSchedules,
  handleProcessNext,
  handleRunSchedule,
} from './handlers.js';
import { resolveRequestId, headerValue } from './request-id.js';
import type { DiscoveryHttpRequest, DiscoveryHttpResponse } from './types.js';
import type {
  DiscoveryAuthenticator,
  DiscoveryAuthorizer,
  DiscoveryPrincipal,
} from './auth/types.js';
import { createPermissionAuthorizer } from './auth/authorizer.js';
import { resolveAdminRoutePolicy } from './auth/policy.js';

export type DiscoveryHttpHandlerOptions = {
  /** Secrets used for error redaction (optional). Never include live admin tokens here unnecessarily — still redacted if present. */
  secrets?: readonly string[];
  /**
   * When true (default), expose POST /worker/process-next for pull-driven hosts.
   */
  enableProcessNext?: boolean;
  /**
   * Provider-neutral authenticator.
   * Required for protected routes unless `allowUnauthenticated` is true.
   */
  authenticator?: DiscoveryAuthenticator;
  /** Defaults to permission-set authorizer. */
  authorizer?: DiscoveryAuthorizer;
  /**
   * Explicit open mode for local/tests only.
   * When true, protected routes skip authentication.
   * Must not be combined with a production bearer deployment.
   */
  allowUnauthenticated?: boolean;
};

export type DiscoveryHttpHandler = {
  handle(request: DiscoveryHttpRequest): Promise<DiscoveryHttpResponse>;
};

/**
 * Framework-free HTTP admin API adapter over DiscoveryService.
 * Authn/authz enforced at this boundary only (E6.3).
 */
export function createDiscoveryHttpHandler(
  service: DiscoveryService,
  options: DiscoveryHttpHandlerOptions = {}
): DiscoveryHttpHandler {
  const secrets = options.secrets ?? [];
  const enableProcessNext = options.enableProcessNext !== false;
  const allowUnauthenticated = options.allowUnauthenticated === true;
  const authenticator = options.authenticator;
  const authorizer = options.authorizer ?? createPermissionAuthorizer();

  if (!allowUnauthenticated && !authenticator) {
    throw new Error(
      'createDiscoveryHttpHandler requires authenticator or allowUnauthenticated: true'
    );
  }

  return {
    async handle(request): Promise<DiscoveryHttpResponse> {
      const requestId = resolveRequestId(request.headers);
      const ctx = { service, requestId, secrets };
      const method = request.method.toUpperCase();
      const path = normalizePath(request.path);

      try {
        const policy = resolveAdminRoutePolicy(method, path);
        if (policy === null) {
          return errorResponse(
            404,
            'NOT_FOUND',
            'Route not found',
            requestId,
            secrets
          );
        }

        let principal: DiscoveryPrincipal | undefined;

        if (policy.kind === 'protected' && !allowUnauthenticated) {
          let authResult;
          try {
            authResult = await authenticator!.authenticate({
              authorizationHeader: headerValue(
                request.headers,
                'authorization'
              ),
            });
          } catch {
            return unauthenticatedResponse(requestId, secrets);
          }
          if (!authResult.ok) {
            return unauthenticatedResponse(requestId, secrets);
          }
          principal = authResult.principal;
          if (!authorizer.authorize(principal, policy.permission)) {
            return forbiddenResponse(requestId, secrets);
          }
        }

        void principal;

        if (method === 'GET' && path === '/health') {
          return await handleGetHealth(ctx);
        }
        if (method === 'GET' && path === '/status') {
          return await handleGetStatus(ctx);
        }
        if (method === 'GET' && path === '/schedules') {
          return await handleListSchedules(ctx);
        }
        if (method === 'POST' && path === '/schedules') {
          return await handleCreateSchedule(ctx, request);
        }

        const enableMatch = path.match(/^\/schedules\/([^/]+)\/enable$/);
        if (method === 'POST' && enableMatch) {
          return await handleEnableSchedule(
            ctx,
            decodeURIComponent(enableMatch[1]!)
          );
        }
        const disableMatch = path.match(/^\/schedules\/([^/]+)\/disable$/);
        if (method === 'POST' && disableMatch) {
          return await handleDisableSchedule(
            ctx,
            decodeURIComponent(disableMatch[1]!)
          );
        }
        const runMatch = path.match(/^\/schedules\/([^/]+)\/run$/);
        if (method === 'POST' && runMatch) {
          return await handleRunSchedule(
            ctx,
            decodeURIComponent(runMatch[1]!)
          );
        }

        const runGet = path.match(/^\/runs\/([^/]+)$/);
        if (method === 'GET' && runGet) {
          return await handleGetRun(ctx, decodeURIComponent(runGet[1]!));
        }

        if (
          enableProcessNext &&
          method === 'POST' &&
          path === '/worker/process-next'
        ) {
          return await handleProcessNext(ctx);
        }

        // Known policy (e.g. process-next disabled) → still 404
        return errorResponse(
          404,
          'NOT_FOUND',
          'Route not found',
          requestId,
          secrets
        );
      } catch (err) {
        return mapApplicationError(err, requestId, secrets);
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
