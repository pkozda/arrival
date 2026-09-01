/**
 * Composition-root config for HTTP admin authentication (E6.3).
 * Adapters/handlers never read process.env — only this loader may.
 */

export type DiscoveryAdminAuthConfig =
  | {
      mode: 'bearer';
      /** Opaque admin token — never expose via status/redacted config. */
      adminToken: string;
    }
  | {
      /** Explicit unauthenticated mode for local/tests only. */
      mode: 'unauthenticated';
    };

export type DiscoveryAdminAuthConfigValidation =
  | { ok: true; config: DiscoveryAdminAuthConfig }
  | { ok: false; issues: string[] };

/**
 * Load admin auth config from an env map (not process.env inside callers).
 *
 * - DISCOVERY_ADMIN_TOKEN set → bearer mode
 * - DISCOVERY_ADMIN_AUTH_MODE=unauthenticated → explicit open mode (dev/test)
 * - neither → validation failure (secure-by-default for production composition)
 */
export function loadDiscoveryAdminAuthConfig(
  env: Record<string, string | undefined>
): DiscoveryAdminAuthConfig {
  const result = validateDiscoveryAdminAuthConfig(env);
  if (!result.ok) {
    throw new Error(result.issues.join('; '));
  }
  return result.config;
}

export function validateDiscoveryAdminAuthConfig(
  env: Record<string, string | undefined>
): DiscoveryAdminAuthConfigValidation {
  const mode = env.DISCOVERY_ADMIN_AUTH_MODE?.trim().toLowerCase();
  const token = env.DISCOVERY_ADMIN_TOKEN?.trim();

  if (mode === 'unauthenticated') {
    if (token) {
      return {
        ok: false,
        issues: [
          'DISCOVERY_ADMIN_TOKEN must not be set when DISCOVERY_ADMIN_AUTH_MODE=unauthenticated',
        ],
      };
    }
    return { ok: true, config: { mode: 'unauthenticated' } };
  }

  if (!token) {
    return {
      ok: false,
      issues: [
        'Missing DISCOVERY_ADMIN_TOKEN (or set DISCOVERY_ADMIN_AUTH_MODE=unauthenticated for explicit open mode)',
      ],
    };
  }

  if (token.length < 16) {
    return {
      ok: false,
      issues: ['DISCOVERY_ADMIN_TOKEN must be at least 16 characters'],
    };
  }

  return { ok: true, config: { mode: 'bearer', adminToken: token } };
}

/** Redacted snapshot — never includes the token value. */
export type RedactedDiscoveryAdminAuthConfig = {
  mode: 'bearer' | 'unauthenticated';
  adminTokenConfigured: boolean;
};

export function redactDiscoveryAdminAuthConfig(
  config: DiscoveryAdminAuthConfig
): RedactedDiscoveryAdminAuthConfig {
  if (config.mode === 'unauthenticated') {
    return { mode: 'unauthenticated', adminTokenConfigured: false };
  }
  return { mode: 'bearer', adminTokenConfigured: true };
}
