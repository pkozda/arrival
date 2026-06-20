import Fastify from 'fastify';
import cors from '@fastify/cors';
import {
  globalRegistry,
  getSupportedLanguages,
  getTranslations,
  AppContextSchema,
} from '@arrival-atlas/core';
import { resolveExecutionContext } from '@arrival-atlas/profile';
import { registerAllModules, allModuleRegistrations } from '@arrival-atlas/modules';
import { profileEngine } from './profile-runtime.js';
import {
  ModuleRuntime,
  bootstrapGovernedRuntime,
  executeGovernedModule,
  type GovernedModuleRegistry,
} from '@arrival-atlas/module-runtime';
import {
  bootstrapProductContractLayer,
  projectModuleCapabilities,
  projectModuleSchema,
  projectPublicContract,
  projectPublicModuleContract,
  type ContractSnapshotStore,
} from '@arrival-atlas/product-contract';
import { runMrcShadowValidation } from './mrc-shadow.js';
import {
  buildLegacyExecuteResponse,
  buildProjectionExecuteResponse,
  isLegacyExecuteContract,
  sealModuleResultForProjection,
} from './module-execute-response.js';
import { registerSessionLifecycleRoutes } from './routes/session-lifecycle.js';
import { registerAccountRoutes } from './routes/account.js';
import { registerProfileRoutes } from './routes/profile.js';
import { registerProfileMutationRoutes } from './routes/profile-mutations.js';
import { registerProfileInsightsRoutes } from './routes/profile-insights.js';
import { registerUiSnapshotRoutes } from './routes/ui-snapshot.js';
import { randomUUID } from 'node:crypto';
import { systemStateCoordinator } from './state/system-state-coordinator.js';
import { buildModuleExplanationResponse } from './module-explain.js';
import { mapExecuteFailureResponse } from './module-error-boundary.js';
import { markLegacyContractDeprecated } from './legacy-contract-deprecation.js';
import { isAtlasUxEnabled } from './ux-integration.js';
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
  buildGovernanceHealthReport,
  buildModulesHealthReport,
} from './observability-runtime.js';
import { globalMetricsCollector } from '@arrival-atlas/observability';
import {
  assertSessionOwnership,
  resolveOwnedSessionId,
} from './routing/session-ownership.js';

let modulesRegistered = false;
let governedRegistry: GovernedModuleRegistry | null = null;
let contractSnapshotStore: ContractSnapshotStore | null = null;

function ensureModulesRegistered(): void {
  if (!modulesRegistered) {
    registerAllModules(globalRegistry);
    modulesRegistered = true;
  }
}

function ensureGovernedRuntime(): GovernedModuleRegistry {
  ensureModulesRegistered();

  if (!governedRegistry) {
    governedRegistry = bootstrapGovernedRuntime(
      globalRegistry,
      allModuleRegistrations
    ).governedRegistry;
  }

  return governedRegistry;
}

function ensureContractSnapshotStore(): ContractSnapshotStore {
  if (!contractSnapshotStore) {
    contractSnapshotStore = bootstrapProductContractLayer(ensureGovernedRuntime());
  }

  return contractSnapshotStore;
}

function listModuleDescriptors() {
  return projectPublicContract(ensureGovernedRuntime()).map((module) => ({
    id: module.id,
    name: module.title,
    ...(module.description ? { description: module.description } : {}),
  }));
}

