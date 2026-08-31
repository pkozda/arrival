import { AdapterFailureError } from '../adapter-infra/errors.js';
import { executeWithTimeout } from '../adapter-infra/timeout.js';
import type { Clock } from '../scheduler/clock.js';
import { clockIso } from '../scheduler/clock.js';
import type { NotificationAdapter } from './notification-adapter.js';
import { notificationIdentityKey } from './identity.js';
import type { NotificationStore } from './notification-store.js';
import { NotificationStoreError } from './errors.js';
import { buildNotificationPlan } from './plan-builder.js';
import type {
  DeliverDigestInput,
  DeliverDigestOutcome,
  NotificationFailure,
  NotificationFailureCode,
  NotificationRecord,
} from './types.js';

export type DiscoveryNotificationService = {
  deliverDigest(input: DeliverDigestInput): Promise<DeliverDigestOutcome>;
};

export type DiscoveryNotificationServiceConfig = {
  store: NotificationStore;
  adapter: NotificationAdapter;
  clock: Clock;
};

const NOTIFICATION_ADAPTER_ID = 'notification';

/**
 * Consumes an authoritative DiscoveryDigest and delivers notifications idempotently.
 * Does not recompute eligibility, mutate digest, or affect discovery run status.
 */
export function createDiscoveryNotificationService(
  config: DiscoveryNotificationServiceConfig
): DiscoveryNotificationService {
  const { store, adapter, clock } = config;

  async function deliverDigest(input: DeliverDigestInput): Promise<DeliverDigestOutcome> {
    const plan = buildNotificationPlan({
      digest: input.digest,
      recipient: input.recipient,
      channel: input.channel,
    });
    if (!plan) {
      return { kind: 'skipped', reason: 'empty_digest' };
    }

    const notificationId = notificationIdentityKey({
      profileId: plan.profileId,
      digestId: plan.digestId,
      channel: plan.channel,
      recipient: plan.recipient,
    });

    const existing = await store.findById(notificationId);
    if (existing) {
      return { kind: 'skipped', reason: 'already_delivered' };
    }

    const now = clockIso(clock);
    const pending: NotificationRecord = {
      id: notificationId,
      profileId: plan.profileId,
      digestId: plan.digestId,
      runId: plan.runId,
      channel: plan.channel,
      recipient: { ...plan.recipient },
      payload: structuredClone(plan.payload),
      status: 'PENDING',
      createdAt: now,
    };

    try {
      await store.create(pending);
    } catch (err) {
      if (err instanceof NotificationStoreError && err.message.includes('already exists')) {
        return { kind: 'skipped', reason: 'already_delivered' };
      }
      throw err;
    }

    let deliveryResult;
    try {
      deliveryResult = await executeWithTimeout(
        (signal) =>
          adapter.send({
            notificationId,
            profileId: plan.profileId,
            digestId: plan.digestId,
            channel: plan.channel,
            recipient: plan.recipient,
            payload: plan.payload,
            runId: plan.runId,
            signal,
            timeoutMs: input.timeoutMs,
          }),
        {
          adapter: NOTIFICATION_ADAPTER_ID,
          operation: 'send',
          timeoutMs: input.timeoutMs,
          signal: input.signal,
          runId: plan.runId,
        }
      );
    } catch (err) {
      const failure = mapAdapterError(err);
      const failed: NotificationRecord = {
        ...pending,
        status: 'FAILED',
        failure,
      };
      await store.update(failed);
      return { kind: 'failed', notificationId, failure };
    }

    if (!deliveryResult.ok) {
      const failed: NotificationRecord = {
        ...pending,
        status: 'FAILED',
        failure: {
          code: deliveryResult.code,
          message: deliveryResult.message,
        },
      };
      await store.update(failed);
      return {
        kind: 'failed',
        notificationId,
        failure: failed.failure!,
      };
    }

    const sent: NotificationRecord = {
      ...pending,
      status: 'SENT',
      sentAt: clockIso(clock),
    };
    await store.update(sent);
    return { kind: 'delivered', notificationId };
  }

  return { deliverDigest };
}

function mapAdapterError(err: unknown): NotificationFailure {
  if (err instanceof AdapterFailureError) {
    const code = mapAdapterFailureCode(err.failure.code);
    return { code, message: err.failure.message };
  }
  const message = err instanceof Error ? err.message : 'Notification delivery failed';
  return { code: 'DELIVERY_FAILED', message };
}

function mapAdapterFailureCode(
  code: string
): NotificationFailureCode {
  switch (code) {
    case 'TIMEOUT':
      return 'TIMEOUT';
    case 'CANCELLED':
      return 'CANCELLED';
    case 'UNAVAILABLE':
      return 'UNAVAILABLE';
    case 'AUTH_REQUIRED':
      return 'AUTH_REQUIRED';
    case 'POLICY_BLOCKED':
      return 'POLICY_BLOCKED';
    case 'RATE_LIMITED':
      return 'RATE_LIMITED';
    case 'NETWORK_ERROR':
      return 'NETWORK_ERROR';
    case 'INVALID_RESPONSE':
      return 'INVALID_RESPONSE';
    default:
      return 'DELIVERY_FAILED';
  }
}
