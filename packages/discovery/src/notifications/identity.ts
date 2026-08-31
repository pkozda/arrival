import type {
  NotificationChannel,
  NotificationIdempotencyKey,
} from './types.js';

/**
 * Deterministic notification identity for idempotent delivery.
 * Key: (profileId, digestId, channel, recipient.userId, recipient.address)
 */
export function notificationIdentityKey(input: NotificationIdempotencyKey): string {
  const { profileId, digestId, channel, recipient } = input;
  return `notification:${profileId}:${digestId}:${channel}:${recipient.userId}:${recipient.address}`;
}

export function parseNotificationIdentityKey(id: string): NotificationIdempotencyKey | null {
  const prefix = 'notification:';
  if (!id.startsWith(prefix)) return null;
  const parts = id.slice(prefix.length).split(':');
  if (parts.length < 5) return null;
  const [profileId, digestId, channel, userId, ...addressParts] = parts;
  const address = addressParts.join(':');
  if (!profileId || !digestId || !channel || !userId || !address) return null;
  return {
    profileId,
    digestId,
    channel: channel as NotificationChannel,
    recipient: { userId, address },
  };
}
