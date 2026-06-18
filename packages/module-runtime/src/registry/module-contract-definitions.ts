import type { ModuleContractSpec } from './contract-types.js';

export const DEFAULT_MODULE_CONTRACT_SPEC: ModuleContractSpec = {
  runtimeContractVersion: '1.0',
  capabilities: [],
  requiresRecommendationNormalizer: false,
  requiresActionNormalizer: false,
};

export const MODULE_CONTRACT_SPECS: Record<string, ModuleContractSpec> = {
  'financial-reality': {
    runtimeContractVersion: '1.0',
    capabilities: ['produces-recommendations', 'produces-actions', 'requires-profile'],
    requiresRecommendationNormalizer: true,
    requiresActionNormalizer: true,
  },
  'benefits-simulator': {
    runtimeContractVersion: '1.0',
    capabilities: [
      'produces-recommendations',
      'produces-actions',
      'supports-scenarios',
      'supports-comparison',
    ],
    requiresRecommendationNormalizer: true,
    requiresActionNormalizer: true,
  },
};

export function resolveModuleContractSpec(moduleId: string): ModuleContractSpec {
  return MODULE_CONTRACT_SPECS[moduleId] ?? DEFAULT_MODULE_CONTRACT_SPEC;
}
