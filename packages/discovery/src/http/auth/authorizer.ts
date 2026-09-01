import type { DiscoveryAuthorizer, DiscoveryPermission, DiscoveryPrincipal } from './types.js';

/**
 * Permission-set authorizer — principal.permissions must include the required permission.
 */
export function createPermissionAuthorizer(): DiscoveryAuthorizer {
  return {
    authorize(principal: DiscoveryPrincipal, permission: DiscoveryPermission): boolean {
      return principal.permissions.includes(permission);
    },
  };
}
