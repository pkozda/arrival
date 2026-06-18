export type BootstrapIntegritySnapshot = {
  moduleCount: number;
  governanceChecksum: string;
  snapshotChecksum: string;
  generatedAt: string;
};

export type ObservabilityBootstrapInput = {
  sdkCatalog: import('@arrivalos/module-sdk').CompiledModuleCatalog;
  contractStore: import('@arrivalos/product-contract').ContractSnapshotStore;
  registryFrozen: boolean;
  registeredModuleCount: number;
};

export type ObservabilityRuntimeState = {
  integrity: BootstrapIntegritySnapshot;
  driftFindings: import('../drift/types.js').DriftFinding[];
  bootstrapCompleted: boolean;
};
