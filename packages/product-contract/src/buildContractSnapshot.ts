import type { GovernedModuleRegistry } from '@arrival-atlas/module-runtime';
import type { ContractSnapshot } from './ContractSnapshot.js';
import { normalizeCapabilities } from './normalizeCapabilities.js';
import { resolveProductMetadata } from './moduleProductMetadata.js';
import { convertZodToJsonSchema } from './zodToJsonSchema.js';

export function buildContractSnapshot(
  registry: GovernedModuleRegistry,
  frozenAt: string = new Date().toISOString()
): Record<string, ContractSnapshot> {
  const snapshots: Record<string, ContractSnapshot> = {};

  for (const moduleId of registry.listModuleIds()) {
    const registration = registry.get(moduleId);
    const contract = registry.getModuleContract(moduleId);

    if (!registration || !contract) {
      continue;
    }

    snapshots[moduleId] = {
      contractVersion: '1.0',
      moduleId,
      title: contract.name,
      version: contract.version,
      inputSchema: convertZodToJsonSchema(registration.module.inputSchema),
      outputSchema: convertZodToJsonSchema(registration.module.outputSchema),
      capabilities: normalizeCapabilities(contract),
      metadata: resolveProductMetadata(moduleId),
      frozenAt,
    };
  }

  return snapshots;
}
