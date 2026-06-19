import { detectContractDrift } from './drift/detectContractDrift.js';
import { detectSnapshotDrift } from './drift/detectSnapshotDrift.js';
import { validateNormalizerIntegrity } from './drift/validateNormalizerIntegrity.js';

export type { DriftFinding, DriftSeverity, DriftType } from './drift/types.js';
export type {
  BootstrapIntegritySnapshot,
  ObservabilityBootstrapInput,
  ObservabilityRuntimeState,
} from './snapshots/types.js';
export type {
  GovernanceHealth,
  ModuleHealthSummary,
  ModuleHealthStatus,
} from './health/buildHealthReports.js';
export type { ModuleMetrics } from './metrics/MetricsCollector.js';
export type { NormalizerGoldenBaseline } from './drift/validateNormalizerIntegrity.js';

export { stableStringify } from './stableStringify.js';
export { sha256Checksum } from './sha256.js';
export { detectContractDrift } from './drift/detectContractDrift.js';
export { detectSnapshotDrift } from './drift/detectSnapshotDrift.js';
export {
  validateNormalizerIntegrity,
  buildNormalizerGoldenBaseline,
  computeNormalizerGoldenHashes,
  stableNormalizerBaselineFingerprint,
} from './drift/validateNormalizerIntegrity.js';
export { buildBootstrapIntegritySnapshot } from './snapshots/buildBootstrapIntegritySnapshot.js';
export { bootstrapObservability } from './snapshots/bootstrapObservability.js';
export {
  buildGovernanceHealth,
  buildModuleHealthSummary,
} from './health/buildHealthReports.js';
export {
  MetricsCollector,
  globalMetricsCollector,
} from './metrics/MetricsCollector.js';

export function collectDriftFindings(params: {
  sdkCatalog: import('@arrival-atlas/module-sdk').CompiledModuleCatalog;
  contractStore: import('@arrival-atlas/product-contract').ContractSnapshotStore;
  storedIntegrity?: import('./snapshots/types.js').BootstrapIntegritySnapshot;
  recomputedIntegrity: import('./snapshots/types.js').BootstrapIntegritySnapshot;
  normalizerBaseline: import('./drift/validateNormalizerIntegrity.js').NormalizerGoldenBaseline;
}): import('./drift/types.js').DriftFinding[] {
  const contractDrift = detectContractDrift({
    sdkCatalog: params.sdkCatalog,
    contractStore: params.contractStore,
  });
  const snapshotDrift = params.storedIntegrity
    ? detectSnapshotDrift({
        stored: params.storedIntegrity,
        recomputed: params.recomputedIntegrity,
      })
    : [];
  const normalizerDrift = validateNormalizerIntegrity(params.normalizerBaseline);

  return [...contractDrift, ...snapshotDrift, ...normalizerDrift];
}
