import type { FastifyInstance } from 'fastify';
import {
  BenefitNodeSchema,
  ingestRawDocuments,
  runScheduledIngestion,
  type RawBenefitDocument,
} from '@arrival-atlas/mbde';
import { securedRoute } from '../routing/apply-route-security.js';
import { requireRouteSecurityRule } from '../routing/route-security-map.js';
import { systemStateCoordinator } from '../state/system-state-coordinator.js';
import { resolveUserContext } from '../state/profile-mutation-state.js';
import { ensureMbdeBenefitStoreLoaded, ensureMbdeServiceReady } from '../mbde/mbde-runtime.js';

export async function registerMbdeRoutes(app: FastifyInstance): Promise<void> {
  await ensureMbdeBenefitStoreLoaded();

  securedRoute(
    app,
    'get',
    '/api/benefits/max',
    requireRouteSecurityRule('GET', '/api/benefits/max'),
    async (request, reply) => {
      const state = await systemStateCoordinator.getState(request.identity!.sessionId);
      if (!state) {
        return reply.status(404).send({ error: 'Session not found', code: 'MBDE_SESSION_NOT_FOUND' });
      }

      const userContext = resolveUserContext(state);
      const service = await ensureMbdeServiceReady();
      return service.recompute(userContext.profile ?? null);
    }
  );

  securedRoute(
    app,
    'post',
    '/api/benefits/recompute',
    requireRouteSecurityRule('POST', '/api/benefits/recompute'),
    async (request, reply) => {
      const state = await systemStateCoordinator.getState(request.identity!.sessionId);
      if (!state) {
        return reply.status(404).send({ error: 'Session not found', code: 'MBDE_SESSION_NOT_FOUND' });
      }

      const userContext = resolveUserContext(state);
      const body = (request.body ?? {}) as {
        includeProbabilistic?: boolean;
        minConfidence?: number;
      };

      const service = await ensureMbdeServiceReady();
      return service.recompute(userContext.profile ?? null, body);
    }
  );

  securedRoute(
    app,
    'get',
    '/api/benefits/clusters',
    requireRouteSecurityRule('GET', '/api/benefits/clusters'),
    async (request, reply) => {
      const state = await systemStateCoordinator.getState(request.identity!.sessionId);
      if (!state) {
        return reply.status(404).send({ error: 'Session not found', code: 'MBDE_SESSION_NOT_FOUND' });
      }

      const userContext = resolveUserContext(state);
      const service = await ensureMbdeServiceReady();
      return service.getClusters(userContext.profile ?? null);
    }
  );

  securedRoute(
    app,
    'get',
    '/api/benefits/impact-summary',
    requireRouteSecurityRule('GET', '/api/benefits/impact-summary'),
    async (request, reply) => {
      const state = await systemStateCoordinator.getState(request.identity!.sessionId);
      if (!state) {
        return reply.status(404).send({ error: 'Session not found', code: 'MBDE_SESSION_NOT_FOUND' });
      }

      const userContext = resolveUserContext(state);
      const service = await ensureMbdeServiceReady();
      return service.getImpactSummary(userContext.profile ?? null);
    }
  );

  securedRoute(
    app,
    'get',
    '/api/benefits/admin/nodes',
    requireRouteSecurityRule('GET', '/api/benefits/admin/nodes'),
    async () => {
      const store = await ensureMbdeBenefitStoreLoaded();
      return {
        schemaVersion: '1.0.0',
        nodes: store.listAll(),
        updateLogs: store.listUpdateLogs(20),
      };
    }
  );

  securedRoute(
    app,
    'patch',
    '/api/benefits/admin/nodes/:id',
    requireRouteSecurityRule('PATCH', '/api/benefits/admin/nodes/:id'),
    async (request) => {
      const { id } = request.params as { id: string };
      const store = await ensureMbdeBenefitStoreLoaded();
      const existing = store.getById(id);
      if (!existing) {
        return { error: 'Benefit node not found', code: 'MBDE_NODE_NOT_FOUND' };
      }

      const patch = request.body as Record<string, unknown>;
      const next = BenefitNodeSchema.parse({
        ...existing,
        ...patch,
        id,
        version: existing.version + 1,
      });

      const saved = store.upsert(next);
      return { schemaVersion: '1.0.0', node: saved };
    }
  );

  securedRoute(
    app,
    'post',
    '/api/benefits/admin/nodes',
    requireRouteSecurityRule('POST', '/api/benefits/admin/nodes'),
    async (request) => {
      const store = await ensureMbdeBenefitStoreLoaded();
      const node = BenefitNodeSchema.parse(request.body);
      const saved = store.upsert(node);
      return { schemaVersion: '1.0.0', node: saved };
    }
  );

  securedRoute(
    app,
    'post',
    '/api/benefits/admin/nodes/:id/deprecate',
    requireRouteSecurityRule('POST', '/api/benefits/admin/nodes/:id/deprecate'),
    async (request) => {
      const { id } = request.params as { id: string };
      const body = (request.body ?? {}) as { replacedById?: string };
      const store = await ensureMbdeBenefitStoreLoaded();
      const deprecated = store.deprecate(id, body.replacedById);
      if (!deprecated) {
        return { error: 'Benefit node not found', code: 'MBDE_NODE_NOT_FOUND' };
      }
      return { schemaVersion: '1.0.0', node: deprecated };
    }
  );

  securedRoute(
    app,
    'post',
    '/api/benefits/admin/ingest',
    requireRouteSecurityRule('POST', '/api/benefits/admin/ingest'),
    async (request) => {
      const body = request.body as {
        tier?: 'daily' | 'weekly' | 'monthly' | 'event';
        documents: RawBenefitDocument[];
      };

      const store = await ensureMbdeBenefitStoreLoaded();
      const tier = body.tier ?? 'event';

      const result =
        tier === 'event'
          ? await ingestRawDocuments(store, body.documents ?? [])
          : await runScheduledIngestion(store, tier, body.documents ?? []);

      return { schemaVersion: '1.0.0', ...result };
    }
  );
}
