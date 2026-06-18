import type { RegisteredModuleContract } from '@arrivalos/module-runtime';
import type { NormalizedCapabilities } from './NormalizedCapabilities.js';

export function normalizeCapabilities(
  contract: RegisteredModuleContract
): NormalizedCapabilities {
  const capabilities = contract.spec.capabilities;

  return {
    supports: {
      recommendations: capabilities.includes('produces-recommendations'),
      actions: capabilities.includes('produces-actions'),
      explanation:
        capabilities.includes('produces-explanations') ||
        contract.spec.requiresRecommendationNormalizer,
      riskModel: capabilities.includes('produces-risk-warnings'),
    },
  };
}
