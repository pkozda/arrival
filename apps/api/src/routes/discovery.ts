import type { FastifyInstance, FastifyReply } from 'fastify';
import {
  DiscoveryUserConflictError,
  DiscoveryUserNotFoundError,
  DiscoveryUserValidationError,
  parseCreateProfileBody,
  parseUpdateProfileBody,
  type ResultState,
} from '@arrival-atlas/discovery';
import { z } from 'zod';
import { securedRoute } from '../routing/apply-route-security.js';
import { requireRouteSecurityRule } from '../routing/route-security-map.js';
import { isDevToolsEnabled } from '../dev/is-dev-tools-enabled.js';
import {
  getDiscoveryPersistence,
  getDiscoveryStrategyRegistry,
  getDiscoveryUserService,
  resolveDiscoveryUserId,
} from '../discovery/discovery-user-runtime.js';
import { isDiscoveryNotificationEmailConfigured } from '../discovery/resolve-discovery-notification-email.js';
import { getDiscoveryUserNotificationEmailStore } from '../discovery/user-notification-email-runtime.js';
import { seedDiscoveryE2eFixture } from '../discovery/seed-e2e-fixture.js';

/** Max RFC length; trim only — do not lowercase. */
const MAX_NOTIFICATION_EMAIL_LENGTH = 254;

const NotificationEmailMutationSchema = z.object({
  email: z.union([
    z.null(),
    z
      .string()
      .trim()
      .min(1)
      .max(MAX_NOTIFICATION_EMAIL_LENGTH)
      .email(),
  ]),
});

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

/** API-only delivery status — not persisted on the profile document. */
function emailRecipientConfiguredFor(userId: string): { emailRecipientConfigured: boolean } {
  return {
    emailRecipientConfigured: isDiscoveryNotificationEmailConfigured(userId),
  };
}

export async function registerDiscoveryRoutes(app: FastifyInstance): Promise<void> {
  securedRoute(
    app,
    'get',
    '/api/modules/discovery/notification-email',
    requireRouteSecurityRule('GET', '/api/modules/discovery/notification-email'),
    async (request) => {
      const userId = discoveryUserId(request);
      // Persist-only read — never resolve env/test fallback (E13.3.3).
      const userNotificationEmail =
        getDiscoveryUserNotificationEmailStore().getUserNotificationEmail(userId);
      return { userNotificationEmail };
    }
  );

  securedRoute(
    app,
    'patch',
    '/api/modules/discovery/notification-email',
    requireRouteSecurityRule('PATCH', '/api/modules/discovery/notification-email'),
    async (request, reply) => {
      const parsed = NotificationEmailMutationSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid notification email',
          code: 'INVALID_REQUEST',
        });
      }

      const userId = discoveryUserId(request);
      const store = getDiscoveryUserNotificationEmailStore();
      if (parsed.data.email === null) {
        store.clearUserNotificationEmail(userId);
        return { userNotificationEmail: null };
      }

      store.setUserNotificationEmail(userId, parsed.data.email);
      return { userNotificationEmail: parsed.data.email };
    }
  );

  securedRoute(
    app,
    'get',
    '/api/modules/discovery/profiles',
    requireRouteSecurityRule('GET', '/api/modules/discovery/profiles'),
    async (request, reply) => {
      try {
        const userId = discoveryUserId(request);
        const profiles = await getDiscoveryUserService().listProfiles(userId);
        return { profiles, ...emailRecipientConfiguredFor(userId) };
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
        const userId = discoveryUserId(request);
        const input = parseCreateProfileBody(request.body, getDiscoveryStrategyRegistry());
        const profile = await getDiscoveryUserService().createProfile(userId, input);
        return reply.status(201).send({
          profile,
          ...emailRecipientConfiguredFor(userId),
        });
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
        const userId = discoveryUserId(request);
        const profile = await getDiscoveryUserService().getProfile(userId, profileId);
        return { profile, ...emailRecipientConfiguredFor(userId) };
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
        const userId = discoveryUserId(request);
        const existing = await getDiscoveryUserService().getProfile(userId, profileId);
        const input = parseUpdateProfileBody(request.body, existing);
        const profile = await getDiscoveryUserService().updateProfile(
          userId,
          profileId,
          input
        );
        return { profile, ...emailRecipientConfiguredFor(userId) };
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
