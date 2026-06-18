import { compiledModuleCatalog } from '@arrivalos/modules';
import {
  bootstrapObservability,
  buildGovernanceHealth,
  buildModuleHealthSummary,
  buildNormalizerGoldenBaseline,
  type ObservabilityRuntimeState,
} from '@arrivalos/observability';
import { globalRegistry } from '@arrivalos/core';
import type { ContractSnapshotStore } from '@arrivalos/product-contract';
import type { GovernedModuleRegistry } from '@arrivalos/module-runtime';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NormalizerGoldenBaseline } from '@arrivalos/observability';

function loadNormalizerBaseline(): NormalizerGoldenBaseline {
  try {
    const baselinePath = join(
      dirname(fileURLToPath(import.meta.url)),
      '../../../packages/observability/baselines/normalizer-golden-baseline.json'
    );
    return JSON.parse(readFileSync(baselinePath, 'utf8')) as NormalizerGoldenBaseline;
  } catch {
    return buildNormalizerGoldenBaseline();
  }
}

let observabilityState: ObservabilityRuntimeState | null = null;

export function ensureObservabilityState(params: {
  governedRegistry: GovernedModuleRegistry;
  contractStore: ContractSnapshotStore;
}): ObservabilityRuntimeState {
  if (!observabilityState) {
    observabilityState = bootstrapObservability({
      sdkCatalog: compiledModuleCatalog,
      contractStore: params.contractStore,
      registryFrozen: globalRegistry.isRegistrationFrozen(),
      registeredModuleCount: params.governedRegistry.listModuleIds().length,
      normalizerBaseline: loadNormalizerBaseline(),
    });
  }

  return observabilityState;
}

export function buildGovernanceHealthReport(params: {
  governedRegistry: GovernedModuleRegistry;
  contractStore: ContractSnapshotStore;
}) {
  const observability = ensureObservabilityState(params);

  return buildGovernanceHealth({
    registryFrozen: globalRegistry.isRegistrationFrozen(),
    registeredModules: params.governedRegistry.listModuleIds().length,
    contractStore: params.contractStore,
    observability,
  });
}

export function buildModulesHealthReport(params: {
  governedRegistry: GovernedModuleRegistry;
  contractStore: ContractSnapshotStore;
}) {
  const observability = ensureObservabilityState(params);
  const sdkVersions = Object.fromEntries(
    compiledModuleCatalog.contracts.map((contract) => [contract.moduleId, contract.version])
  );

  return buildModuleHealthSummary({
    contractStore: params.contractStore,
    sdkVersions,
    driftFindings: observability.driftFindings,
  });
}

export function getNormalizerBaseline() {
  return loadNormalizerBaseline();
}

export function getDefaultNormalizerBaseline() {
  return buildNormalizerGoldenBaseline();
}

export function resetObservabilityStateForTests(): void {
  observabilityState = null;
}
