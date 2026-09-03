/**
 * Deployment boundary for shared Discovery notification fallback (H3).
 *
 * DISCOVERY_NOTIFICATION_EMAIL is an ops/single-tenant shared address.
 * When ARRIVAL_ATLAS_MULTI_USER is enabled, that shared address must not
 * silently become the delivery target for users without a personal email.
 *
 * Default (unset / false): single-tenant / personal Atlas — env fallback allowed.
 */

export function isArrivalAtlasMultiUser(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const raw = env.ARRIVAL_ATLAS_MULTI_USER?.trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

/** Whether DISCOVERY_NOTIFICATION_EMAIL may be used as a delivery fallback. */
export function isDiscoverySharedNotificationFallbackEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return !isArrivalAtlasMultiUser(env);
}
