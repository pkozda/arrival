import type { DiscoveryTelemetry, DiscoveryTelemetryEvent } from '../types.js';

export type InMemoryDiscoveryTelemetry = DiscoveryTelemetry & {
  events(): readonly DiscoveryTelemetryEvent[];
  eventsByName(
    eventName: DiscoveryTelemetryEvent['eventName']
  ): readonly DiscoveryTelemetryEvent[];
  clear(): void;
};

/**
 * Deterministic test telemetry sink.
 */
export function createInMemoryDiscoveryTelemetry(): InMemoryDiscoveryTelemetry {
  const recorded: DiscoveryTelemetryEvent[] = [];
  return {
    emit(event) {
      recorded.push(structuredClone(event));
    },
    events() {
      return recorded.map((e) => structuredClone(e));
    },
    eventsByName(eventName) {
      return recorded
        .filter((e) => e.eventName === eventName)
        .map((e) => structuredClone(e));
    },
    clear() {
      recorded.length = 0;
    },
  };
}
