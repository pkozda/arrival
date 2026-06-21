import type { FastifyInstance } from 'fastify';
import { securedRoute } from '../routing/apply-route-security.js';
import { requireRouteSecurityRule } from '../routing/route-security-map.js';
import { systemStateCoordinator } from '../state/system-state-coordinator.js';
import { resolveUserContext } from '../state/profile-mutation-state.js';
import { buildEconomicRealityPlanFromState } from '../state/economic-reality-plan-projection.js';
import {
  buildEconomicRealityEventFromAction,
  buildEconomicRealityModuleEnteredEvent,
} from '../state/economic-reality-event-builder.js';
import { z } from 'zod';

const ExecuteEconomicActionBodySchema = z.object({
  actionId: z.string().min(1),
  deterministicHash: z.string().min(1),
});

const EmitEconomicRealityEventBodySchema = z.object({
  type: z.enum(['MODULE_ENTERED']),
  deterministicHash: z.string().min(1),
});

export async function registerEconomicRealityActionRoutes(app: FastifyInstance): Promise<void> {
  securedRoute(
    app,
    'post',
    '/api/modules/economic-reality/action/execute',
    requireRouteSecurityRule('POST', '/api/modules/economic-reality/action/execute'),
    async (request, reply) => {
      const sessionId = request.identity!.sessionId;
      const state = await systemStateCoordinator.getState(sessionId);
      if (!state) {
        return reply.status(404).send({ error: 'Session not found', code: 'ECONOMIC_CONTEXT_INVALID' });
      }

      const userContext = resolveUserContext(state);
      if (!userContext.profile) {
        return reply.status(400).send({
          error: 'UserContext profile required for economic action execution',
          code: 'ECONOMIC_CONTEXT_INVALID',
        });
      }

      const parsed = ExecuteEconomicActionBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid economic action execution payload',
          code: 'ECONOMIC_CONTEXT_INVALID',
        });
      }

      const plan = buildEconomicRealityPlanFromState(state, request.id);
      if (plan.meta.deterministicHash !== parsed.data.deterministicHash) {
        return reply.status(409).send({
          error: 'Action set is stale relative to the current economic plan',
          code: 'E_STALE_ACTION_SET',
        });
      }

      const action = plan.actionSet.actions.find((entry) => entry.id === parsed.data.actionId);
      if (!action) {
        return reply.status(404).send({
          error: 'Action not found in current economic action set',
          code: 'E_STALE_ACTION_SET',
        });
      }

      const previousDeterministicHash = plan.meta.deterministicHash;
      const event = buildEconomicRealityEventFromAction({
        action,
        contextHash: previousDeterministicHash,
        timestamp: Date.now(),
      });

      const mutationResult = await systemStateCoordinator.applyMutation({
        type: 'ECONOMIC_REALITY_EVENT_APPEND',
        sessionId,
        event,
      });

      const refreshedPlan = buildEconomicRealityPlanFromState(mutationResult.state, request.id);

      return {
        accepted: true,
        actionId: action.id,
        previousDeterministicHash,
        deterministicHash: refreshedPlan.meta.deterministicHash,
        planChanged: refreshedPlan.meta.deterministicHash !== previousDeterministicHash,
      };
    }
  );

  securedRoute(
    app,
    'post',
    '/api/modules/economic-reality/events',
    requireRouteSecurityRule('POST', '/api/modules/economic-reality/events'),
    async (request, reply) => {
      const sessionId = request.identity!.sessionId;
      const state = await systemStateCoordinator.getState(sessionId);
      if (!state) {
        return reply.status(404).send({ error: 'Session not found', code: 'ECONOMIC_CONTEXT_INVALID' });
      }

      const userContext = resolveUserContext(state);
      if (!userContext.profile) {
        return reply.status(400).send({
          error: 'UserContext profile required for economic reality events',
          code: 'ECONOMIC_CONTEXT_INVALID',
        });
      }

      const parsed = EmitEconomicRealityEventBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid economic reality event payload',
          code: 'ECONOMIC_CONTEXT_INVALID',
        });
      }

      const plan = buildEconomicRealityPlanFromState(state, request.id);
      if (plan.meta.deterministicHash !== parsed.data.deterministicHash) {
        return reply.status(409).send({
          error: 'Economic plan is stale relative to the current session',
          code: 'E_STALE_ACTION_SET',
        });
      }

      const previousDeterministicHash = plan.meta.deterministicHash;
      const event = buildEconomicRealityModuleEnteredEvent({
        contextHash: previousDeterministicHash,
        timestamp: Date.now(),
      });

      const mutationResult = await systemStateCoordinator.applyMutation({
        type: 'ECONOMIC_REALITY_EVENT_APPEND',
        sessionId,
        event,
      });

      const refreshedPlan = buildEconomicRealityPlanFromState(mutationResult.state, request.id);

      return {
        accepted: true,
        eventType: event.type,
        previousDeterministicHash,
        deterministicHash: refreshedPlan.meta.deterministicHash,
        planChanged: refreshedPlan.meta.deterministicHash !== previousDeterministicHash,
      };
    }
  );
}
