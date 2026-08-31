import type { NotificationAdapter } from '../notification-adapter.js';
import type {
  NotificationChannel,
  NotificationDeliveryResult,
  NotificationPayload,
  NotificationRecipient,
  NotificationSendRequest,
} from '../types.js';

export type FakeNotificationSendRecord = {
  notificationId: string;
  profileId: string;
  digestId: string;
  runId: string;
  channel: NotificationChannel;
  recipient: NotificationRecipient;
  payload: NotificationPayload;
  sentAt: string;
};

export type FakeNotificationAdapterOptions = {
  /** When set, all sends fail with this result. */
  failWith?: NotificationDeliveryResult & { ok: false };
  /** When set, throws instead of returning failure. */
  throwWith?: Error;
  now?: () => string;
};

export function createFakeNotificationAdapter(
  options: FakeNotificationAdapterOptions = {}
): NotificationAdapter & {
  sent: FakeNotificationSendRecord[];
  reset(): void;
} {
  const sent: FakeNotificationSendRecord[] = [];
  const now = options.now ?? (() => new Date().toISOString());

  return {
    sent,

    reset() {
      sent.length = 0;
    },

    async send(request: NotificationSendRequest): Promise<NotificationDeliveryResult> {
      if (options.throwWith) {
        throw options.throwWith;
      }
      if (options.failWith) {
        return options.failWith;
      }
      sent.push({
        notificationId: request.notificationId,
        profileId: request.profileId,
        digestId: request.digestId,
        runId: request.runId,
        channel: request.channel,
        recipient: structuredClone(request.recipient),
        payload: structuredClone(request.payload),
        sentAt: now(),
      });
      return { ok: true };
    },
  };
}
