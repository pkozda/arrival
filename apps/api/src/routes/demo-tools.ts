import type { FastifyInstance, FastifyReply } from 'fastify';
import { isDevToolsEnabled } from '../dev/is-dev-tools-enabled.js';
import { buildLifeEventPlanFromState } from '../state/life-event-plan-projection.js';
import { systemStateCoordinator } from '../state/system-state-coordinator.js';
import { securedRoute } from '../routing/apply-route-security.js';
import { requireRouteSecurityRule } from '../routing/route-security-map.js';

function devToolsUnavailable(reply: FastifyReply) {
  return reply.status(404).send({ error: 'Not found' });
}

/**
 * Demo preset routes. `@arrival-atlas/life-event-demo` is loaded only after the
 * DEV_TOOLS gate passes so production (DEV_TOOLS=false) never eagerly requires it.
 */
export async function registerDemoToolsRoutes(app: FastifyInstance): Promise<void> {
  securedRoute(
    app,
    'get',
    '/api/dev/demo/presets',
    requireRouteSecurityRule('GET', '/api/dev/demo/presets'),
    async (_request, reply) => {
      if (!isDevToolsEnabled()) {
        return devToolsUnavailable(reply);
      }

      const { LIFE_EVENT_DEMO_PERSONAS, summarizeDemoPreset } = await import(
        '@arrival-atlas/life-event-demo'
      );

      return {
        presets: LIFE_EVENT_DEMO_PERSONAS.map((persona) => ({
          id: persona.id,
          title: persona.title,
          tagline: persona.tagline,
          goal: persona.goal,
          valueProposition: persona.valueProposition,
          fixtureId: persona.fixtureId,
          expectedLifeState: persona.expectedLifeState,
          scenarioEvent: persona.scenarioEvent ?? null,
          summary: summarizeDemoPreset(persona.id),
        })),
      };
    }
  );

  securedRoute(
    app,
    'post',
    '/api/dev/demo/load-preset',
    requireRouteSecurityRule('POST', '/api/dev/demo/load-preset'),
    async (request, reply) => {
      if (!isDevToolsEnabled()) {
        return devToolsUnavailable(reply);
      }

      const { parseDemoPersonaId, seedDemoPersonaSession } = await import(
        '../demo/seed-demo-session.js'
      );
      const { summarizeDemoPreset } = await import('@arrival-atlas/life-event-demo');

      const body = (request.body ?? {}) as { presetId?: unknown };
      const presetId = parseDemoPersonaId(body.presetId);
      if (!presetId) {
        return reply.status(400).send({ error: 'Invalid presetId' });
      }

      const sessionId = request.identity!.sessionId;
      await seedDemoPersonaSession(sessionId, presetId);

      const state = await systemStateCoordinator.getState(sessionId);
      if (!state) {
        return reply.status(404).send({ error: 'Session not found' });
      }

      const plan = buildLifeEventPlanFromState(state);
      const summary = summarizeDemoPreset(presetId);

      return {
        presetId,
        sessionId,
        summary,
        plan: {
          currentLifeState: plan.currentLifeState,
          planningSeverity: plan.planningSeverity,
          currentFocus: plan.currentFocus.title,
          nextBestActions: plan.nextBestActions.map((node) => node.title),
          activeBlocks: plan.activeBlocks.map((node) => node.title),
        },
      };
    }
  );
}
