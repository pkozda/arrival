import type { FastifyInstance } from 'fastify';
import { securedRoute } from '../routing/apply-route-security.js';
import { requireRouteSecurityRule } from '../routing/route-security-map.js';
import { systemStateCoordinator } from '../state/system-state-coordinator.js';
import { resolveUserContext } from '../state/profile-mutation-state.js';
import { buildLifeEventPlanFromState } from '../state/life-event-plan-projection.js';
import { validateLifeEventPlanResponse, LifeEventPlanValidationError } from '../life-event-plan-validation.js';
import { applyLifeEventPlanAuthorityHeaders } from './api-contract-headers.js';

export async function registerLifeEventPlanRoutes(app: FastifyInstance): Promise<void> {
  securedRoute(
    app,
    'get',
    '/api/modules/life-event/plan',
    requireRouteSecurityRule('GET', '/api/modules/life-event/plan'),
    async (request, reply) => {
      const state = await systemStateCoordinator.getState(request.identity!.sessionId);
      if (!state) {
        return reply.status(404).send({ error: 'Session not found' });
      }

      const userContext = resolveUserContext(state);
      if (!userContext.profile) {
        return reply.status(400).send({ error: 'UserContext profile required for life event planning' });
      }

      try {
        const plan = validateLifeEventPlanResponse(buildLifeEventPlanFromState(state));
        applyLifeEventPlanAuthorityHeaders(reply);
        return plan;
      } catch (error) {
        if (error instanceof LifeEventPlanValidationError) {
          request.log.error({ err: error }, 'Life event plan validation failed');
        } else {
          request.log.error({ err: error }, 'Life event plan generation failed');
        }

        return reply.status(500).send({ error: 'Failed to generate life event plan' });
      }
    }
  );
}
