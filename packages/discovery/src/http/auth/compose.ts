import type { DiscoveryAuthenticator } from './types.js';
import { createStaticTokenAuthenticator } from './static-token-authenticator.js';
import { ALL_DISCOVERY_ADMIN_PERMISSIONS } from './types.js';
import type { DiscoveryAdminAuthConfig } from './config.js';

/**
 * Build authenticator from validated admin auth config.
 * Returns null for explicit unauthenticated mode.
 */
export function createAuthenticatorFromAdminAuthConfig(
  config: DiscoveryAdminAuthConfig
): DiscoveryAuthenticator | null {
  if (config.mode === 'unauthenticated') {
    return null;
  }
  return createStaticTokenAuthenticator({
    tokens: [
      {
        token: config.adminToken,
        principalId: 'admin',
        permissions: ALL_DISCOVERY_ADMIN_PERMISSIONS,
      },
    ],
  });
}
