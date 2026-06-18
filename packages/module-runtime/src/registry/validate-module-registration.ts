import type { ModuleRegistration } from '@arrivalos/core';
import type { ValidationResult } from './contract-types.js';
import {
  MODULE_CONTRACT_SPECS,
  resolveModuleContractSpec,
} from './module-contract-definitions.js';

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
const MODULE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateModuleRegistration(
  registration: ModuleRegistration,
  options?: { existingIds?: ReadonlySet<string> }
): ValidationResult {
  const errors: string[] = [];
  const spec = resolveModuleContractSpec(registration.id);

  if (!MODULE_ID_PATTERN.test(registration.id)) {
    errors.push(`moduleId "${registration.id}" must be kebab-case`);
  }

  if (!SEMVER_PATTERN.test(registration.version)) {
    errors.push(`module "${registration.id}" version must be semver (x.y.z)`);
  }

  if (options?.existingIds?.has(registration.id)) {
    errors.push(`duplicate moduleId "${registration.id}"`);
  }

  if (registration.module.id !== registration.id) {
    errors.push(`module.id must match registration.id for "${registration.id}"`);
  }

  if (typeof registration.module.execute !== 'function') {
    errors.push(`module "${registration.id}" must define execute()`);
  }

  if (!registration.module.inputSchema) {
    errors.push(`module "${registration.id}" must define inputSchema`);
  }

  if (!registration.module.outputSchema) {
    errors.push(`module "${registration.id}" must define outputSchema`);
  }

  if (typeof registration.name !== 'string' || registration.name.length === 0) {
    errors.push(`module "${registration.id}" must define a non-empty name`);
  }

  if (spec.runtimeContractVersion !== '1.0') {
    errors.push(`module "${registration.id}" must declare runtimeContractVersion 1.0`);
  }

  if (
    registration.id in MODULE_CONTRACT_SPECS &&
    spec.capabilities.length === 0
  ) {
    errors.push(`module "${registration.id}" must declare non-empty capabilities`);
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}
