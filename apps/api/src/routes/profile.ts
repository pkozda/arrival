import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  ProfilePatchSchema,
  ProfileCreateInputSchema,
  ProfileRevisionConflictError,
  ProfileNotFoundError,
  toUIProfileResponse,
} from '@arrivalos/profile';
import { systemStateCoordinator } from '../state/system-state-coordinator.js';

function getSessionId(request: FastifyRequest): string | undefined {
  const header = request.headers['x-session-id'];
  return typeof header === 'string' ? header : undefined;
}

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
  app.post('/api/profile', async (request, reply) => {
    const body = ProfileCreateInputSchema.parse(request.body ?? {});
    const sessionId = getSessionId(request);
    if (!sessionId) {
      return reply.status(400).send({ error: 'X-Session-Id header is required' });
    }

    const result = await systemStateCoordinator.applyMutation({
      type: 'PROFILE_CREATE',
      sessionId,
      input: body,
    });

    return reply.status(201).send(toUIProfileResponse(result.profile));
  });

  app.get('/api/profile', async (request, reply) => {
    const sessionId = getSessionId(request);
    if (!sessionId) {
      return reply.status(400).send({ error: 'X-Session-Id header is required' });
    }

    const state = await systemStateCoordinator.getState(sessionId);
    if (!state?.profileRecord) {
      return reply.status(404).send({ error: 'No profile bound to session' });
    }

    return toUIProfileResponse(state.profileRecord);
  });

  app.patch('/api/profile', async (request, reply) => {
    const sessionId = getSessionId(request);
    if (!sessionId) {
      return reply.status(400).send({ error: 'X-Session-Id header is required' });
    }

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
  });

  app.get('/api/profile/revisions', async (request, reply) => {
    const sessionId = getSessionId(request);
    if (!sessionId) {
      return reply.status(400).send({ error: 'X-Session-Id header is required' });
    }

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
  });
}
