import type { FastifyInstance } from 'fastify';
import { getDiscoveryOpsHealth } from '../discovery/discovery-ops-health.js';
import { getDiscoveryOpsRunDiagnostics } from '../discovery/discovery-ops-run-diagnostics.js';
import { executeDiscoveryHostTick } from '../discovery/discovery-host-tick.js';
import { securedRoute } from '../routing/apply-route-security.js';
import { requireRouteSecurityRule } from '../routing/route-security-map.js';

/**
 * Operator/system Discovery endpoints — not part of the user-facing Discovery API.
 */
export async function registerDiscoveryOpsRoutes(app: FastifyInstance): Promise<void> {
  securedRoute(
    app,
    'get',
    '/api/ops/discovery/health',
    requireRouteSecurityRule('GET', '/api/ops/discovery/health'),
    async () => getDiscoveryOpsHealth()
  );

  securedRoute(
    app,
    'get',
    '/api/ops/discovery/runs/:runId/diagnostics',
    requireRouteSecurityRule('GET', '/api/ops/discovery/runs/:runId/diagnostics'),
    async (request, reply) => {
      const { runId } = request.params as { runId: string };
      const identity = request.identity!;
      const diagnostics = await getDiscoveryOpsRunDiagnostics({
        sessionId: identity.sessionId,
        accountId: identity.accountId,
        runId,
      });
      if (!diagnostics) {
        return reply.status(404).send({ error: 'Not found' });
      }
      return diagnostics;
    }
  );

  securedRoute(
    app,
    'post',
    '/api/ops/discovery/trigger-due-runs',
    requireRouteSecurityRule('POST', '/api/ops/discovery/trigger-due-runs'),
    async () => executeDiscoveryHostTick()
  );
}
