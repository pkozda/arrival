import type { NotificationAdapter } from '../notifications/notification-adapter.js';
import type {
  NotificationChannel,
  NotificationDeliveryResult,
  NotificationSendRequest,
} from '../notifications/types.js';

export type ChannelNotificationAdapters = Partial<
  Record<NotificationChannel, NotificationAdapter>
>;

/**
 * Routes NotificationAdapter.send by request.channel.
 * Provider-neutral — composition root wires EMAIL / TELEGRAM / etc.
 */
export function createChannelRoutingNotificationAdapter(
  adapters: ChannelNotificationAdapters
): NotificationAdapter {
  return {
    async send(request: NotificationSendRequest): Promise<NotificationDeliveryResult> {
      const adapter = adapters[request.channel];
      if (!adapter) {
        return {
          ok: false,
          code: 'UNAVAILABLE',
          message: `No notification adapter configured for channel ${request.channel}`,
        };
      }
      return adapter.send(request);
    },
  };
}
