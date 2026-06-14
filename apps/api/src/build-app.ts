import Fastify from 'fastify';
import cors from '@fastify/cors';
import {
  globalRegistry,
  createSession,
  getSession,
  updateSessionContext,
  getSupportedLanguages,
  getTranslations,
  getEvents,
  AppContextSchema,
} from '@arrivalos/core';
import { resolveExecutionContext } from '@arrivalos/profile';
import { registerAllModules } from '@arrivalos/modules';
import { profileEngine } from './profile-runtime.js';
import { registerProfileRoutes } from './routes/profile.js';
import {
  getLastExecutionTrace,
  storeExecutionTrace,
} from './execution-trace-store.js';

let modulesRegistered = false;

function ensureModulesRegistered(): void {
  if (!modulesRegistered) {
    registerAllModules(globalRegistry);
    modulesRegistered = true;
  }
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

    if (sessionId) {
      storeExecutionTrace(trace);
    }

    const result = await globalRegistry.execute(id, mergedInput, context);
    if (!result.success) {
      return reply.status(422).send(result);
    }
    return result;
  });

  app.get('/api/modules/:id/trace', async (request, reply) => {
    const { id } = request.params as { id: string };
    const sessionId = request.headers['x-session-id'] as string | undefined;

    if (!sessionId) {
      return reply.status(400).send({ error: 'x-session-id header is required' });
    }

    const module = globalRegistry.get(id);
    if (!module) {
      return reply.status(404).send({ error: `Module "${id}" not found` });
    }

    const trace = getLastExecutionTrace(sessionId, id);
    if (!trace) {
      return reply.status(404).send({ error: 'No execution trace found for this session and module' });
    }

    return trace;
  });

  await registerProfileRoutes(app);

  app.post('/api/sessions', async (request) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const context = AppContextSchema.parse(body.context ?? body);
    const session = createSession(context);
    return { sessionId: session.id, context: session.context };
  });

  app.get('/api/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const session = getSession(id);
    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }
    return session;
  });

  app.patch('/api/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;
    const context = AppContextSchema.partial().parse(body.context ?? body);
    const session = updateSessionContext(id, context);
    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }
    return session;
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
    return {
      events: getEvents({
        type: query.type,
        moduleId: query.moduleId,
        sessionId: query.sessionId,
        limit: query.limit ? parseInt(query.limit, 10) : 50,
      }),
    };
  });

  return app;
}
