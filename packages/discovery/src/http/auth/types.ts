/**
 * Provider-neutral authentication / authorization types for the HTTP admin API (E6.3).
 * HTTP-edge only — never part of Discovery domain/runtime.
 */

export type DiscoveryPermission =
  | 'discovery:read'
  | 'discovery:run'
  | 'discovery:schedule:write'
  | 'discovery:worker:process';

export const ALL_DISCOVERY_ADMIN_PERMISSIONS: readonly DiscoveryPermission[] = [
  'discovery:read',
  'discovery:run',
  'discovery:schedule:write',
  'discovery:worker:process',
] as const;

export type DiscoveryPrincipal = {
  principalId: string;
  permissions: readonly DiscoveryPermission[];
  authenticationMethod: 'bearer';
};

export type AuthenticationSuccess = {
  ok: true;
  principal: DiscoveryPrincipal;
};

export type AuthenticationFailure = {
  ok: false;
  /** Generic — never distinguish missing vs invalid token. */
  reason: 'unauthenticated';
};

export type AuthenticationResult = AuthenticationSuccess | AuthenticationFailure;

/**
 * Authenticate an inbound HTTP request.
 * Implementations must not log or return credential material.
 */
export type DiscoveryAuthenticator = {
  authenticate(input: {
    authorizationHeader: string | undefined;
  }): AuthenticationResult | Promise<AuthenticationResult>;
};

/**
 * Authorize a principal for a required permission.
 */
export type DiscoveryAuthorizer = {
  authorize(
    principal: DiscoveryPrincipal,
    permission: DiscoveryPermission
  ): boolean;
};
