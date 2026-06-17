import type { FastifyRequest } from 'fastify';
import {
  AccountSessionMismatchError,
  resolveAccountFromSession,
} from '../authz/account-context.js';
import type { AuthContext, BuildAuthContextResult } from './auth.types.js';
import {
  authTokenService,
  InvalidAuthTokenError,
} from './auth.token.service.js';

function parseCookie(request: FastifyRequest, name: string): string | undefined {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) {
    return undefined;
  }

  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) {
      return decodeURIComponent(trimmed.slice(name.length + 1));
    }
  }

  return undefined;
}

function extractBearerToken(request: FastifyRequest): string | undefined {
  const authorization = request.headers.authorization;
  if (typeof authorization !== 'string') {
    return parseCookie(request, 'arrival_auth');
  }

  const [scheme, token] = authorization.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return undefined;
  }

  return token;
}

function extractLegacySessionId(request: FastifyRequest): string | undefined {
  const header = request.headers['x-session-id'];
  return typeof header === 'string' && header.length > 0 ? header : undefined;
}

async function resolveSessionAuth(
  sessionId: string,
  authMode: AuthContext['authMode'],
  tokenAuthSubject?: string | null
): Promise<BuildAuthContextResult> {
  try {
    const context = await resolveAccountFromSession(sessionId);
    if (!context) {
      return { status: 'session_not_found' };
    }

    return {
      status: 'ok',
      auth: {
        sessionId: context.sessionId,
        accountId: context.accountId,
        authSubject: authMode === 'token' ? (tokenAuthSubject ?? null) : null,
        authMode,
      },
    };
  } catch (error) {
    if (error instanceof AccountSessionMismatchError) {
      return { status: 'account_mismatch' };
    }
    throw error;
  }
}

export async function buildAuthContext(
  request: FastifyRequest
): Promise<BuildAuthContextResult> {
  const bearerToken = extractBearerToken(request);

  if (bearerToken) {
    try {
      const payload = authTokenService.verifyToken(bearerToken);
      const result = await resolveSessionAuth(
        payload.sessionId,
        'token',
        payload.authSubject
      );
      if (result.status === 'ok') {
        return {
          status: 'ok',
          auth: { ...result.auth, tokenPayload: payload },
        };
      }
      return result;
    } catch (error) {
      if (error instanceof InvalidAuthTokenError) {
        return { status: 'invalid_token' };
      }
      throw error;
    }
  }

  const sessionId = extractLegacySessionId(request);
  if (!sessionId) {
    return { status: 'missing_credential' };
  }

  return resolveSessionAuth(sessionId, 'session');
}
