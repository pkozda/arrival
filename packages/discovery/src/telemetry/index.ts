export type {
  DiscoveryTelemetry,
  DiscoveryTelemetryEvent,
  DiscoveryTelemetryEventName,
  DiscoveryTelemetryCategory,
  DiscoveryTelemetryAttributes,
  DiscoveryTelemetryEnvelope,
  TelemetryEventIdGenerator,
} from './types.js';
export { categoryForEventName } from './types.js';

export {
  createNoopDiscoveryTelemetry,
  createTelemetryEmitter,
  createIncrementingTelemetryEventIdGenerator,
  safeEmit,
  measureTelemetryOperation,
} from './emitter.js';
export type {
  EmitTelemetryInput,
  TelemetryEmitter,
  CreateTelemetryEmitterOptions,
} from './emitter.js';

export {
  sanitizeTelemetryAttributes,
  assertTelemetryEventHasNoSecrets,
} from './sanitize.js';

export { createInMemoryDiscoveryTelemetry } from './fakes/in-memory-telemetry.js';
export type { InMemoryDiscoveryTelemetry } from './fakes/in-memory-telemetry.js';

export {
  wrapAdapterPortsForTelemetry,
  wrapResultWriterForTelemetry,
  wrapExecutionQueueForTelemetry,
} from './instrumentation.js';
export type { AdapterTelemetryMeta } from './instrumentation.js';

export {
  createOperationalObservationTracker,
  wrapTelemetryWithObservations,
} from './observations.js';
export type {
  OperationalObservationTracker,
  OperationalObservations,
  ProviderObservationKey,
} from './observations.js';
