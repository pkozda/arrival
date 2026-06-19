import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AppContextSchema, globalRegistry } from '@arrival-atlas/core';
import { sendAuthError } from '../auth/auth-error-mapper.js';
import { validateAccountAccess } from '../authz/account-session.guard.js';
import { securedRoute } from '../routing/apply-route-security.js';
import { requireRouteSecurityRule } from '../routing/route-security-map.js';
import { isAtlasUxEnabled } from '../ux-integration.js';
import { accountSessionService, AccountNotFoundError } from '../sessions/account-session.service.js';
import {
  sessionRegistryService,
} from '../sessions/registry/session-registry.service.js';
import { systemStateCoordinator } from '../state/system-state-coordinator.js';

function getUserAgent(request: FastifyRequest): string | undefined {
  const userAgent = request.headers['user-agent'];
  return typeof userAgent === 'string' ? userAgent : undefined;
}

function listModuleDescriptors() {
  return globalRegistry.list().map((module) => ({
    id: module.id,
    name: module.name,
    ...(module.description ? { description: module.description } : {}),
  }));
}

function assertRouteAccountAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  accountId: string
): boolean {
  const identity = request.identity;
  if (!identity) {
    sendAuthError(reply, 'authentication_required');
    return false;
  }

  try {
    validateAccountAccess(
      { sessionId: identity.sessionId, accountId: identity.accountId },
      accountId
    );
  } catch {
    sendAuthError(reply, 'account_forbidden');
    return false;
  }

  if (identity.accountId !== accountId) {
    sendAuthError(reply, 'account_forbidden');
    return false;
  }

  return true;
}

export async function registerSessionLifecycleRoutes(app: FastifyInstance): Promise<void> {
  securedRoute(
    app,
    'get',
    '/api/accounts/:id/sessions',
    requireRouteSecurityRule('GET', '/api/accounts/:id/sessions'),
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!assertRouteAccountAccess(request, reply, id)) {
        return;
      }

      const sessions = await sessionRegistryService.listAccountSessions(id);
      const events = await sessionRegistryService.getAccountEvents(id);

      return { accountId: id, sessions, events };
    }
  );

  securedRoute(
    app,
    'post',
    '/api/accounts/:id/sessions',
    requireRouteSecurityRule('POST', '/api/accounts/:id/sessions'),
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!assertRouteAccountAccess(request, reply, id)) {
        return;
      }

      const body = (request.body ?? {}) as Record<string, unknown>;
      const context = AppContextSchema.parse(body.context ?? {});

      try {
        return await accountSessionService.createLinkedSession({
          accountId: id,
          context,
          modules: listModuleDescriptors(),
          projectionConfig: { uxSnapshotEnabled: isAtlasUxEnabled() },
          metadata: { userAgent: getUserAgent(request) },
        });
      } catch (error) {
        if (error instanceof AccountNotFoundError) {
          return reply.status(404).send({ error: 'Account not found' });
        }
        throw error;
      }
    }
  );

  securedRoute(
    app,
    'post',
    '/api/accounts/:id/sessions/revoke-all',
    requireRouteSecurityRule('POST', '/api/accounts/:id/sessions/revoke-all'),
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!assertRouteAccountAccess(request, reply, id)) {
        return;
      }

      const revoked = await sessionRegistryService.revokeAccountSessions(id);
      return {
        accountId: id,
        revokedCount: revoked.length,
        revokedSessionIds: revoked.map((session) => session.sessionId),
      };
    }
  );

  securedRoute(
    app,
    'post',
    '/api/sessions/:id/revoke',
    requireRouteSecurityRule('POST', '/api/sessions/:id/revoke'),
    async (request, reply) => {
      const { id: targetSessionId } = request.params as { id: string };
      const caller = request.identity!;

      const targetState = await systemStateCoordinator.getState(targetSessionId);
      if (!targetState?.accountId) {
        return reply.status(404).send({ error: 'Session not found' });
      }

      if (caller.accountId !== targetState.accountId) {
        sendAuthError(reply, 'account_forbidden');
        return;
      }

      const revoked = await sessionRegistryService.revokeSession(targetSessionId);
      if (!revoked) {
        return reply.status(404).send({ error: 'Session not found' });
      }

      return {
        sessionId: targetSessionId,
        accountId: revoked.accountId,
        status: revoked.status,
      };
    }
  );
}
