import type { FastifyInstance, FastifyRequest } from 'fastify';
import { systemStateCoordinator } from '../state/system-state-coordinator.js';
import {
  buildUiSnapshot as projectUiSnapshot,
  buildFallbackUiSnapshot,
  type UiSnapshot,
} from '../state/snapshot-projection-engine.js';
import { SnapshotProjectionError } from '../state/snapshot-schema.js';

export type { UiSnapshot };

function getSessionId(request: FastifyRequest): string | undefined {
  const header = request.headers['x-session-id'];
  return typeof header === 'string' && header.length > 0 ? header : undefined;
}

export async function buildUiSnapshot(sessionId: string): Promise<UiSnapshot | null> {
  const state = await systemStateCoordinator.getState(sessionId);
  if (!state) {
    return null;
  }

  return projectUiSnapshot(state);
}

export async function registerUiSnapshotRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/ui-snapshot', async (request, reply) => {
    const sessionId = getSessionId(request);
    if (!sessionId) {
      return reply.status(400).send({ error: 'X-Session-Id header is required' });
    }

    const state = await systemStateCoordinator.getState(sessionId);
    if (!state) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    try {
      return projectUiSnapshot(state);
    } catch (error) {
      if (error instanceof SnapshotProjectionError) {
        return reply.status(500).send(buildFallbackUiSnapshot(state, error.message));
      }
      throw error;
    }
  });
}
