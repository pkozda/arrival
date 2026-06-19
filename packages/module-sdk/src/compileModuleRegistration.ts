import type { Module, ModuleRegistration } from '@arrival-atlas/core';
import { hashStableValue, hashZodSchema } from './hashZodSchema.js';
import type {
  CompiledSdkModule,
  SdkModuleDefinition,
  SdkModuleFingerprints,
} from './types/SdkModuleDefinition.js';

function buildFingerprints(definition: SdkModuleDefinition): SdkModuleFingerprints {
  return {
    inputSchemaHash: hashZodSchema(definition.inputSchema),
    outputSchemaHash: hashZodSchema(definition.outputSchema),
    capabilitiesHash: hashStableValue(definition.contract?.capabilities ?? []),
    recommendationShapeHash: hashStableValue(definition.recommendations ?? []),
    actionShapeHash: hashStableValue(definition.actions ?? []),
  };
}

export function compileModuleRegistration(definition: SdkModuleDefinition): CompiledSdkModule {
  const contract = definition.contract ?? {
    runtimeContractVersion: '1.0' as const,
    capabilities: [],
    requiresRecommendationNormalizer: false,
    requiresActionNormalizer: false,
  };

  const module: Module = {
    id: definition.id,
    name: definition.name,
    version: definition.version,
    description: definition.description,
    inputSchema: definition.inputSchema,
    outputSchema: definition.outputSchema,
    execute: definition.execute,
  };

  const registration: ModuleRegistration = {
    id: definition.id,
    name: definition.name,
    version: definition.version,
    description: definition.description,
    enabled: definition.enabled ?? true,
    featureFlags: definition.featureFlags ?? {},
    module,
  };

  return {
    registration,
    contract: {
      moduleId: definition.id,
      name: definition.name,
      version: definition.version,
      spec: contract,
    },
    fingerprints: buildFingerprints(definition),
  };
}
