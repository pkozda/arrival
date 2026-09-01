import { timingSafeEqual } from 'node:crypto';
import type {
  DiscoveryUserAuthenticator,
  DiscoveryUserPrincipal,
  UserAuthenticationResult,
} from '../types.js';

export type StaticUserTokenConfig = {
  token: string;
  userId: string;
};

function safeTokenEquals(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) {
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
 * Bearer token → userId mapping for user-facing discovery API (E9.1).
 */
export function createStaticUserTokenAuthenticator(
  config: StaticUserTokenConfig
): DiscoveryUserAuthenticator {
  const token = config.token?.trim() ?? '';
  const userId = config.userId?.trim() ?? '';
  if (!token) {
    throw new Error('User token authenticator requires non-empty token');
  }
  if (!userId) {
    throw new Error('User token authenticator requires userId');
  }
  const principal: DiscoveryUserPrincipal = {
    userId,
    authenticationMethod: 'bearer',
  };

  return {
    authenticate({ authorizationHeader }): UserAuthenticationResult {
      const provided = parseBearerToken(authorizationHeader);
      if (!provided) {
        return { ok: false, reason: 'unauthenticated' };
      }
      if (safeTokenEquals(provided, token)) {
        return { ok: true, principal: { ...principal } };
      }
      return { ok: false, reason: 'unauthenticated' };
    },
  };
}

/**
 * Multi-user variant for tests — first matching token wins.
 */
export function createStaticUserTokenRegistryAuthenticator(
  tokens: readonly StaticUserTokenConfig[]
): DiscoveryUserAuthenticator {
  const entries = tokens.map((t) => {
    const token = t.token?.trim() ?? '';
    const userId = t.userId?.trim() ?? '';
    if (!token || !userId) {
      throw new Error('User token registry requires token and userId');
    }
    return { token, principal: { userId, authenticationMethod: 'bearer' as const } };
  });
  if (entries.length === 0) {
    throw new Error('User token registry requires at least one entry');
  }
  return {
    authenticate({ authorizationHeader }): UserAuthenticationResult {
      const provided = parseBearerToken(authorizationHeader);
      if (!provided) {
        return { ok: false, reason: 'unauthenticated' };
      }
      for (const entry of entries) {
        if (safeTokenEquals(provided, entry.token)) {
          return { ok: true, principal: { ...entry.principal } };
        }
      }
      return { ok: false, reason: 'unauthenticated' };
    },
  };
}
