import type { FastifyInstance } from 'fastify';
import { securedRoute } from '../routing/apply-route-security.js';
import { requireRouteSecurityRule } from '../routing/route-security-map.js';
import { systemStateCoordinator } from '../state/system-state-coordinator.js';
import { buildProfileInsightsFromState } from '../state/profile-insights-projection.js';
import { applyProfileInsightsAuthorityHeaders } from './api-contract-headers.js';

export async function registerProfileInsightsRoutes(app: FastifyInstance): Promise<void> {
  securedRoute(
    app,
    'get',
    '/api/profile-insights',
    requireRouteSecurityRule('GET', '/api/profile-insights'),
    async (request, reply) => {
      const state = await systemStateCoordinator.getState(request.identity!.sessionId);
      if (!state) {
        return reply.status(404).send({ error: 'Session not found' });
      }

      applyProfileInsightsAuthorityHeaders(reply);
      return buildProfileInsightsFromState(state);
    }
  );
}
