import type { NormalizedCapabilities } from './NormalizedCapabilities.js';
import type { JsonSchema } from './JsonSchema.js';
import type { ContractSnapshotStore } from './ContractSnapshotStore.js';

export type ModuleSchemaProjection = {
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
};

export function projectModuleSchema(
  store: ContractSnapshotStore,
  moduleId: string
): ModuleSchemaProjection | undefined {
  const snapshot = store.getContractSnapshot(moduleId);
  if (!snapshot) {
    return undefined;
  }

  return {
    inputSchema: snapshot.inputSchema,
    outputSchema: snapshot.outputSchema,
  };
}

export function projectModuleCapabilities(
  store: ContractSnapshotStore,
  moduleId: string
): NormalizedCapabilities | undefined {
  return store.getContractSnapshot(moduleId)?.capabilities;
}
