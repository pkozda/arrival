import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  ProfilePatchSchema,
  ProfileCreateInputSchema,
  ProfileRevisionConflictError,
  ProfileNotFoundError,
  toUIProfileResponse,
} from '@arrivalos/profile';
import { toMutationActor } from '../middleware/auth.middleware.js';
import { securedRoute } from '../routing/apply-route-security.js';
import { requireRouteSecurityRule } from '../routing/route-security-map.js';
import { systemStateCoordinator } from '../state/system-state-coordinator.js';

function getExpectedRevision(request: FastifyRequest): number | undefined {
  const ifMatch = request.headers['if-match'];
  if (typeof ifMatch === 'string') {
    const parsed = parseInt(ifMatch, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  const alt = request.headers['x-profile-revision'];
  if (typeof alt === 'string') {
    const parsed = parseInt(alt, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
}

export async function registerProfileRoutes(app: FastifyInstance): Promise<void> {
  securedRoute(
    app,
    'post',
    '/api/profile',
    requireRouteSecurityRule('POST', '/api/profile'),
    async (request, reply) => {
      const sessionId = request.accountContext!.sessionId;
      const body = ProfileCreateInputSchema.parse(request.body ?? {});

      const result = await systemStateCoordinator.applyMutation({
        type: 'PROFILE_CREATE',
        sessionId,
        input: body,
        actor: request.auth ? toMutationActor(request.auth) : undefined,
      });

      return reply.status(201).send(toUIProfileResponse(result.profile));
    }
  );

  securedRoute(
    app,
    'get',
    '/api/profile',
    requireRouteSecurityRule('GET', '/api/profile'),
    async (request, reply) => {
      const sessionId = request.accountContext!.sessionId;
      const state = await systemStateCoordinator.getState(sessionId);
      if (!state?.profileRecord) {
        return reply.status(404).send({ error: 'No profile bound to session' });
      }

      return toUIProfileResponse(state.profileRecord);
    }
  );

  securedRoute(
    app,
    'patch',
    '/api/profile',
    requireRouteSecurityRule('PATCH', '/api/profile'),
    async (request, reply) => {
      const sessionId = request.accountContext!.sessionId;
      const expectedRevision = getExpectedRevision(request);
      if (expectedRevision === undefined) {
        return reply.status(428).send({
          error: 'If-Match or X-Profile-Revision header is required',
        });
      }

      const state = await systemStateCoordinator.getState(sessionId);
      if (!state?.profileRecord) {
        return reply.status(404).send({ error: 'No profile bound to session' });
      }

      const patch = ProfilePatchSchema.parse(request.body ?? {});

      try {
        const result = await systemStateCoordinator.applyMutation({
          type: 'PROFILE_UPDATE',
          sessionId,
          patch,
          expectedRevision,
          actor: request.auth ? toMutationActor(request.auth) : undefined,
        });
        return toUIProfileResponse(result.profile);
      } catch (error) {
        if (error instanceof ProfileRevisionConflictError) {
          return reply.status(409).send({
            error: error.message,
            code: error.code,
            expectedRevision: error.expectedRevision,
            actualRevision: error.actualRevision,
          });
        }
        throw error;
      }
    }
  );

  securedRoute(
    app,
    'get',
    '/api/profile/revisions',
    requireRouteSecurityRule('GET', '/api/profile/revisions'),
    async (request, reply) => {
      const sessionId = request.accountContext!.sessionId;
      const state = await systemStateCoordinator.getState(sessionId);
      if (!state?.profileRecord) {
        return reply.status(404).send({ error: 'No profile bound to session' });
      }

      try {
        const revisions = state.profileRevisions
          .filter((revision) => revision.profileId === state.profileRecord!.id)
          .sort((a, b) => b.revision - a.revision);

        if (revisions.length === 0) {
          throw new ProfileNotFoundError(state.profileRecord.id);
        }

        return {
          profileId: state.profileRecord.id,
          revisions: revisions.map((r) => ({
            id: r.id,
            revision: r.revision,
            schemaVersion: r.schemaVersion,
            changedFields: r.changedFields,
            changedBy: r.changedBy,
            moduleId: r.moduleId,
            createdAt: r.createdAt,
          })),
        };
      } catch (error) {
        if (error instanceof ProfileNotFoundError) {
          return reply.status(404).send({ error: error.message });
        }
        throw error;
      }
    }
  );
}
