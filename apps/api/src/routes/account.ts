import type { FastifyInstance } from 'fastify';
import { sendAuthError } from '../auth/auth-error-mapper.js';
import {
  accountClaimService,
  SessionNotFoundError,
} from '../account/account-claim.service.js';
import { securedRoute } from '../routing/apply-route-security.js';
import { requireRouteSecurityRule } from '../routing/route-security-map.js';

export async function registerAccountRoutes(app: FastifyInstance): Promise<void> {
  securedRoute(
    app,
    'post',
    '/api/account/claim',
    requireRouteSecurityRule('POST', '/api/account/claim'),
    async (request, reply) => {
      const auth = request.auth!;

      try {
        return await accountClaimService.claimSession(auth.sessionId, {
          userAgent: typeof request.headers['user-agent'] === 'string'
            ? request.headers['user-agent']
            : undefined,
        });
      } catch (error) {
        if (error instanceof SessionNotFoundError) {
          sendAuthError(reply, 'session_not_found');
          return;
        }
        throw error;
      }
    }
  );
}
