import type { FastifyInstance, FastifyReply } from 'fastify';
import { isDevToolsEnabled } from '../dev/is-dev-tools-enabled.js';
import {
  clearAllPersistedDevState,
  deleteSessionPersistedState,
} from '../dev/reset-local-state.js';
import { securedRoute } from '../routing/apply-route-security.js';
import { requireRouteSecurityRule } from '../routing/route-security-map.js';

function devToolsUnavailable(reply: FastifyReply) {
  return reply.status(404).send({ error: 'Not found' });
}

export async function registerDevToolsRoutes(app: FastifyInstance): Promise<void> {
  securedRoute(
    app,
    'post',
    '/api/dev/reset-user-data',
    requireRouteSecurityRule('POST', '/api/dev/reset-user-data'),
    async (request, reply) => {
      if (!isDevToolsEnabled()) {
        return devToolsUnavailable(reply);
      }

      const sessionId = request.identity!.sessionId;
      const deleted = await deleteSessionPersistedState(sessionId);

      return {
        scope: 'session',
        sessionId,
        deleted,
      };
    }
  );

  securedRoute(
    app,
    'post',
    '/api/dev/reset-all-state',
    requireRouteSecurityRule('POST', '/api/dev/reset-all-state'),
    async (_request, reply) => {
      if (!isDevToolsEnabled()) {
        return devToolsUnavailable(reply);
      }

      await clearAllPersistedDevState();

      return {
        scope: 'all',
        cleared: true,
      };
    }
  );
}
