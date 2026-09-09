import type { FastifyInstance } from 'fastify';
import { sendAuthError } from '../auth/auth-error-mapper.js';
import {
  accountClaimService,
  SessionNotFoundError,
} from '../account/account-claim.service.js';
import { maybeHealDiscoveryOwnership } from '../discovery/discovery-continuity-migration.js';
import { securedRoute } from '../routing/apply-route-security.js';
import { requireRouteSecurityRule } from '../routing/route-security-map.js';

export async function registerAccountRoutes(app: FastifyInstance): Promise<void> {
  securedRoute(
    app,
    'post',
    '/api/account/claim',
    requireRouteSecurityRule('POST', '/api/account/claim'),
    async (request, reply) => {
      const identity = request.identity!;

      try {
        const claimed = await accountClaimService.claimSession(identity.sessionId, {
          userAgent: typeof request.headers['user-agent'] === 'string'
            ? request.headers['user-agent']
            : undefined,
        });

        // PD-011: migrate session-owned Discovery profiles onto the claimed account.
        // Failures must not roll back account claim — surface migration outcome.
        let discoveryMigration: Awaited<
          ReturnType<typeof maybeHealDiscoveryOwnership>
        > = null;
        let discoveryMigrationError: string | null = null;
        try {
          discoveryMigration = await maybeHealDiscoveryOwnership({
            sessionId: claimed.sessionId,
            accountId: claimed.accountId,
          });
        } catch (migrationError) {
          discoveryMigrationError =
            migrationError instanceof Error
              ? migrationError.message
              : 'Discovery migration failed';
        }

        return {
          ...claimed,
          discoveryMigration: discoveryMigration
            ? {
                transferredProfileIds: discoveryMigration.transferredProfileIds,
                notificationEmailTransferred:
                  discoveryMigration.notificationEmailTransferred,
                status: 'ok' as const,
              }
            : null,
          discoveryMigrationError,
        };
      } catch (error) {
        if (error instanceof SessionNotFoundError) {
          sendAuthError(reply, 'session_not_found');
          return;
        }
        throw error;
      }
    }
  );
}
