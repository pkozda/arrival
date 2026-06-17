import Fastify from 'fastify';
import cors from '@fastify/cors';
import {
  globalRegistry,
  getSupportedLanguages,
  getTranslations,
  AppContextSchema,
} from '@arrivalos/core';
import { resolveExecutionContext } from '@arrivalos/profile';
import { registerAllModules } from '@arrivalos/modules';
import { profileEngine } from './profile-runtime.js';
import { registerProfileRoutes } from './routes/profile.js';
import { registerUiSnapshotRoutes } from './routes/ui-snapshot.js';
import { randomUUID } from 'node:crypto';
import { systemStateCoordinator } from './state/system-state-coordinator.js';
import { attachUxToExecutionResult, isAtlasUxEnabled } from './ux-integration.js';

let modulesRegistered = false;

function ensureModulesRegistered(): void {
  if (!modulesRegistered) {
    registerAllModules(globalRegistry);
    modulesRegistered = true;
  }
}

function listModuleDescriptors() {
  return globalRegistry.list().map((module) => ({
    id: module.id,
    name: module.name,
    ...(module.description ? { description: module.description } : {}),
  }));
}

export async function buildApp(options: { logger?: boolean } = {}) {
  ensureModulesRegistered();

  const app = Fastify({ logger: options.logger ?? false });

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  });

  app.get('/health', async () => ({
    status: 'ok',
    service: 'arrivalos-api',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  }));

  app.get('/api/modules', async () => ({
    modules: globalRegistry.list().map((m) => ({
      id: m.id,
      name: m.name,
      version: m.version,
      description: m.description,
      enabled: m.enabled,
      featureFlags: m.featureFlags,
    })),
  }));

  app.get('/api/modules/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const module = globalRegistry.get(id);
    if (!module) {
      return reply.status(404).send({ error: `Module "${id}" not found` });
    }
    return {
      id: module.id,
      name: module.name,
      version: module.version,
      description: module.description,
      enabled: module.enabled,
      featureFlags: module.featureFlags,
    };
  });

  app.post('/api/modules/:id/execute', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;
    const sessionId = request.headers['x-session-id'] as string | undefined;

    const rawContext = AppContextSchema.parse(body.context ?? {});
    const inputPayload = (body.input ?? body) as Record<string, unknown>;
    const { context: _ctx, inputOverrides, ...cleanInput } = inputPayload;

    const contextInputOverrides =
      (inputOverrides as Record<string, unknown> | undefined) ??
      ((rawContext as Record<string, unknown>).inputOverrides as
        | Record<string, unknown>
        | undefined) ??
      {};

    const { context, mergedInput, trace } = await resolveExecutionContext(profileEngine, {
      sessionId,
      moduleId: id,
      requestInput: cleanInput,
      requestContext: rawContext,
      inputOverrides: contextInputOverrides,
    });

    const result = await globalRegistry.execute(id, mergedInput, context);
    if (!result.success) {
      return reply.status(422).send(result);
    }

    if (sessionId && result.data !== undefined) {
      const executionId = randomUUID();
      try {
        await systemStateCoordinator.applyMutation({
          type: 'MODULE_EXECUTE',
          sessionId,
          moduleId: id,
          result: result.data,
          executedAt: result.executedAt,
          executionId,
          trace: { ...trace, sessionId },
          requestInput: cleanInput,
          preferredLanguage: rawContext.userProfile?.language,
        });
      } catch (error) {
        request.log.warn({ err: error, moduleId: id, sessionId }, 'module execute mutation failed');
        return reply.status(404).send({ error: 'Session not found' });
      }
    }

    return attachUxToExecutionResult(result);
  });

  app.get('/api/modules/:id/trace', async (request, reply) => {
    const { id } = request.params as { id: string };
    const sessionId = request.headers['x-session-id'] as string | undefined;

    reply.header('x-deprecation', 'Use GET /api/ui-snapshot for UI state. Trace is diagnostic-only.');

    if (!sessionId) {
      return reply.status(400).send({ error: 'x-session-id header is required' });
    }

    const module = globalRegistry.get(id);
    if (!module) {
      return reply.status(404).send({ error: `Module "${id}" not found` });
    }

    const trace = await systemStateCoordinator.getLatestTrace(sessionId, id);
    if (!trace) {
      return reply.status(404).send({ error: 'No execution trace found for this session and module' });
    }

    return trace;
  });

  await registerProfileRoutes(app);
  await registerUiSnapshotRoutes(app);

  app.post('/api/sessions', async (request) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const context = AppContextSchema.parse(body.context ?? body);
    const result = await systemStateCoordinator.applyMutation({
      type: 'SESSION_CREATE',
      context,
      modules: listModuleDescriptors(),
      projectionConfig: { uxSnapshotEnabled: isAtlasUxEnabled() },
    });

    return { sessionId: result.state.session.id, context: result.state.session.context };
  });

  app.get('/api/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const state = await systemStateCoordinator.getState(id);
    if (!state) {
      return reply.status(404).send({ error: 'Session not found' });
    }
    return state.session;
  });

  app.patch('/api/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;
    const context = AppContextSchema.partial().parse(body.context ?? body);

    try {
      const result = await systemStateCoordinator.applyMutation({
        type: 'SESSION_PATCH',
        sessionId: id,
        context,
        mutationId: `session-patch:${id}`,
      });
      return result.state.session;
    } catch {
      return reply.status(404).send({ error: 'Session not found' });
    }
  });

  app.get('/api/i18n/languages', async () => ({
    languages: getSupportedLanguages(),
  }));

  app.get('/api/i18n/:lang', async (request, reply) => {
    const { lang } = request.params as { lang: string };
    const languages = getSupportedLanguages();
    if (!languages.includes(lang as (typeof languages)[number])) {
      return reply.status(400).send({ error: `Unsupported language: ${lang}` });
    }
    return {
      language: lang,
      translations: getTranslations(lang as (typeof languages)[number]),
    };
  });

  app.get('/api/events', async (request) => {
    const query = request.query as Record<string, string>;

    if (!query.sessionId) {
      return {
        events: [],
        deprecation: 'Session-scoped events are available via GET /api/events?sessionId=...',
      };
    }

    const state = await systemStateCoordinator.getState(query.sessionId);
    if (!state) {
      return {
        events: [],
        deprecation: 'Session-scoped events are derived from persisted SystemState.',
      };
    }

    return {
      events: state.events,
      snapshotVersion: state.version.snapshotVersion,
      deprecation: 'Session-scoped events are derived from persisted SystemState.',
    };
  });

  return app;
}
