/**
 * Provider-neutral Discovery observability (E5.5).
 * Telemetry is side-channel only — never a source of truth.
 */

export type DiscoveryTelemetryCategory =
  | 'runtime'
  | 'scheduler'
  | 'queue'
  | 'worker'
  | 'pipeline'
  | 'adapter'
  | 'ai'
  | 'retry'
  | 'persistence'
  | 'notification';

export type DiscoveryTelemetryEventName =
  | 'runtime.created'
  | 'runtime.closed'
  | 'scheduler.triggered'
  | 'scheduler.skipped'
  | 'scheduler.lock_contended'
  | 'scheduler.enqueued'
  | 'queue.enqueued'
  | 'queue.claimed'
  | 'queue.acked'
  | 'queue.failed'
  | 'queue.retried'
  | 'queue.recovered'
  | 'worker.started'
  | 'worker.completed'
  | 'worker.failed'
  | 'worker.cancelled'
  | 'worker.retry_scheduled'
  | 'pipeline.started'
  | 'pipeline.completed'
  | 'pipeline.partial_success'
  | 'pipeline.failed'
  | 'adapter.started'
  | 'adapter.completed'
  | 'adapter.failed'
  | 'adapter.timeout'
  | 'adapter.cancelled'
  | 'ai.gate.skipped'
  | 'ai.evaluation.started'
  | 'ai.evaluation.completed'
  | 'ai.evaluation.deduplicated'
  | 'ai.budget.exhausted'
  | 'persistence.created'
  | 'persistence.updated'
  | 'persistence.failed'
  | 'notification.started'
  | 'notification.sent'
  | 'notification.failed'
  | 'notification.skipped'
  | 'retry.scheduled'
  | 'retry.exhausted'
  | 'retry.not_allowed';

/** Safe string metadata only — never secrets, HTML, prompts, or raw provider payloads. */
export type DiscoveryTelemetryAttributes = Record<
  string,
  string | number | boolean | undefined
>;

export type DiscoveryTelemetryEnvelope = {
  eventId: string;
  eventName: DiscoveryTelemetryEventName;
  category: DiscoveryTelemetryCategory;
  occurredAt: string;
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

export type DiscoveryTelemetryEvent = DiscoveryTelemetryEnvelope;

/**
 * Provider-neutral telemetry port.
 * Implementations must not throw into discovery control flow when wrapped via safeEmit.
 */
export type DiscoveryTelemetry = {
  emit(event: DiscoveryTelemetryEvent): void | Promise<void>;
};

export type TelemetryEventIdGenerator = () => string;

export function categoryForEventName(
  eventName: DiscoveryTelemetryEventName
): DiscoveryTelemetryCategory {
  const prefix = eventName.split('.')[0]!;
  return prefix as DiscoveryTelemetryCategory;
}
