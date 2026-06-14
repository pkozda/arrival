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
import { registerAllModules } from '@arrivalos/modules';

registerAllModules(globalRegistry);

const app = Fastify({ logger: true });

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

  let context = AppContextSchema.parse(body.context ?? {});

  if (sessionId) {
    const session = getSession(sessionId);
    if (session) {
      context = { ...session.context, ...context, sessionId };
    }
  }

  const input = body.input ?? body;
  const { context: _ctx, ...cleanInput } = input as Record<string, unknown>;

  const result = await globalRegistry.execute(id, cleanInput, context);
  if (!result.success) {
    return reply.status(422).send(result);
  }
  return result;
});

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
  if (!languages.includes(lang as typeof languages[number])) {
    return reply.status(400).send({ error: `Unsupported language: ${lang}` });
  }
  return { language: lang, translations: getTranslations(lang as typeof languages[number]) };
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

const port = parseInt(process.env.PORT ?? '3001', 10);
const host = process.env.HOST ?? '0.0.0.0';

try {
  await app.listen({ port, host });
  console.log(`ArrivalOS API running at http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
