import type { FastifyInstance, FastifyReply } from 'fastify';
import {
  DiscoveryUserConflictError,
  DiscoveryUserNotFoundError,
  DiscoveryUserValidationError,
  parseCreateProfileBody,
  parseUpdateProfileBody,
  type ResultState,
} from '@arrival-atlas/discovery';
import { securedRoute } from '../routing/apply-route-security.js';
import { requireRouteSecurityRule } from '../routing/route-security-map.js';
import { isDevToolsEnabled } from '../dev/is-dev-tools-enabled.js';
import {
  getDiscoveryPersistence,
  getDiscoveryStrategyRegistry,
  getDiscoveryUserService,
  resolveDiscoveryUserId,
} from '../discovery/discovery-user-runtime.js';
import { seedDiscoveryE2eFixture } from '../discovery/seed-e2e-fixture.js';

function mapDiscoveryError(error: unknown, reply: FastifyReply) {
  if (error instanceof DiscoveryUserNotFoundError) {
    return reply.status(404).send({
      error: error.message,
      code: 'NOT_FOUND',
    });
  }
  if (error instanceof DiscoveryUserConflictError) {
    return reply.status(409).send({
      error: error.message,
      code: 'CONFLICT',
    });
  }
  if (error instanceof DiscoveryUserValidationError) {
    return reply.status(400).send({
      error: error.message,
      code: 'INVALID_REQUEST',
    });
  }
  throw error;
}

function discoveryUserId(request: { identity?: { sessionId: string; accountId: string | null } }) {
  return resolveDiscoveryUserId({
    sessionId: request.identity!.sessionId,
    accountId: request.identity!.accountId,
  });
}

