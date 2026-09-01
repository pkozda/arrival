import type { DiscoveryTelemetry, DiscoveryTelemetryEvent } from './types.js';
import type { ProviderObservedStatus } from '../runtime/health.js';

export type ProviderObservationKey =
  | 'search'
  | 'ai'
  | 'fetch'
  | 'extract'
  | 'verify'
  | 'email'
  | 'telegram';

export type OperationalObservations = {
  providers: Partial<Record<ProviderObservationKey, ProviderObservedStatus>>;
  contentionObserved: boolean;
  telemetryErrors: number;
};

/**
 * Side-channel observation recorder fed by telemetry events.
 * Never affects discovery control flow.
 */
export type OperationalObservationTracker = {
  record(event: DiscoveryTelemetryEvent): void;
  snapshot(): OperationalObservations;
  /** Mark that the telemetry sink itself threw (does not fail discovery). */
  markTelemetryFailure(): void;
};

export function createOperationalObservationTracker(): OperationalObservationTracker {
  const providers: Partial<
    Record<ProviderObservationKey, ProviderObservedStatus>
  > = {};
  let contentionObserved = false;
  let telemetryErrors = 0;

  return {
    record(event) {
      if (event.eventName === 'scheduler.lock_contended') {
        contentionObserved = true;
      }

      if (
        event.eventName === 'adapter.completed' ||
        event.eventName === 'adapter.failed' ||
        event.eventName === 'adapter.timeout' ||
        event.eventName === 'adapter.cancelled'
      ) {
        const kind = String(event.attributes?.adapterKind ?? '');
        const key = mapAdapterKind(kind);
        if (key) {
          providers[key] =
            event.eventName === 'adapter.completed' ? 'HEALTHY' : 'DEGRADED';
        }
      }

      if (
        event.eventName === 'notification.sent' ||
        event.eventName === 'notification.failed'
      ) {
        const channel = String(event.attributes?.channel ?? '').toUpperCase();
        if (channel === 'EMAIL') {
          providers.email =
            event.eventName === 'notification.sent' ? 'HEALTHY' : 'DEGRADED';
        } else if (channel === 'TELEGRAM') {
          providers.telegram =
            event.eventName === 'notification.sent' ? 'HEALTHY' : 'DEGRADED';
        }
      }
    },
    snapshot() {
      return {
        providers: { ...providers },
        contentionObserved,
        telemetryErrors,
      };
    },
    markTelemetryFailure() {
      telemetryErrors += 1;
    },
  };
}

function mapAdapterKind(kind: string): ProviderObservationKey | undefined {
  switch (kind) {
    case 'search':
    case 'ai':
    case 'fetch':
    case 'extract':
    case 'verify':
      return kind;
    default:
      return undefined;
  }
}

/**
 * Wrap a telemetry sink to record operational observations.
 * Failures of the inner sink are isolated and marked.
 */
export function wrapTelemetryWithObservations(
  inner: DiscoveryTelemetry,
  tracker: OperationalObservationTracker
): DiscoveryTelemetry {
  return {
    emit(event) {
      try {
        tracker.record(event);
      } catch {
        tracker.markTelemetryFailure();
      }
      try {
        const result = inner.emit(event);
        if (result && typeof (result as Promise<void>).then === 'function') {
          void (result as Promise<void>).catch(() => {
            tracker.markTelemetryFailure();
          });
        }
      } catch {
        tracker.markTelemetryFailure();
      }
    },
  };
}
