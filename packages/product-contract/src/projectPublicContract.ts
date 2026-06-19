import type { GovernedModuleRegistry } from '@arrival-atlas/module-runtime';
import type { PublicModuleContract } from './PublicModuleContract.js';
import { mapModuleStatus } from './mapModuleStatus.js';
import { normalizeCapabilities } from './normalizeCapabilities.js';
import { resolveProductMetadata } from './moduleProductMetadata.js';

export type ProjectPublicContractOptions = {
  entitlementAccess?: Readonly<Record<string, boolean>>;
};

export function projectPublicModuleContract(
  registry: GovernedModuleRegistry,
  moduleId: string,
  options: ProjectPublicContractOptions = {}
): PublicModuleContract | undefined {
  const registration = registry.get(moduleId);
  const contract = registry.getModuleContract(moduleId);

  if (!registration || !contract) {
    return undefined;
  }

  return {
    id: contract.moduleId,
    title: contract.name,
    description: registration.description ?? '',
    version: contract.version,
    status: mapModuleStatus({
      enabled: registration.enabled,
      entitlementAllowed: options.entitlementAccess?.[moduleId],
    }),
    capabilities: normalizeCapabilities(contract),
    metadata: resolveProductMetadata(contract.moduleId),
  };
}

export function projectPublicContract(
  registry: GovernedModuleRegistry,
  options: ProjectPublicContractOptions = {}
): PublicModuleContract[] {
  return registry
    .list(true)
    .map((registration) =>
      projectPublicModuleContract(registry, registration.id, options)
    )
    .filter((contract): contract is PublicModuleContract => contract !== undefined)
    .sort((left, right) => left.id.localeCompare(right.id));
}
