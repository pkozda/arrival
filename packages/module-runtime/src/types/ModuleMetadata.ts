import type { ModuleMetadata as CoreModuleMetadata } from '@arrival-atlas/core';

export type ModuleRuntimeContractVersion = '1.0';

/**
 * MRC-aware module metadata. Extends core metadata without modifying core usage.
 */
export type MrcModuleMetadata = CoreModuleMetadata & {
  runtimeContractVersion: ModuleRuntimeContractVersion;
};
