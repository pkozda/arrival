import type { DiscoveryRuntimeHealth } from '@arrival-atlas/discovery';
import { getDiscoveryExecutionService } from './discovery-execution-runtime.js';

/** Atlas ops HTTP response — E5.6 health contract (already redacted at source). */
export type AtlasDiscoveryOpsHealthResponse = DiscoveryRuntimeHealth;

/**
 * Operator health snapshot (E11.1): reuses DiscoveryService.getHealth() after start.
 * No SQLite reads or health recomputation in the API layer.
 */
export async function getDiscoveryOpsHealth(): Promise<AtlasDiscoveryOpsHealthResponse> {
  const discoveryService = getDiscoveryExecutionService();
  await discoveryService.start();
  return discoveryService.getHealth();
}
