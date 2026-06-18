import type { ModuleRegistration } from '@arrivalos/core';
import { defineModuleVersion } from './defineModuleVersion.js';
import type {
  DefineModuleInput,
  SdkModuleContractSpec,
  SdkModuleDefinition,
} from './types/SdkModuleDefinition.js';

const MODULE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const DEFAULT_CONTRACT: SdkModuleContractSpec = {
  runtimeContractVersion: '1.0',
  capabilities: [],
  requiresRecommendationNormalizer: false,
  requiresActionNormalizer: false,
};

export function defineModule<TInput = unknown, TOutput = unknown>(
  input: DefineModuleInput<TInput, TOutput>
): SdkModuleDefinition<TInput, TOutput> {
  if (!MODULE_ID_PATTERN.test(input.id)) {
    throw new Error(`Module id must be kebab-case: "${input.id}"`);
  }

  if (input.id !== input.id.trim()) {
    throw new Error(`Module id must not contain surrounding whitespace: "${input.id}"`);
  }

  defineModuleVersion(input.version);

  if (typeof input.execute !== 'function') {
    throw new Error(`Module "${input.id}" must define execute()`);
  }

  return {
    ...input,
    enabled: input.enabled ?? true,
    featureFlags: input.featureFlags ?? {},
    contract: input.contract ?? DEFAULT_CONTRACT,
    recommendations: input.recommendations ?? [],
    actions: input.actions ?? [],
  };
}

export function defineModuleFromRegistration(
  registration: ModuleRegistration,
  contract: SdkModuleContractSpec,
  metadata?: {
    recommendations?: DefineModuleInput['recommendations'];
    actions?: DefineModuleInput['actions'];
  }
): SdkModuleDefinition {
  return defineModule({
    id: registration.id,
    name: registration.name,
    description: registration.module.description,
    version: registration.version,
    inputSchema: registration.module.inputSchema,
    outputSchema: registration.module.outputSchema,
    execute: registration.module.execute.bind(registration.module),
    enabled: registration.enabled,
    featureFlags: registration.featureFlags,
    contract,
    recommendations: metadata?.recommendations ?? [],
    actions: metadata?.actions ?? [],
  });
}
