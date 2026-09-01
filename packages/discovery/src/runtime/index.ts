export type {
  DiscoveryRuntime,
  DiscoveryRuntimeConfig,
  DiscoveryRuntimeHealth,
} from './discovery-runtime.js';
export { createDiscoveryRuntime } from './discovery-runtime.js';

export type {
  DiscoveryHealthStatus,
  DiscoveryHealthWarningCode,
  DiscoveryHealthWarning,
  PersistenceAvailability,
  PersistenceHealth,
  QueueHealth,
  SchedulerHealth,
  RunHealthSummary,
  ProviderObservedStatus,
  ProviderHealthEntry,
  ObservabilityHealth,
  QueueHealthStats,
  AggregateHealthInput,
} from './health.js';
export {
  aggregateDiscoveryHealth,
  DEFAULT_QUEUE_BACKLOG_THRESHOLD,
} from './health.js';
export {
  buildDiscoveryRuntimeHealth,
  buildProviderHealthEntries,
  toRunHealthSummary,
} from './build-health.js';
export type { BuildRuntimeHealthInput } from './build-health.js';

export type {
  DiscoveryRuntimePersistencePaths,
  DiscoveryRuntimeApplicationConfig,
  DiscoveryProviderEnablement,
  DiscoveryRuntimeConfigValidation,
  RedactedDiscoveryRuntimeConfig,
  DiscoveryRuntimeInfrastructureSlice,
} from './runtime-config.js';
export {
  assertDiscoveryRuntimeConfig,
  collectConfigSecrets,
  getDiscoveryProviderEnablement,
  redactDiscoveryRuntimeConfig,
  sanitizeRuntimeErrorMessage,
  validateDiscoveryRuntimeConfig,
} from './runtime-config.js';

export {
  DiscoveryConfigurationError,
  DiscoveryRuntimeClosedError,
  DiscoveryRuntimeConstructionError,
} from './errors.js';

export type { ChannelNotificationAdapters } from './channel-routing-notification-adapter.js';
export { createChannelRoutingNotificationAdapter } from './channel-routing-notification-adapter.js';
