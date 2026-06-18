import type { ContractSnapshotStore } from '@arrivalos/product-contract';
import type { CompiledModuleCatalog } from '@arrivalos/module-sdk';
import { stableStringify } from '../stableStringify.js';
import type { DriftFinding } from './types.js';

function normalizedCapabilitiesFromSdk(
  contract: CompiledModuleCatalog['contracts'][number]
): unknown {
  return {
    supports: {
      recommendations: contract.spec.capabilities.includes('produces-recommendations'),
      actions: contract.spec.capabilities.includes('produces-actions'),
      explanation: contract.spec.requiresRecommendationNormalizer,
      riskModel: contract.spec.capabilities.includes('produces-risk-warnings'),
    },
  };
}

export function detectContractDrift(params: {
  sdkCatalog: CompiledModuleCatalog;
  contractStore: ContractSnapshotStore;
}): DriftFinding[] {
  const findings: DriftFinding[] = [];

  for (const contract of params.sdkCatalog.contracts) {
    const moduleId = contract.moduleId;
    const snapshot = params.contractStore.getContractSnapshot(moduleId);

    if (!snapshot) {
      findings.push({
        moduleId,
        type: 'schema',
        severity: 'error',
        message: `Missing ContractSnapshot for module "${moduleId}"`,
      });
      continue;
    }

    if (snapshot.version !== contract.version) {
      findings.push({
        moduleId,
        type: 'version',
        severity: 'error',
        message: `Version mismatch for "${moduleId}" (snapshot ${snapshot.version}, sdk ${contract.version})`,
      });
    }

    const snapshotCapabilities = stableStringify(snapshot.capabilities);
    const sdkCapabilities = stableStringify(normalizedCapabilitiesFromSdk(contract));

    if (snapshotCapabilities !== sdkCapabilities) {
      findings.push({
        moduleId,
        type: 'capability',
        severity: 'error',
        message: `Capability drift detected for "${moduleId}"`,
      });
    }
  }

  for (const moduleId of params.contractStore.listModuleIds()) {
    if (!params.sdkCatalog.contracts.some((contract) => contract.moduleId === moduleId)) {
      findings.push({
        moduleId,
        type: 'schema',
        severity: 'error',
        message: `ContractSnapshot exists without SDK definition for "${moduleId}"`,
      });
    }
  }

  return findings;
}
