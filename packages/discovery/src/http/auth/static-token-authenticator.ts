import { timingSafeEqual } from 'node:crypto';
import type {
  AuthenticationResult,
  DiscoveryAuthenticator,
  DiscoveryPermission,
  DiscoveryPrincipal,
} from './types.js';
import { ALL_DISCOVERY_ADMIN_PERMISSIONS } from './types.js';

export type StaticTokenPrincipalConfig = {
  /** Opaque bearer token — never logged or serialized by this module. */
  token: string;
  principalId: string;
  permissions?: readonly DiscoveryPermission[];
};

export type StaticTokenAuthenticatorConfig = {
  /**
   * One or more token → principal mappings.
   * Empty tokens are rejected at construction.
   */
  tokens: readonly StaticTokenPrincipalConfig[];
};

function safeTokenEquals(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) {
    // Constant-ish work to avoid trivial length oracle; result still false.
    timingSafeEqual(a, Buffer.alloc(a.length));
    return false;
  }
  return timingSafeEqual(a, b);
}

function parseBearerToken(header: string | undefined): string | null {
  if (header === undefined || header === null) return null;
  if (typeof header !== 'string') return null;
  const trimmed = header.trim();
  if (!trimmed) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(trimmed);
  if (!match) return null;
  const token = match[1]!;
  if (!token || token.length > 4096) return null;
  return token;
}

/**
 * Deterministic bearer-token authenticator for tests and simple deployments.
 * Composition root supplies tokens — never reads process.env.
 */
export function createStaticTokenAuthenticator(
  config: StaticTokenAuthenticatorConfig
): DiscoveryAuthenticator {
  const entries = config.tokens.map((t) => {
    const token = t.token?.trim() ?? '';
    if (!token) {
      throw new Error('Static token authenticator requires non-empty tokens');
    }
    if (!t.principalId?.trim()) {
      throw new Error('Static token authenticator requires principalId');
    }
    const principal: DiscoveryPrincipal = {
      principalId: t.principalId.trim(),
      permissions: t.permissions ?? ALL_DISCOVERY_ADMIN_PERMISSIONS,
      authenticationMethod: 'bearer',
    };
    return { token, principal };
  });

  if (entries.length === 0) {
    throw new Error('Static token authenticator requires at least one token');
  }

  return {
    authenticate({ authorizationHeader }): AuthenticationResult {
      const provided = parseBearerToken(authorizationHeader);
      if (!provided) {
        return { ok: false, reason: 'unauthenticated' };
      }
      for (const entry of entries) {
        if (safeTokenEquals(provided, entry.token)) {
          return {
            ok: true,
            principal: {
              principalId: entry.principal.principalId,
              permissions: [...entry.principal.permissions],
              authenticationMethod: 'bearer',
            },
          };
        }
      }
      return { ok: false, reason: 'unauthenticated' };
    },
  };
}
