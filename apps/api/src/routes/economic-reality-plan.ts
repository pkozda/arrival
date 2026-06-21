import type { FastifyInstance } from 'fastify';
import { securedRoute } from '../routing/apply-route-security.js';
import { requireRouteSecurityRule } from '../routing/route-security-map.js';
import { systemStateCoordinator } from '../state/system-state-coordinator.js';
import { resolveUserContext } from '../state/profile-mutation-state.js';
import { buildEconomicRealityPlanFromState } from '../state/economic-reality-plan-projection.js';
import {
  validateEconomicRealityPlanResponse,
  EconomicRealityPlanValidationError,
} from '../economic-reality-plan-validation.js';
import { applyEconomicRealityPlanAuthorityHeaders } from './api-contract-headers.js';
import { EconomicRealityPlanError } from '@arrival-atlas/modules/economic-reality';

export async function registerEconomicRealityPlanRoutes(app: FastifyInstance): Promise<void> {
  securedRoute(
    app,
    'get',
    '/api/modules/economic-reality/plan',
    requireRouteSecurityRule('GET', '/api/modules/economic-reality/plan'),
    async (request, reply) => {
      const state = await systemStateCoordinator.getState(request.identity!.sessionId);
      if (!state) {
        return reply.status(404).send({ error: 'Session not found', code: 'ECONOMIC_CONTEXT_INVALID' });
      }

      const userContext = resolveUserContext(state);
      if (!userContext.profile) {
        return reply.status(400).send({
          error: 'UserContext profile required for economic reality planning',
          code: 'ECONOMIC_CONTEXT_INVALID',
        });
      }

      try {
        const response = validateEconomicRealityPlanResponse(
          buildEconomicRealityPlanFromState(state, request.id)
        );
        applyEconomicRealityPlanAuthorityHeaders(reply);
        return response;
      } catch (error) {
        if (error instanceof EconomicRealityPlanValidationError) {
          request.log.error({ err: error }, 'Economic reality plan validation failed');
          return reply.status(500).send({
            error: 'Economic reality plan validation failed',
            code: 'PLAN_BUILD_FAILED',
          });
        }

        if (error instanceof EconomicRealityPlanError) {
          const status = error.code === 'ECONOMIC_CONTEXT_INVALID' ? 400 : 422;
          return reply.status(status).send({
            error: error.message,
            code: error.code,
          });
        }

        request.log.error({ err: error }, 'Economic reality plan generation failed');
        return reply.status(500).send({
          error: 'Failed to generate economic reality plan',
          code: 'PLAN_BUILD_FAILED',
        });
      }
    }
  );
}
