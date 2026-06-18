import type {
  GovernanceExecutionContext,
  GovernanceKernelState,
  PolicyDecision,
} from './types.js';

export function authorizeExecution(
  state: GovernanceKernelState,
  context: GovernanceExecutionContext
): PolicyDecision {
  const contract = state.modules[context.moduleId];
  if (!contract) {
    return {
      authorized: false,
      reason: `Module "${context.moduleId}" is not registered in the governance kernel`,
    };
  }

  const registration = state.getRegistration(context.moduleId);
  if (!registration) {
    return {
      authorized: false,
      reason: `Module "${context.moduleId}" is missing from the execution registry`,
    };
  }

  if (!registration.enabled) {
    return {
      authorized: false,
      reason: `Module "${context.moduleId}" is disabled`,
    };
  }

  if (
    contract.spec.requiresRecommendationNormalizer &&
    state.recommendationNormalizers[context.moduleId] === undefined
  ) {
    return {
      authorized: false,
      reason: `Module "${context.moduleId}" is missing a recommendation normalizer binding`,
    };
  }

  if (
    contract.spec.requiresActionNormalizer &&
    state.actionNormalizers[context.moduleId] === undefined
  ) {
    return {
      authorized: false,
      reason: `Module "${context.moduleId}" is missing an action normalizer binding`,
    };
  }

  for (const constraint of buildExecutionConstraints(contract)) {
    if (constraint === 'requires-recommendation-normalizer') {
      if (!contract.spec.capabilities.includes('produces-recommendations')) {
        return {
          authorized: false,
          reason: `Module "${context.moduleId}" violates recommendation capability constraint`,
        };
      }
    }

    if (constraint === 'requires-action-normalizer') {
      if (!contract.spec.capabilities.includes('produces-actions')) {
        return {
          authorized: false,
          reason: `Module "${context.moduleId}" violates action capability constraint`,
        };
      }
    }
  }

  try {
    registration.module.inputSchema.parse(context.input);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid input';
    return {
      authorized: false,
      reason: `Module "${context.moduleId}" input failed schema validation: ${message}`,
    };
  }

  return { authorized: true };
}

function buildExecutionConstraints(
  contract: GovernanceKernelState['modules'][string]
): readonly string[] {
  return [
    'deterministic-execute',
    'side-effect-free',
    ...(contract.spec.requiresRecommendationNormalizer
      ? ['requires-recommendation-normalizer']
      : []),
    ...(contract.spec.requiresActionNormalizer ? ['requires-action-normalizer'] : []),
  ];
}
