import type { ModuleRegistration } from '@arrivalos/core';
import { ModuleRegistry } from '@arrivalos/core';
import { bootstrapGovernedRuntime } from '../governance/bootstrapGovernedRuntime.js';
import type { GovernedModuleRegistry } from '../governance/GovernedModuleRegistry.js';

/** @deprecated Use bootstrapGovernedRuntime */
export function bootstrapMrcContractRegistry(
  registrations: readonly ModuleRegistration[]
): GovernedModuleRegistry {
  const tempRegistry = new ModuleRegistry();
  for (const registration of registrations) {
    tempRegistry.register(registration);
  }

  return bootstrapGovernedRuntime(tempRegistry, registrations).governedRegistry;
}
