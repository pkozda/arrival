export type {
  DiscoveryPermission,
  DiscoveryPrincipal,
  AuthenticationResult,
  AuthenticationSuccess,
  AuthenticationFailure,
  DiscoveryAuthenticator,
  DiscoveryAuthorizer,
} from './types.js';
export { ALL_DISCOVERY_ADMIN_PERMISSIONS } from './types.js';

export {
  createStaticTokenAuthenticator,
} from './static-token-authenticator.js';
export type {
  StaticTokenAuthenticatorConfig,
  StaticTokenPrincipalConfig,
} from './static-token-authenticator.js';

export { createPermissionAuthorizer } from './authorizer.js';
export { resolveAdminRoutePolicy } from './policy.js';
export type { AdminRoutePolicy } from './policy.js';

export {
  loadDiscoveryAdminAuthConfig,
  validateDiscoveryAdminAuthConfig,
  redactDiscoveryAdminAuthConfig,
} from './config.js';
export type {
  DiscoveryAdminAuthConfig,
  DiscoveryAdminAuthConfigValidation,
  RedactedDiscoveryAdminAuthConfig,
} from './config.js';

export { createAuthenticatorFromAdminAuthConfig } from './compose.js';
