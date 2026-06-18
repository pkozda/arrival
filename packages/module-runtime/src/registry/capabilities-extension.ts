import type { ModuleCapabilities } from '../types/ModuleCapabilities.js';

/**
 * Lightweight registry extension for capability inspection (MRC-5 precursor).
 */
export interface ModuleRegistryCapabilitiesExtension {
  getCapabilities(moduleId: string): ModuleCapabilities | undefined;
}
