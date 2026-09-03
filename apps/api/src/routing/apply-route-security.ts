import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { sendAuthError } from '../auth/auth-error-mapper.js';
import { buildResolvedIdentity } from '../auth/build-resolved-identity.js';
import { buildAuthContext } from '../auth/auth.context.js';
import { hasLegacySessionCredential } from '../auth/legacy-auth-adapter.js';
import type { AuthContext } from '../auth/auth.types.js';
import type { ResolvedIdentity } from '../auth/resolved-identity.js';
import { evaluateOpsTokenAccess } from '../auth/ops-token.js';
import { evaluateTokenAccountSemantics } from '../auth/token-account-semantics.js';
import { AccountAccessForbiddenError, validateAccountAccess } from '../authz/account-session.guard.js';
import { emitIAMEvent, IAMEventType, type IAMEventLogger } from '../observability/iam-events.js';
import {
  ensureSessionRegistered,
  touchSessionLastSeen,
} from '../sessions/session-lifecycle.service.js';
import { sessionRegistryService } from '../sessions/registry/session-registry.service.js';
import { systemStateCoordinator } from '../state/system-state-coordinator.js';
import {
  evaluateRouteAccess,
  findMatchingRouteRule,
  type EnforceRouteSecurityResult,
} from './enforce-route-security.js';
import { handleRouteSecurityMisconfiguration } from './iam-strict-mode.js';
import type { RouteSecurityRule } from './route-security.js';

function resolveActiveRouteRule(
  request: FastifyRequest,
  registeredRule: RouteSecurityRule
): RouteSecurityRule {
  const routePath = request.routeOptions.url ?? request.url;
  const mapRule = findMatchingRouteRule(request.method, routePath);

  const registrationMismatch =
    registeredRule.method.toUpperCase() !== request.method.toUpperCase() ||
    registeredRule.path !== routePath;
  const mapMissing = mapRule === null;
  const mapMismatch =
    mapRule !== null &&
    (mapRule.path !== registeredRule.path ||
      mapRule.method.toUpperCase() !== registeredRule.method.toUpperCase());

  if (mapMissing || registrationMismatch || mapMismatch) {
    handleRouteSecurityMisconfiguration(request.log, request.method, routePath);
  }

  return mapRule ?? registeredRule;
}

async function assertSessionNotRevoked(
  reply: FastifyReply,
  sessionId: string
): Promise<boolean> {
  const record = await sessionRegistryService.getSessionRecord(sessionId);
  if (record?.status === 'revoked') {
    sendAuthError(reply, 'session_revoked');
    return false;
  }
  return true;
}

function getTargetAccountId(request: FastifyRequest): string | undefined {
  const header = request.headers['x-account-id'];
  return typeof header === 'string' && header.length > 0 ? header : undefined;
}

function getUserAgent(request: FastifyRequest): string | undefined {
  const userAgent = request.headers['user-agent'];
  return typeof userAgent === 'string' ? userAgent : undefined;
}

export function hasAuthCredential(request: FastifyRequest): boolean {
  const authorization = request.headers.authorization;
  if (typeof authorization === 'string' && authorization.toLowerCase().startsWith('bearer ')) {
    return true;
  }

  const cookieHeader = request.headers.cookie;
  if (cookieHeader?.includes('arrival_auth=')) {
    return true;
  }

  return hasLegacySessionCredential(request);
}

export function sendRouteSecurityError(
  reply: FastifyReply,
  denied: Extract<EnforceRouteSecurityResult, { ok: false }>
): void {
  if (denied.status === 401) {
    sendAuthError(reply, 'authentication_required');
    return;
  }

  if (denied.status === 403) {
    if (denied.code === 'OPS_FORBIDDEN') {
      sendAuthError(reply, 'ops_forbidden');
      return;
    }
    sendAuthError(reply, 'insufficient_account_scope');
    return;
  }

  sendAuthError(reply, 'unclassified_route');
}

export function emitIdentityObservabilityEvents(
  logger: IAMEventLogger,
  auth: AuthContext,
  identity: ResolvedIdentity
): void {
  if (auth.authMode === 'session') {
    emitIAMEvent(logger, IAMEventType.LEGACY_USED, {
      sessionId: identity.sessionId,
    });
  }

  if (identity.accountId !== null && identity.source === 'legacy') {
    emitIAMEvent(logger, IAMEventType.AUTH_SUBJECT_NULL, {
      sessionId: identity.sessionId,
      accountId: identity.accountId,
    });
  }
}

