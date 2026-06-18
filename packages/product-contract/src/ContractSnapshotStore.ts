import type { ContractSnapshot } from './ContractSnapshot.js';

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  Object.freeze(value);

  if (Array.isArray(value)) {
    for (const entry of value) {
      deepFreeze(entry);
    }

    return value;
  }

  for (const entry of Object.values(value as Record<string, unknown>)) {
    deepFreeze(entry);
  }

  return value;
}

export type ContractSnapshotStore = {
  readonly frozen: true;
  getContractSnapshot(moduleId: string): ContractSnapshot | undefined;
  listModuleIds(): readonly string[];
};

export function createContractSnapshotStore(
  snapshots: Record<string, ContractSnapshot>
): ContractSnapshotStore {
  const frozenSnapshots = deepFreeze(structuredClone(snapshots));

  const store: ContractSnapshotStore = {
    frozen: true,

    getContractSnapshot(moduleId: string) {
      return frozenSnapshots[moduleId];
    },

    listModuleIds() {
      return Object.freeze(Object.keys(frozenSnapshots).sort());
    },
  };

  return deepFreeze(store);
}
