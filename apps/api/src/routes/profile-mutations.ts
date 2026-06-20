import type { FastifyInstance } from 'fastify';
import { MutationRequestSchema } from '@arrival-atlas/product-contract';
import { toMutationActor } from '../middleware/auth.middleware.js';
import { securedRoute } from '../routing/apply-route-security.js';
import { requireRouteSecurityRule } from '../routing/route-security-map.js';
import {
  mapProfileMutationErrorToHttp,
  ProfileMutationCommitError,
} from '../state/profile-mutation-errors.js';
import { resolveUserContext } from '../state/profile-mutation-state.js';
import { systemStateCoordinator } from '../state/system-state-coordinator.js';
import { applyUserContextAuthorityHeaders } from './api-contract-headers.js';

export async function registerProfileMutationRoutes(app: FastifyInstance): Promise<void> {
  securedRoute(
    app,
    'post',
    '/api/mutations',
    requireRouteSecurityRule('POST', '/api/mutations'),
    async (request, reply) => {
      const identity = request.identity!;
      const parsed = MutationRequestSchema.safeParse(request.body ?? {});

      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          code: 'INVALID_MUTATION',
          error: parsed.error.message,
        });
      }

      try {
        const result = await systemStateCoordinator.applyMutation({
          type: 'PROFILE_MUTATION_APPLY',
          sessionId: identity.sessionId,
          request: parsed.data,
          actor: toMutationActor(identity),
        });

        return {
          success: true,
          revision: result.revision,
          userContext: result.userContext,
          appliedEventId: result.eventId,
        };
      } catch (error) {
        if (error instanceof ProfileMutationCommitError) {
          const mapped = mapProfileMutationErrorToHttp(
            error.code,
            error.message,
            error.issues
          );
          return reply.status(mapped.statusCode).send(mapped.body);
        }

        request.log.error({ err: error }, 'profile mutation apply failed');
        return reply.status(500).send({
          success: false,
          code: 'INTERNAL_REDUCER_ERROR',
          error: 'Unexpected profile mutation failure',
        });
      }
    }
  );

  securedRoute(
    app,
    'get',
    '/api/user-context',
    requireRouteSecurityRule('GET', '/api/user-context'),
    async (request, reply) => {
      const state = await systemStateCoordinator.getState(request.identity!.sessionId);
      if (!state) {
        return reply.status(404).send({ error: 'Session not found' });
      }

      applyUserContextAuthorityHeaders(reply);
      return resolveUserContext(state);
    }
  );
}
