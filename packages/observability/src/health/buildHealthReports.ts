import type { ContractSnapshotStore } from '@arrivalos/product-contract';
import type { DriftFinding } from '../drift/types.js';
import type { ObservabilityRuntimeState } from '../snapshots/types.js';

export type GovernanceHealth = {
  healthy: boolean;
  registryFrozen: boolean;
  registeredModules: number;
  contractSnapshots: number;
  governanceVersion: string;
  checkedAt: string;
};

export function buildGovernanceHealth(params: {
  registryFrozen: boolean;
  registeredModules: number;
  contractStore: ContractSnapshotStore;
  observability: ObservabilityRuntimeState;
}): GovernanceHealth {
  const contractSnapshots = params.contractStore.listModuleIds().length;
  const moduleCountConsistent = params.registeredModules === contractSnapshots;
  const healthy =
    params.registryFrozen &&
    params.observability.bootstrapCompleted &&
    moduleCountConsistent &&
    !params.observability.driftFindings.some((finding) => finding.severity === 'error');

  return {
    healthy,
    registryFrozen: params.registryFrozen,
    registeredModules: params.registeredModules,
    contractSnapshots,
    governanceVersion: '1.0',
    checkedAt: new Date().toISOString(),
  };
}

export type ModuleHealthStatus = 'healthy' | 'warning' | 'error';

export type ModuleHealthSummary = {
  totalModules: number;
  modules: Array<{
    moduleId: string;
    version: string;
    status: ModuleHealthStatus;
  }>;
};

function statusForModule(moduleId: string, findings: DriftFinding[]): ModuleHealthStatus {
  const moduleFindings = findings.filter(
    (finding) => finding.moduleId === moduleId || finding.moduleId === '*'
  );

  if (moduleFindings.some((finding) => finding.severity === 'error')) {
    return 'error';
  }

  if (moduleFindings.length > 0) {
    return 'warning';
  }

  return 'healthy';
}

export function buildModuleHealthSummary(params: {
  contractStore: ContractSnapshotStore;
  sdkVersions: Record<string, string>;
  driftFindings: DriftFinding[];
}): ModuleHealthSummary {
  const modules = params.contractStore
    .listModuleIds()
    .map((moduleId) => ({
      moduleId,
      version: params.sdkVersions[moduleId] ?? params.contractStore.getContractSnapshot(moduleId)?.version ?? '0.0.0',
      status: statusForModule(moduleId, params.driftFindings),
    }))
    .sort((left, right) => left.moduleId.localeCompare(right.moduleId));

  return {
    totalModules: modules.length,
    modules,
  };
}
