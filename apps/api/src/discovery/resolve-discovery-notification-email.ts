/**
 * Composition-root email resolution for Discovery notifications (E10.1 / E13.3.2 / H3).
 * Account/session email is not yet modeled in Atlas — use per-user overrides in
 * tests, persisted Discovery user settings, or DISCOVERY_NOTIFICATION_EMAIL for
 * single-tenant / personal Atlas hosts.
 *
 * Precedence:
 * 1. test override (setDiscoveryNotificationEmailForUser)
 * 2. user-persisted notification email (keyed by Discovery userId)
 * 3. DISCOVERY_NOTIFICATION_EMAIL — only when not in multi-user mode
 * 4. null
 *
 * Multi-user (ARRIVAL_ATLAS_MULTI_USER=true): shared env fallback is disabled so
 * digests never deliver to a host-wide address for users without a personal email.
 *
 * Ownership: email is a Discovery user delivery identity, not a profile field.
 * Settings follow the current userId only (accountId ?? sessionId); there is no
 * session→account claim/migration in this slice.
 */

import { isDiscoverySharedNotificationFallbackEnabled } from './discovery-deployment-mode.js';
import { getDiscoveryUserNotificationEmailStore } from './user-notification-email-runtime.js';

const emailByUserId = new Map<string, string>();

/** Test-only: map a discovery userId to a notification email address. */
export function setDiscoveryNotificationEmailForUser(userId: string, email: string): void {
  emailByUserId.set(userId, email);
}

/** Test-only: clear per-user notification email overrides. */
export function clearDiscoveryNotificationEmailOverrides(): void {
  emailByUserId.clear();
}

function isUsableEmail(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.includes('@');
}

/**
 * Resolve a notification email for a discovery profile owner (userId).
 * Returns null when no usable address is configured.
 * Does not expose which source supplied the address.
 */
export function resolveDiscoveryNotificationEmail(userId: string): string | null {
  const override = emailByUserId.get(userId);
  if (override && isUsableEmail(override)) {
    return override.trim();
  }

  const persisted = getDiscoveryUserNotificationEmailStore().getUserNotificationEmail(userId);
  if (persisted && isUsableEmail(persisted)) {
    return persisted.trim();
  }

  if (isDiscoverySharedNotificationFallbackEnabled()) {
    const envEmail = process.env.DISCOVERY_NOTIFICATION_EMAIL?.trim();
    if (envEmail && isUsableEmail(envEmail)) {
      return envEmail;
    }
  }

  return null;
}

/**
 * Safe status for UI: whether a recipient address is operationally configured.
 * Does not expose the address itself.
 */
export function isDiscoveryNotificationEmailConfigured(userId: string): boolean {
  return resolveDiscoveryNotificationEmail(userId) !== null;
}
