import type { FastifyReply, FastifyRequest } from 'fastify';
import { sendAuthError } from '../auth/auth-error-mapper.js';

export function assertSessionOwnership(
  request: FastifyRequest,
  reply: FastifyReply,
  targetSessionId: string
): boolean {
  const identity = request.identity;
  if (!identity || identity.sessionId !== targetSessionId) {
    sendAuthError(reply, 'account_forbidden');
    return false;
  }
  return true;
}

export function resolveOwnedSessionId(
  request: FastifyRequest,
  reply: FastifyReply,
  requestedSessionId: string | undefined
): string | null {
  const identity = request.identity;
  if (!identity) {
    sendAuthError(reply, 'authentication_required');
    return null;
  }

  const sessionId = requestedSessionId ?? identity.sessionId;
  if (sessionId !== identity.sessionId) {
    sendAuthError(reply, 'account_forbidden');
    return null;
  }

  return sessionId;
}