export async function buildApp(options: { logger?: boolean } = {}) {
  const runtimeRegistry = ensureGovernedRuntime();
  const contractStore = ensureContractSnapshotStore();

  const moduleRuntime = new ModuleRuntime({
    profileEngine,
    governedRegistry: runtimeRegistry,
  });

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
      service: 'arrival-atlas-api',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    })
  );

  securedRoute(
    app,
    'get',
    '/api/health/governance',
    requireRouteSecurityRule('GET', '/api/health/governance'),
    async () =>
      buildGovernanceHealthReport({
        governedRegistry: runtimeRegistry,
        contractStore,
      })
  );

  securedRoute(
    app,
    'get',
    '/api/health/modules',
    requireRouteSecurityRule('GET', '/api/health/modules'),
    async () =>
      buildModulesHealthReport({
        governedRegistry: runtimeRegistry,
        contractStore,
      })
  );

  securedRoute(
    app,
    'get',
    '/api/modules',
    requireRouteSecurityRule('GET', '/api/modules'),
    async () => ({
      modules: projectPublicContract(runtimeRegistry),
    })
  );

  securedRoute(
    app,
    'get',
    '/api/modules/:id',
    requireRouteSecurityRule('GET', '/api/modules/:id'),
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const contract = projectPublicModuleContract(runtimeRegistry, id);
      if (!contract) {
        return reply.status(404).send({ error: `Module "${id}" not found` });
      }
      return contract;
    }
  );

  securedRoute(
    app,
    'get',
    '/api/modules/:id/schema',
    requireRouteSecurityRule('GET', '/api/modules/:id/schema'),
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const schema = projectModuleSchema(contractStore, id);
      if (!schema) {
        return reply.status(404).send({ error: `Module "${id}" not found` });
      }
      return schema;
    }
  );

  securedRoute(
    app,
    'get',
    '/api/modules/:id/capabilities',
    requireRouteSecurityRule('GET', '/api/modules/:id/capabilities'),
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const capabilities = projectModuleCapabilities(contractStore, id);
      if (!capabilities) {
        return reply.status(404).send({ error: `Module "${id}" not found` });
      }
      return capabilities;
    }
  );

  securedRoute(
    app,
    'post',
    '/api/modules/:id/execute',
    requireRouteSecurityRule('POST', '/api/modules/:id/execute'),
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const identity = request.identity!;
      const body = request.body as Record<string, unknown>;
      const sessionId = identity.sessionId;
      const accountId = identity.accountId;

      const module = runtimeRegistry.get(id);
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

      const startedAt = Date.now();
      const { context, mergedInput, trace } = await resolveExecutionContext(profileEngine, {
        sessionId,
        moduleId: id,
        requestInput: cleanInput,
        requestContext: rawContext,
        inputOverrides: contextInputOverrides,
      });

      const result = await executeGovernedModule(
        runtimeRegistry,
        id,
        mergedInput,
        context
      );

      globalMetricsCollector.recordExecution(id, Date.now() - startedAt, result.success);

      runMrcShadowValidation(
        moduleRuntime,
        {
          moduleId: id,
          sessionId,
          accountId,
          requestInput: cleanInput,
          requestContext: rawContext,
          inputOverrides: contextInputOverrides,
        },
        result,
        request.log
      );

      const executionId = randomUUID();
      const contractSnapshot = contractStore.getContractSnapshot(id);
      if (!contractSnapshot) {
        return reply.status(404).send({ error: `Module "${id}" not found` });
      }

      const sealedModuleResult = sealModuleResultForProjection(result, executionId, {
        moduleId: id,
        appContext: context,
        mergedInput,
        accountId,
        governedRegistry: runtimeRegistry,
      });

      const projectionResponse = buildProjectionExecuteResponse(sealedModuleResult, contractSnapshot, {
        executionId,
        duration: Date.now() - startedAt,
      });

      const useLegacyContract = isLegacyExecuteContract(
        (request.query ?? {}) as Record<string, unknown>
      );

      if (sessionId && result.success && result.data !== undefined) {
        try {
          await systemStateCoordinator.applyMutation({
            type: 'MODULE_EXECUTE',
            sessionId,
            moduleId: id,
            result: result.data,
            moduleResult: sealedModuleResult,
            projection: projectionResponse.projection,
            executedAt: result.executedAt,
            executionId,
            trace: { ...trace, sessionId },
            requestInput: cleanInput,
            preferredLanguage: rawContext.userProfile?.language,
            actor: toMutationActor(identity),
          });
        } catch (error) {
          request.log.warn({ err: error, moduleId: id, sessionId }, 'module execute mutation failed');
          return reply.status(404).send({ error: 'Session not found' });
        }
      }

      if (!result.success) {
        if (useLegacyContract) {
          return reply.status(422).send(mapExecuteFailureResponse({ result, projectionResponse }));
        }

        return reply.status(422).send(mapExecuteFailureResponse({ result, projectionResponse }));
      }

      if (useLegacyContract) {
        markLegacyContractDeprecated(reply, 'execute');
        request.log.warn({ moduleId: id, sessionId, feature: 'contractVersion=legacy' }, 'legacy execute contract used');
        return buildLegacyExecuteResponse(result, sealedModuleResult);
      }

      return projectionResponse;
    }
  );

  securedRoute(
    app,
    'get',
    '/api/modules/:id/trace',
    requireRouteSecurityRule('GET', '/api/modules/:id/trace'),
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const sessionId = request.identity!.sessionId;

      reply.header('x-deprecation', 'Diagnostic-only. Use GET /api/modules/:id/explain for product explainability.');

      const module = runtimeRegistry.get(id);
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

  securedRoute(
    app,
    'get',
    '/api/modules/:id/explain',
    requireRouteSecurityRule('GET', '/api/modules/:id/explain'),
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const sessionId = request.identity!.sessionId;
      const query = (request.query ?? {}) as Record<string, unknown>;
      const executionId = typeof query.executionId === 'string' ? query.executionId : undefined;

      if (!executionId) {
        return reply.status(400).send({ error: 'executionId query parameter is required' });
      }

      const module = runtimeRegistry.get(id);
      if (!module) {
        return reply.status(404).send({ error: `Module "${id}" not found` });
      }

      const response = await buildModuleExplanationResponse({
        sessionId,
        moduleId: id,
        executionId,
        coordinator: systemStateCoordinator,
        contractStore,
      });

      if (!response.ok) {
        return reply.status(response.statusCode).send({ error: response.error });
      }

      return response.view;
    }
  );

  await registerProfileRoutes(app);
  await registerProfileMutationRoutes(app);
  await registerProfileInsightsRoutes(app);
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
