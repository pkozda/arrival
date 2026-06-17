import type { FastifyInstance } from 'fastify';
import { securedRoute } from '../routing/apply-route-security.js';
import { requireRouteSecurityRule } from '../routing/route-security-map.js';
import { entitlementService } from '../entitlements/entitlement.service.js';
import { systemStateCoordinator } from '../state/system-state-coordinator.js';
import {
  buildUiSnapshot as projectUiSnapshot,
  buildFallbackUiSnapshot,
  type UiSnapshot,
} from '../state/snapshot-projection-engine.js';
import { SnapshotProjectionError } from '../state/snapshot-schema.js';

export type { UiSnapshot };

export async function buildUiSnapshot(sessionId: string): Promise<UiSnapshot | null> {
  const state = await systemStateCoordinator.getState(sessionId);
  if (!state) {
    return null;
  }

  const entitlements =
    state.accountId !== null
      ? await entitlementService.getEntitlements(state.accountId)
      : null;

  return projectUiSnapshot(state, { entitlements });
}

export async function registerUiSnapshotRoutes(app: FastifyInstance): Promise<void> {
  securedRoute(
    app,
    'get',
    '/api/ui-snapshot',
    requireRouteSecurityRule('GET', '/api/ui-snapshot'),
    async (request, reply) => {
      const sessionId = request.identity!.sessionId;
      const state = await systemStateCoordinator.getState(sessionId);
      if (!state) {
        return reply.status(404).send({ error: 'Session not found' });
      }

      try {
        const entitlements =
          state.accountId !== null
            ? await entitlementService.getEntitlements(state.accountId)
            : null;
        return projectUiSnapshot(state, { entitlements });
      } catch (error) {
        if (error instanceof SnapshotProjectionError) {
          return reply.status(500).send(buildFallbackUiSnapshot(state, error.message));
        }
        throw error;
      }
    }
  );
}