export async function registerDiscoveryRoutes(app: FastifyInstance): Promise<void> {
  securedRoute(
    app,
    'get',
    '/api/modules/discovery/profiles',
    requireRouteSecurityRule('GET', '/api/modules/discovery/profiles'),
    async (request, reply) => {
      try {
        const profiles = await getDiscoveryUserService().listProfiles(discoveryUserId(request));
        return { profiles };
      } catch (error) {
        return mapDiscoveryError(error, reply);
      }
    }
  );

  securedRoute(
    app,
    'post',
    '/api/modules/discovery/profiles',
    requireRouteSecurityRule('POST', '/api/modules/discovery/profiles'),
    async (request, reply) => {
      try {
        const input = parseCreateProfileBody(request.body, getDiscoveryStrategyRegistry());
        const profile = await getDiscoveryUserService().createProfile(
          discoveryUserId(request),
          input
        );
        return reply.status(201).send({ profile });
      } catch (error) {
        return mapDiscoveryError(error, reply);
      }
    }
  );

  securedRoute(
    app,
    'get',
    '/api/modules/discovery/profiles/:profileId',
    requireRouteSecurityRule('GET', '/api/modules/discovery/profiles/:profileId'),
    async (request, reply) => {
      const { profileId } = request.params as { profileId: string };
      try {
        const profile = await getDiscoveryUserService().getProfile(
          discoveryUserId(request),
          profileId
        );
        return { profile };
      } catch (error) {
        return mapDiscoveryError(error, reply);
      }
    }
  );

  securedRoute(
    app,
    'patch',
    '/api/modules/discovery/profiles/:profileId',
    requireRouteSecurityRule('PATCH', '/api/modules/discovery/profiles/:profileId'),
    async (request, reply) => {
      const { profileId } = request.params as { profileId: string };
      try {
        const existing = await getDiscoveryUserService().getProfile(
          discoveryUserId(request),
          profileId
        );
        const input = parseUpdateProfileBody(request.body, existing);
        const profile = await getDiscoveryUserService().updateProfile(
          discoveryUserId(request),
          profileId,
          input
        );
        return { profile };
      } catch (error) {
        return mapDiscoveryError(error, reply);
      }
    }
  );

  securedRoute(
    app,
    'post',
    '/api/modules/discovery/profiles/:profileId/enable',
    requireRouteSecurityRule('POST', '/api/modules/discovery/profiles/:profileId/enable'),
    async (request, reply) => {
      const { profileId } = request.params as { profileId: string };
      try {
        const profile = await getDiscoveryUserService().enableProfile(
          discoveryUserId(request),
          profileId
        );
        return { profile };
      } catch (error) {
        return mapDiscoveryError(error, reply);
      }
    }
  );

  securedRoute(
    app,
    'post',
    '/api/modules/discovery/profiles/:profileId/disable',
    requireRouteSecurityRule('POST', '/api/modules/discovery/profiles/:profileId/disable'),
    async (request, reply) => {
      const { profileId } = request.params as { profileId: string };
      try {
        const profile = await getDiscoveryUserService().disableProfile(
          discoveryUserId(request),
          profileId
        );
        return { profile };
      } catch (error) {
        return mapDiscoveryError(error, reply);
      }
    }
  );

  securedRoute(
    app,
    'get',
    '/api/modules/discovery/profiles/:profileId/results',
    requireRouteSecurityRule('GET', '/api/modules/discovery/profiles/:profileId/results'),
    async (request, reply) => {
      const { profileId } = request.params as { profileId: string };
      try {
        const results = await getDiscoveryUserService().listResults(
          discoveryUserId(request),
          profileId
        );
        return { results };
      } catch (error) {
        return mapDiscoveryError(error, reply);
      }
    }
  );

  securedRoute(
    app,
    'get',
    '/api/modules/discovery/profiles/:profileId/results/:resultId',
    requireRouteSecurityRule(
      'GET',
      '/api/modules/discovery/profiles/:profileId/results/:resultId'
    ),
    async (request, reply) => {
      const { profileId, resultId } = request.params as {
        profileId: string;
        resultId: string;
      };
      try {
        const result = await getDiscoveryUserService().getResult(
          discoveryUserId(request),
          profileId,
          decodeURIComponent(resultId)
        );
        return { result };
      } catch (error) {
        return mapDiscoveryError(error, reply);
      }
    }
  );

  securedRoute(
    app,
    'patch',
    '/api/modules/discovery/profiles/:profileId/results/:resultId/user-state',
    requireRouteSecurityRule(
      'PATCH',
      '/api/modules/discovery/profiles/:profileId/results/:resultId/user-state'
    ),
    async (request, reply) => {
      const { profileId, resultId } = request.params as {
        profileId: string;
        resultId: string;
      };
      const body = request.body as { userState?: ResultState };
      if (!body?.userState) {
        return reply.status(400).send({
          error: 'userState is required',
          code: 'INVALID_REQUEST',
        });
      }
      try {
        const result = await getDiscoveryUserService().updateResultUserState(
          discoveryUserId(request),
          profileId,
          decodeURIComponent(resultId),
          body.userState
        );
        return { result };
      } catch (error) {
        return mapDiscoveryError(error, reply);
      }
    }
  );

  securedRoute(
    app,
    'get',
    '/api/modules/discovery/profiles/:profileId/run-summary',
    requireRouteSecurityRule('GET', '/api/modules/discovery/profiles/:profileId/run-summary'),
    async (request, reply) => {
      const { profileId } = request.params as { profileId: string };
      try {
        return await getDiscoveryUserService().getProfileRunSummary(
          discoveryUserId(request),
          profileId
        );
      } catch (error) {
        return mapDiscoveryError(error, reply);
      }
    }
  );

  securedRoute(
    app,
    'post',
    '/api/modules/discovery/profiles/:profileId/run-now',
    requireRouteSecurityRule('POST', '/api/modules/discovery/profiles/:profileId/run-now'),
    async (request, reply) => {
      const { profileId } = request.params as { profileId: string };
      try {
        const result = await getDiscoveryUserService().runProfileNow(
          discoveryUserId(request),
          profileId
        );
        return reply.status(202).send(result);
      } catch (error) {
        return mapDiscoveryError(error, reply);
      }
    }
  );

  securedRoute(
    app,
    'post',
    '/api/dev/discovery/seed-fixture',
    requireRouteSecurityRule('POST', '/api/dev/discovery/seed-fixture'),
    async (request, reply) => {
      if (!isDevToolsEnabled()) {
        return reply.status(404).send({ error: 'Not found' });
      }

      const userId = discoveryUserId(request);
      const { profileStore, resultStore, runStore } = getDiscoveryPersistence();
      const fixture = await seedDiscoveryE2eFixture({
        userId,
        profileStore,
        resultStore,
        runStore,
      });
      return fixture;
    }
  );
}
