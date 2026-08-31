import type {
  NotificationDeliveryResult,
  NotificationSendRequest,
} from './types.js';

export type { NotificationSendRequest };

/**
 * Provider-neutral notification delivery port (E4.4).
 * No vendor SDK/API types leak into this contract.
 */
export interface NotificationAdapter {
  send(request: NotificationSendRequest): Promise<NotificationDeliveryResult>;
}
