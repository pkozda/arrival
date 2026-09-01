export type {
  DiscoveryHttpHeaders,
  DiscoveryHttpRequest,
  DiscoveryHttpResponse,
  DiscoveryHttpErrorCode,
  DiscoveryHttpErrorBody,
} from './types.js';
export {
  DISCOVERY_REQUEST_ID_HEADER,
  MAX_ADMIN_BODY_BYTES,
} from './types.js';

export { resolveRequestId, headerValue } from './request-id.js';
export {
  validateRegisterScheduleBody,
  validateScheduleId,
  validateRunId,
  isSafeId,
} from './validation.js';
export type { ValidationResult } from './validation.js';

export {
  DiscoveryHttpError,
  jsonResponse,
  errorResponse,
  mapApplicationError,
  unauthenticatedResponse,
  forbiddenResponse,
} from './errors.js';

export {
  createDiscoveryHttpHandler,
} from './router.js';
export type {
  DiscoveryHttpHandler,
  DiscoveryHttpHandlerOptions,
} from './router.js';

export { createDiscoveryHttpServer } from './server.js';
export type { CreateDiscoveryHttpServerOptions } from './server.js';

export type {
  DiscoveryPermission,
  DiscoveryPrincipal,
  AuthenticationResult,
  AuthenticationSuccess,
  AuthenticationFailure,
  DiscoveryAuthenticator,
  DiscoveryAuthorizer,
  StaticTokenAuthenticatorConfig,
  StaticTokenPrincipalConfig,
  AdminRoutePolicy,
  DiscoveryAdminAuthConfig,
  DiscoveryAdminAuthConfigValidation,
  RedactedDiscoveryAdminAuthConfig,
} from './auth/index.js';
export {
  ALL_DISCOVERY_ADMIN_PERMISSIONS,
  createStaticTokenAuthenticator,
  createPermissionAuthorizer,
  resolveAdminRoutePolicy,
  loadDiscoveryAdminAuthConfig,
  validateDiscoveryAdminAuthConfig,
  redactDiscoveryAdminAuthConfig,
  createAuthenticatorFromAdminAuthConfig,
} from './auth/index.js';
