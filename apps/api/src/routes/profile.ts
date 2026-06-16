import type { FastifyInstance, FastifyRequest } from 'fastify';
import { updateSessionContext } from '@arrivalos/core';
import {
  ProfilePatchSchema,
  ProfileCreateInputSchema,
  ProfileRevisionConflictError,
  ProfileNotFoundError,
  toUIProfileResponse,
} from '@arrivalos/profile';
import { profileEngine } from '../profile-runtime.js';
import { recordSnapshotMutation } from '../snapshot-version-store.js';

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

    const profile = await profileEngine.createProfile(body);

    if (sessionId) {
      await profileEngine.bindSession(sessionId, profile.id);
      updateSessionContext(sessionId, { profileId: profile.id });
      recordSnapshotMutation(sessionId, `profile-create:${profile.id}`);
    }

    return reply.status(201).send(toUIProfileResponse(profile));
  });

  app.get('/api/profile', async (request, reply) => {
    const sessionId = getSessionId(request);
    if (!sessionId) {
      return reply.status(400).send({ error: 'X-Session-Id header is required' });
    }

    const profile = await profileEngine.getProfileBySession(sessionId);
    if (!profile) {
      return reply.status(404).send({ error: 'No profile bound to session' });
    }

    return toUIProfileResponse(profile);
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

    const profile = await profileEngine.getProfileBySession(sessionId);
    if (!profile) {
      return reply.status(404).send({ error: 'No profile bound to session' });
    }

    const patch = ProfilePatchSchema.parse(request.body ?? {});

    try {
      const updated = await profileEngine.updateProfile(
        profile.id,
        patch,
        expectedRevision
      );
      recordSnapshotMutation(sessionId, `profile-update:${profile.id}:${updated.revision}`);
      return toUIProfileResponse(updated);
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

    const profile = await profileEngine.getProfileBySession(sessionId);
    if (!profile) {
      return reply.status(404).send({ error: 'No profile bound to session' });
    }

    try {
      const revisions = await profileEngine.listRevisions(profile.id);
      return {
        profileId: profile.id,
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
