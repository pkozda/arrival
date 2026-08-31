export type {
  NotificationChannel,
  NotificationRecipient,
  NotificationPriority,
  NotificationItem,
  NotificationPayload,
  NotificationDeliveryStatus,
  NotificationFailureCode,
  NotificationFailure,
  NotificationRecord,
  NotificationPlan,
  NotificationDeliveryResult,
  NotificationSendRequest,
  DeliverDigestInput,
  DeliverDigestOutcome,
  NotificationIdempotencyKey,
} from './types.js';

export {
  NotificationError,
  NotificationStoreError,
  notificationFailureReasonCode,
} from './errors.js';

export { notificationIdentityKey, parseNotificationIdentityKey } from './identity.js';

export type { NotificationStore } from './notification-store.js';
export type { NotificationAdapter } from './notification-adapter.js';

export type {
  BuildNotificationPlanInput,
} from './plan-builder.js';
export { buildNotificationPlan, buildNotificationPayload } from './plan-builder.js';

export type {
  DiscoveryNotificationService,
  DiscoveryNotificationServiceConfig,
} from './notification-service.js';
export { createDiscoveryNotificationService } from './notification-service.js';

export { createInMemoryNotificationStore } from './fakes/in-memory-notification-store.js';
export type {
  FakeNotificationSendRecord,
  FakeNotificationAdapterOptions,
} from './fakes/fake-notification-adapter.js';
export { createFakeNotificationAdapter } from './fakes/fake-notification-adapter.js';
