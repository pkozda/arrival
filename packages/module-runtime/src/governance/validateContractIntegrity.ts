import type { ModuleRegistry } from '@arrival-atlas/core';
import type { RegisteredModuleContract } from '../registry/contract-types.js';

export function validateContractIntegrity(
  coreRegistry: ModuleRegistry,
  modules: Record<string, RegisteredModuleContract>
): { valid: true } | { valid: false; errors: readonly string[] } {
  const errors: string[] = [];
  const contractIds = new Set(Object.keys(modules));
  const coreIds = new Set(coreRegistry.list(true).map((registration) => registration.id));

  for (const moduleId of contractIds) {
    if (!coreIds.has(moduleId)) {
      errors.push(
        `Module "${moduleId}" exists in the governance kernel but not in the execution registry`
      );
    }
  }

  for (const moduleId of coreIds) {
    if (!contractIds.has(moduleId)) {
      errors.push(
        `Module "${moduleId}" exists in the execution registry but not in the governance kernel`
      );
    }
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}
