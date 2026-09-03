import type { ProfileStore } from '@arrival-atlas/discovery';
import type { NotificationTarget } from '@arrival-atlas/discovery';
import { resolveDiscoveryNotificationEmail } from './resolve-discovery-notification-email.js';

export type ResolveDiscoveryNotificationTarget = (input: {
  profileId: string;
  runId: string;
}) => Promise<NotificationTarget | null>;

/**
 * Atlas composition-root resolver: profile owner → EMAIL recipient.
 * Keeps account/session concerns outside the discovery domain.
 */
export function createResolveDiscoveryNotificationTarget(deps: {
  profileStore: ProfileStore;
}): ResolveDiscoveryNotificationTarget {
  return async ({ profileId }) => {
    const profile = await deps.profileStore.get(profileId);
    if (!profile) {
      return null;
    }
    if (profile.notification.emailEnabled === false) {
      return null;
    }

    const address = resolveDiscoveryNotificationEmail(profile.userId);
    if (!address) {
      return null;
    }

    return {
      channel: 'EMAIL',
      recipient: {
        userId: profile.userId,
        address,
      },
      skipEmptyDigest: profile.notification.skipEmptyDigest,
    };
  };
}
