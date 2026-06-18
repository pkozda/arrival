import { detectContractDrift } from '../drift/detectContractDrift.js';
import { detectSnapshotDrift } from '../drift/detectSnapshotDrift.js';
import {
  validateNormalizerIntegrity,
  type NormalizerGoldenBaseline,
} from '../drift/validateNormalizerIntegrity.js';
import { buildBootstrapIntegritySnapshot } from './buildBootstrapIntegritySnapshot.js';
import type { ObservabilityBootstrapInput, ObservabilityRuntimeState } from './types.js';

export function bootstrapObservability(
  input: ObservabilityBootstrapInput & {
    normalizerBaseline: NormalizerGoldenBaseline;
  },
  previousIntegrity?: ObservabilityRuntimeState['integrity']
): ObservabilityRuntimeState {
  const integrity = buildBootstrapIntegritySnapshot(input);
  const contractDrift = detectContractDrift({
    sdkCatalog: input.sdkCatalog,
    contractStore: input.contractStore,
  });
  const snapshotDrift = previousIntegrity
    ? detectSnapshotDrift({ stored: previousIntegrity, recomputed: integrity })
    : [];
  const normalizerDrift = validateNormalizerIntegrity(input.normalizerBaseline);

  const moduleCountConsistent = integrity.moduleCount === input.registeredModuleCount;
  const bootstrapCompleted =
    input.registryFrozen &&
    input.contractStore.listModuleIds().length === input.registeredModuleCount &&
    moduleCountConsistent;

  return {
    integrity,
    driftFindings: [...contractDrift, ...snapshotDrift, ...normalizerDrift],
    bootstrapCompleted,
  };
}
