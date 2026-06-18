import type { AppContext } from '@arrivalos/core';
import type { z } from 'zod';
import type { SdkActionDefinition } from '../defineAction.js';
import type { SdkRecommendationDefinition } from '../defineRecommendation.js';

export type SdkModuleCapability =
  | 'produces-recommendations'
  | 'produces-actions'
  | 'produces-risk-warnings'
  | 'requires-profile'
  | 'supports-scenarios'
  | 'supports-comparison';

export type SdkModuleContractSpec = {
  runtimeContractVersion: '1.0';
  capabilities: readonly SdkModuleCapability[];
  requiresRecommendationNormalizer: boolean;
  requiresActionNormalizer: boolean;
};

export type SdkRegisteredModuleContract = {
  moduleId: string;
  name: string;
  version: string;
  spec: SdkModuleContractSpec;
};

export type DefineModuleInput<TInput = unknown, TOutput = unknown> = {
  id: string;
  name: string;
  description: string;
  version: string;
  inputSchema: z.ZodType<TInput, z.ZodTypeDef, unknown>;
  outputSchema: z.ZodType<TOutput, z.ZodTypeDef, unknown>;
  execute: (input: TInput, context: AppContext) => Promise<TOutput>;
  enabled?: boolean;
  featureFlags?: Record<string, boolean>;
  contract?: SdkModuleContractSpec;
  recommendations?: readonly SdkRecommendationDefinition[];
  actions?: readonly SdkActionDefinition[];
};

export type SdkModuleDefinition<TInput = unknown, TOutput = unknown> = DefineModuleInput<
  TInput,
  TOutput
>;

export type CompiledSdkModule = {
  registration: import('@arrivalos/core').ModuleRegistration;
  contract: SdkRegisteredModuleContract;
  fingerprints: SdkModuleFingerprints;
};

export type SdkModuleFingerprints = {
  inputSchemaHash: string;
  outputSchemaHash: string;
  capabilitiesHash: string;
  recommendationShapeHash: string;
  actionShapeHash: string;
};

export type CompiledModuleCatalog = {
  registrations: import('@arrivalos/core').ModuleRegistration[];
  contracts: SdkRegisteredModuleContract[];
  fingerprintsByModuleId: Record<string, SdkModuleFingerprints>;
};
