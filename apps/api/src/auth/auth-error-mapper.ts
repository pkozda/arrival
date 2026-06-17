import type { FastifyReply } from 'fastify';

export type AuthErrorKind =
  | 'missing_credential'
  | 'invalid_token'
  | 'session_not_found'
  | 'account_mismatch'
  | 'identity_drift'
  | 'session_revoked'
  | 'account_forbidden'
  | 'authentication_required'
  | 'insufficient_account_scope'
  | 'unclassified_route';

export type AuthErrorResponse = {
  status: 400 | 401 | 403 | 404 | 500;
  error: string;
  code?: string;
};

const AUTH_ERROR_MAP: Record<AuthErrorKind, AuthErrorResponse> = {
  missing_credential: {
    status: 400,
    error: 'X-Session-Id header is required',
  },
  invalid_token: {
    status: 401,
    error: 'Invalid authentication token',
  },
  session_not_found: {
    status: 404,
    error: 'Session not found',
  },
  account_mismatch: {
    status: 403,
    error: 'Account access forbidden',
  },
  identity_drift: {
    status: 403,
    error: 'Account identity drift detected',
  },
  session_revoked: {
    status: 403,
    error: 'Session revoked',
  },
  account_forbidden: {
    status: 403,
    error: 'Account access forbidden',
  },
  authentication_required: {
    status: 401,
    error: 'Authentication required',
  },
  insufficient_account_scope: {
    status: 403,
    error: 'Account access forbidden',
  },
  unclassified_route: {
    status: 500,
    error: 'Route security misconfiguration',
    code: 'UNCLASSIFIED_ROUTE',
  },
};

export function resolveAuthError(kind: AuthErrorKind): AuthErrorResponse {
  return AUTH_ERROR_MAP[kind];
}

export function sendAuthError(reply: FastifyReply, kind: AuthErrorKind): void {
  const mapped = resolveAuthError(kind);
  reply.status(mapped.status).send({
    error: mapped.error,
    ...(mapped.code ? { code: mapped.code } : {}),
  });
}