function enforceTokenAccountIdentity(
  request: FastifyRequest,
  reply: FastifyReply,
  auth: AuthContext,
  identity: NonNullable<FastifyRequest['identity']>
): boolean {
  const tokenPayload = auth.tokenPayload;
  if (!tokenPayload) {
    return true;
  }

  const semantics = evaluateTokenAccountSemantics({
    tokenAccountId: tokenPayload.accountId,
    stateAccountId: identity.stateAccountId ?? identity.accountId,
  });

  if (!semantics.ok) {
    emitIAMEvent(request.log, IAMEventType.TOKEN_MISMATCH, {
      sessionId: identity.sessionId,
      tokenAccountId: tokenPayload.accountId,
      stateAccountId: identity.stateAccountId ?? identity.accountId,
    });
    sendAuthError(reply, 'identity_drift');
    return false;
  }

  if (semantics.ignoredTokenAccount) {
    emitIAMEvent(request.log, IAMEventType.TOKEN_ACCOUNT_IGNORED, {
      sessionId: identity.sessionId,
      stateAccountId: identity.stateAccountId ?? identity.accountId,
    });
  }

  return true;
}

async function applyAccountAuthorization(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<boolean> {
  const identity = request.identity;
  if (!identity) {
    sendAuthError(reply, 'authentication_required');
    return false;
  }

  const context = {
    sessionId: identity.sessionId,
    accountId: identity.accountId,
  };

  try {
    validateAccountAccess(context, getTargetAccountId(request));

    const record = await sessionRegistryService.getSessionRecord(context.sessionId);
    if (record?.status === 'revoked') {
      sendAuthError(reply, 'session_revoked');
      return false;
    }

    if (context.accountId !== null && record) {
      if (record.accountId !== context.accountId) {
        sendAuthError(reply, 'session_revoked');
        return false;
      }
    }

    return true;
  } catch (error) {
    if (error instanceof AccountAccessForbiddenError) {
      sendAuthError(reply, 'account_forbidden');
      return false;
    }
    throw error;
  }
}

async function applySessionLifecycle(request: FastifyRequest): Promise<void> {
  const identity = request.identity;
  if (!identity || identity.accountId === null) {
    return;
  }

  const registration = await ensureSessionRegistered({
    sessionId: identity.sessionId,
    accountId: identity.accountId,
    userAgent: getUserAgent(request),
  });

  if (registration.created && process.env.NODE_ENV !== 'production') {
    emitIAMEvent(request.log, IAMEventType.REGISTRY_BACKFILL, {
      sessionId: identity.sessionId,
      accountId: identity.accountId,
    });
  }

  await touchSessionLastSeen({
    sessionId: identity.sessionId,
    accountId: identity.accountId,
  });
}

export async function applySecurityPipeline(
  request: FastifyRequest,
  reply: FastifyReply,
  rule: RouteSecurityRule
): Promise<boolean> {
  const activeRule = resolveActiveRouteRule(request, rule);

  if (activeRule.tier === 'public' || activeRule.tier === 'anonymous-create') {
    const access = evaluateRouteAccess(undefined, activeRule);
    if (!access.ok) {
      sendRouteSecurityError(reply, access);
      return false;
    }
    return true;
  }

  if (activeRule.tier === 'ops-token-required') {
    const opsAccess = evaluateOpsTokenAccess(request);
    if (!opsAccess.ok) {
      sendRouteSecurityError(reply, {
        ok: false,
        status: 403,
        error: 'Ops access forbidden',
        code: 'OPS_FORBIDDEN',
      });
      return false;
    }
    return true;
  }

  const authResult = await buildAuthContext(request);

  if (authResult.status === 'invalid_token') {
    sendAuthError(reply, 'invalid_token');
    return false;
  }

  if (authResult.status === 'missing_credential') {
    sendAuthError(reply, 'authentication_required');
    return false;
  }

  if (authResult.status === 'session_not_found') {
    sendAuthError(reply, 'session_not_found');
    return false;
  }

  if (authResult.status === 'account_mismatch') {
    sendAuthError(reply, 'account_mismatch');
    return false;
  }

  const auth = authResult.auth;

  const state = await systemStateCoordinator.getState(auth.sessionId);
  request.identity = await buildResolvedIdentity(auth, state);

  emitIdentityObservabilityEvents(request.log, auth, request.identity);

  if (!(await assertSessionNotRevoked(reply, auth.sessionId))) {
    return false;
  }

  if (!enforceTokenAccountIdentity(request, reply, auth, request.identity)) {
    return false;
  }

  const access = evaluateRouteAccess(request.identity, activeRule);
  if (!access.ok) {
    sendRouteSecurityError(reply, access);
    return false;
  }

  if (!(await applyAccountAuthorization(request, reply))) {
    return false;
  }

  await applySessionLifecycle(request);
  return true;
}

export function wrapRouteWithSecurity(
  rule: RouteSecurityRule,
  handler: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown> | unknown
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const proceed = await applySecurityPipeline(request, reply, rule);
    if (!proceed) {
      return;
    }
    return handler(request, reply);
  };
}

export type SecuredHttpMethod = 'get' | 'post' | 'patch';

export function securedRoute(
  app: {
    get: FastifyInstance['get'];
    post: FastifyInstance['post'];
    patch: FastifyInstance['patch'];
  },
  method: SecuredHttpMethod,
  path: string,
  rule: RouteSecurityRule,
  handler: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown> | unknown
): void {
  app[method](path, wrapRouteWithSecurity(rule, handler));
}
