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
import { registerSessionLifecycleRoutes } from './routes/session-lifecycle.js';
import { registerAccountRoutes } from './routes/account.js';
import { registerProfileRoutes } from './routes/profile.js';
import { registerUiSnapshotRoutes } from './routes/ui-snapshot.js';
import { randomUUID } from 'node:crypto';
import { systemStateCoordinator } from './state/system-state-coordinator.js';
import { attachUxToExecutionResult, isAtlasUxEnabled } from './ux-integration.js';
import { toMutationActor } from './middleware/auth.middleware.js';
import {
  authTokenService,
  resolveAuthSubject,
} from './auth/auth.token.service.js';
import {
  entitlementService,
  ModuleAccessDeniedError,
} from './entitlements/entitlement.service.js';
import {
  sessionRegistryService,
} from './sessions/registry/session-registry.service.js';
import {
  RouteSecurityMap,
  requireRouteSecurityRule,
  validateRouteSecurityMap,
  type RegisteredRouteRef,
} from './routing/route-security-map.js';
import { securedRoute } from './routing/apply-route-security.js';
import {
  assertSessionOwnership,
  resolveOwnedSessionId,
} from './routing/session-ownership.js';

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
  const registeredRoutes: RegisteredRouteRef[] = [];

  app.addHook('onRoute', (routeOptions) => {
    const methods = Array.isArray(routeOptions.method)
      ? routeOptions.method
      : [routeOptions.method];

    for (const method of methods) {
      const normalizedMethod = method.toUpperCase();
      if (normalizedMethod === 'HEAD' || normalizedMethod === 'OPTIONS') {
        continue;
      }

      registeredRoutes.push({
        method: normalizedMethod,
        path: routeOptions.url,
      });
    }
  });

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  });

  securedRoute(
    app,
    'get',
    '/health',
    requireRouteSecurityRule('GET', '/health'),
    async () => ({
      status: 'ok',
      service: 'arrivalos-api',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    })
  );

  securedRoute(
    app,
    'get',
    '/api/modules',
    requireRouteSecurityRule('GET', '/api/modules'),
    async () => ({
      modules: globalRegistry.list().map((m) => ({
        id: m.id,
        name: m.name,
        version: m.version,
        description: m.description,
        enabled: m.enabled,
        featureFlags: m.featureFlags,
      })),
    })
  );

  securedRoute(
    app,
    'get',
    '/api/modules/:id',
    requireRouteSecurityRule('GET', '/api/modules/:id'),
    async (request, reply) => {
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
    }
  );

  securedRoute(
    app,
    'post',
    '/api/modules/:id/execute',
    requireRouteSecurityRule('POST', '/api/modules/:id/execute'),
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      const sessionId = request.auth!.sessionId;
      const accountId = request.identity!.accountId ?? null;

      const module = globalRegistry.get(id);
      if (!module) {
        return reply.status(404).send({ error: `Module "${id}" not found` });
      }

      if (accountId) {
        const entitlements = await entitlementService.getEntitlements(accountId);
        try {
          entitlementService.assertModuleExecutionAllowed(entitlements, id, accountId);
        } catch (error) {
          if (error instanceof ModuleAccessDeniedError) {
            return reply.status(403).send({ error: 'Module access denied' });
          }
          throw error;
        }
      }

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
            actor: toMutationActor(request.auth!),
          });
        } catch (error) {
          request.log.warn({ err: error, moduleId: id, sessionId }, 'module execute mutation failed');
          return reply.status(404).send({ error: 'Session not found' });
        }
      }

      return attachUxToExecutionResult(result);
    }
  );

  securedRoute(
    app,
    'get',
    '/api/modules/:id/trace',
    requireRouteSecurityRule('GET', '/api/modules/:id/trace'),
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const sessionId = request.auth!.sessionId;

      reply.header('x-deprecation', 'Use GET /api/ui-snapshot for UI state. Trace is diagnostic-only.');

      const module = globalRegistry.get(id);
      if (!module) {
        return reply.status(404).send({ error: `Module "${id}" not found` });
      }

      const trace = await systemStateCoordinator.getLatestTrace(sessionId, id);
      if (!trace) {
        return reply.status(404).send({ error: 'No execution trace found for this session and module' });
      }

      return trace;
    }
  );

  await registerProfileRoutes(app);
  await registerUiSnapshotRoutes(app);
  await registerAccountRoutes(app);
  await registerSessionLifecycleRoutes(app);

  securedRoute(
    app,
    'post',
    '/api/sessions',
    requireRouteSecurityRule('POST', '/api/sessions'),
    async (request) => {
      const body = (request.body ?? {}) as Record<string, unknown>;
      const context = AppContextSchema.parse(body.context ?? body);
      const result = await systemStateCoordinator.applyMutation({
        type: 'SESSION_CREATE',
        context,
        modules: listModuleDescriptors(),
        projectionConfig: { uxSnapshotEnabled: isAtlasUxEnabled() },
      });

      const sessionId = result.state.session.id;
      const accountId = result.state.accountId;
      const authSubject = resolveAuthSubject(accountId);
      const token = authTokenService.createToken({
        accountId,
        sessionId,
        authSubject,
      });

      if (accountId !== null) {
        const userAgent = request.headers['user-agent'];
        await sessionRegistryService.registerSession(accountId, sessionId, {
          userAgent: typeof userAgent === 'string' ? userAgent : undefined,
        });
      }

      return {
        sessionId,
        context: result.state.session.context,
        token,
        authSubject,
      };
    }
  );

  securedRoute(
    app,
    'get',
    '/api/sessions/:id',
    requireRouteSecurityRule('GET', '/api/sessions/:id'),
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!assertSessionOwnership(request, reply, id)) {
        return;
      }

      const state = await systemStateCoordinator.getState(id);
      if (!state) {
        return reply.status(404).send({ error: 'Session not found' });
      }
      return state.session;
    }
  );

  securedRoute(
    app,
    'patch',
    '/api/sessions/:id',
    requireRouteSecurityRule('PATCH', '/api/sessions/:id'),
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!assertSessionOwnership(request, reply, id)) {
        return;
      }

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
    }
  );

  securedRoute(
    app,
    'get',
    '/api/i18n/languages',
    requireRouteSecurityRule('GET', '/api/i18n/languages'),
    async () => ({
      languages: getSupportedLanguages(),
    })
  );

  securedRoute(
    app,
    'get',
    '/api/i18n/:lang',
    requireRouteSecurityRule('GET', '/api/i18n/:lang'),
    async (request, reply) => {
      const { lang } = request.params as { lang: string };
      const languages = getSupportedLanguages();
      if (!languages.includes(lang as (typeof languages)[number])) {
        return reply.status(400).send({ error: `Unsupported language: ${lang}` });
      }
      return {
        language: lang,
        translations: getTranslations(lang as (typeof languages)[number]),
      };
    }
  );

  securedRoute(
    app,
    'get',
    '/api/events',
    requireRouteSecurityRule('GET', '/api/events'),
    async (request, reply) => {
      const query = request.query as Record<string, string>;
      const sessionId = resolveOwnedSessionId(request, reply, query.sessionId);
      if (!sessionId) {
        return;
      }

      const state = await systemStateCoordinator.getState(sessionId);
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
    }
  );

  validateRouteSecurityMap(RouteSecurityMap, registeredRoutes);

  return app;
}
