import { sha256Checksum } from '../sha256.js';
import type { ContractSnapshot } from '@arrivalos/product-contract';
import type { ObservabilityBootstrapInput, BootstrapIntegritySnapshot } from './types.js';

function snapshotPayloadWithoutTimestamps(snapshots: Record<string, ContractSnapshot>): unknown {
  return Object.keys(snapshots)
    .sort()
    .map((moduleId) => {
      const snapshot = snapshots[moduleId]!;
      return {
        moduleId: snapshot.moduleId,
        version: snapshot.version,
        inputSchema: snapshot.inputSchema,
        outputSchema: snapshot.outputSchema,
        capabilities: snapshot.capabilities,
      };
    });
}

function governancePayload(input: ObservabilityBootstrapInput): unknown {
  return {
    registryFrozen: input.registryFrozen,
    modules: input.sdkCatalog.contracts
      .map((contract) => ({
        moduleId: contract.moduleId,
        version: contract.version,
        capabilities: [...contract.spec.capabilities].sort(),
        requiresRecommendationNormalizer: contract.spec.requiresRecommendationNormalizer,
        requiresActionNormalizer: contract.spec.requiresActionNormalizer,
      }))
      .sort((left, right) => left.moduleId.localeCompare(right.moduleId)),
  };
}

export function buildBootstrapIntegritySnapshot(
  input: ObservabilityBootstrapInput
): BootstrapIntegritySnapshot {
  const snapshots: Record<string, ContractSnapshot> = {};

  for (const moduleId of input.contractStore.listModuleIds()) {
    const snapshot = input.contractStore.getContractSnapshot(moduleId);
    if (snapshot) {
      snapshots[moduleId] = snapshot;
    }
  }

  return {
    moduleCount: input.registeredModuleCount,
    governanceChecksum: sha256Checksum(governancePayload(input)),
    snapshotChecksum: sha256Checksum(snapshotPayloadWithoutTimestamps(snapshots)),
    generatedAt: new Date().toISOString(),
  };
}
