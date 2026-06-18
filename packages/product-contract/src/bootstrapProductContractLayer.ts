import type { GovernedModuleRegistry } from '@arrivalos/module-runtime';
import { buildContractSnapshot } from './buildContractSnapshot.js';
import {
  createContractSnapshotStore,
  type ContractSnapshotStore,
} from './ContractSnapshotStore.js';

export function bootstrapProductContractLayer(
  registry: GovernedModuleRegistry
): ContractSnapshotStore {
  return createContractSnapshotStore(buildContractSnapshot(registry));
}
