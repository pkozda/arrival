import type { Clock } from '../scheduler/clock.js';
import { clockIso } from '../scheduler/clock.js';
import { sanitizeTelemetryAttributes } from './sanitize.js';
import {
  categoryForEventName,
  type DiscoveryTelemetry,
  type DiscoveryTelemetryAttributes,
  type DiscoveryTelemetryEvent,
  type DiscoveryTelemetryEventName,
  type TelemetryEventIdGenerator,
} from './types.js';

export type EmitTelemetryInput = {
  eventName: DiscoveryTelemetryEventName;
  runId?: string;
  jobId?: string;
  scheduleId?: string;
  profileId?: string;
  strategyId?: string;
  attempt?: number;
  runtimeInstanceId?: string;
  durationMs?: number;
  attributes?: DiscoveryTelemetryAttributes;
};

export type TelemetryEmitter = {
  emit(input: EmitTelemetryInput): void;
};

export function createNoopDiscoveryTelemetry(): DiscoveryTelemetry {
  return {
    emit() {
      /* intentionally empty */
    },
  };
}

/**
 * Best-effort emit: never throws into discovery control flow.
 */
export function safeEmit(
  telemetry: DiscoveryTelemetry | undefined,
  event: DiscoveryTelemetryEvent
): void {
  if (!telemetry) return;
  try {
    const result = telemetry.emit(event);
    if (result && typeof (result as Promise<void>).then === 'function') {
      void (result as Promise<void>).catch(() => {
        /* isolate async telemetry failures */
      });
    }
  } catch {
    /* isolate sync telemetry failures */
  }
}

export type CreateTelemetryEmitterOptions = {
  telemetry?: DiscoveryTelemetry;
  clock: Clock;
  eventIdGenerator?: TelemetryEventIdGenerator;
  runtimeInstanceId?: string;
  secrets?: readonly string[];
};

let defaultEventSeq = 0;

export function createIncrementingTelemetryEventIdGenerator(
  prefix = 'tel'
): TelemetryEventIdGenerator {
  let seq = 0;
  return () => {
    seq += 1;
    return `${prefix}-${seq}`;
  };
}

/**
 * Builds sanitized events and emits via safeEmit.
 */
export function createTelemetryEmitter(
  options: CreateTelemetryEmitterOptions
): TelemetryEmitter {
  const telemetry = options.telemetry ?? createNoopDiscoveryTelemetry();
  const eventIdGenerator =
    options.eventIdGenerator ??
    (() => {
      defaultEventSeq += 1;
      return `tel-auto-${defaultEventSeq}`;
    });
  const secrets = options.secrets ?? [];

  return {
    emit(input) {
      const event: DiscoveryTelemetryEvent = {
        eventId: eventIdGenerator(),
        eventName: input.eventName,
        category: categoryForEventName(input.eventName),
        occurredAt: clockIso(options.clock),
        runId: input.runId,
        jobId: input.jobId,
        scheduleId: input.scheduleId,
        profileId: input.profileId,
        strategyId: input.strategyId,
        attempt: input.attempt,
        runtimeInstanceId:
          input.runtimeInstanceId ?? options.runtimeInstanceId,
        durationMs: input.durationMs,
        attributes: sanitizeTelemetryAttributes(input.attributes, secrets),
      };
      safeEmit(telemetry, event);
    },
  };
}

/**
 * Measure an async operation and attach durationMs to a completion event.
 * Failures in telemetry never affect the operation result.
 */
export async function measureTelemetryOperation<T>(
  emitter: TelemetryEmitter,
  input: {
    startEvent: DiscoveryTelemetryEventName;
    successEvent: DiscoveryTelemetryEventName;
    failureEvent: DiscoveryTelemetryEventName;
    correlation?: Omit<EmitTelemetryInput, 'eventName' | 'durationMs'>;
    clock: Clock;
  },
  operation: () => Promise<T>
): Promise<T> {
  const startedMs = input.clock.now().getTime();
  emitter.emit({
    eventName: input.startEvent,
    ...input.correlation,
  });
  try {
    const result = await operation();
    emitter.emit({
      eventName: input.successEvent,
      ...input.correlation,
      durationMs: Math.max(0, input.clock.now().getTime() - startedMs),
    });
    return result;
  } catch (err) {
    emitter.emit({
      eventName: input.failureEvent,
      ...input.correlation,
      durationMs: Math.max(0, input.clock.now().getTime() - startedMs),
      attributes: {
        ...input.correlation?.attributes,
        errorName: err instanceof Error ? err.name : 'Error',
      },
    });
    throw err;
  }
}
