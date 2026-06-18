import type { SdkModuleContractSpec } from '@arrivalos/module-sdk';

export const FINANCIAL_REALITY_CONTRACT: SdkModuleContractSpec = {
  runtimeContractVersion: '1.0',
  capabilities: ['produces-recommendations', 'produces-actions', 'requires-profile'],
  requiresRecommendationNormalizer: true,
  requiresActionNormalizer: true,
};

export const BENEFITS_SIMULATOR_CONTRACT: SdkModuleContractSpec = {
  runtimeContractVersion: '1.0',
  capabilities: [
    'produces-recommendations',
    'produces-actions',
    'produces-risk-warnings',
    'supports-scenarios',
    'supports-comparison',
  ],
  requiresRecommendationNormalizer: true,
  requiresActionNormalizer: true,
};

export const DEFAULT_MODULE_CONTRACT: SdkModuleContractSpec = {
  runtimeContractVersion: '1.0',
  capabilities: [],
  requiresRecommendationNormalizer: false,
  requiresActionNormalizer: false,
};
