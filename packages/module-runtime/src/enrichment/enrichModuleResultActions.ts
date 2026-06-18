import type { ModuleExecutionResult } from '@arrivalos/core';
import type { ModuleResult } from '../types/ModuleResult.js';
import type { GovernedModuleRegistry } from '../governance/GovernedModuleRegistry.js';
import { isMrcActionsEnabled } from '../config/mrc-actions.js';
import { resolveActions } from '../normalizers/normalizer-resolver.js';

export type ActionEnrichmentContext = {
  moduleId: string;
  governedRegistry?: GovernedModuleRegistry;
};

export function enrichModuleResultActions(
  envelope: ModuleResult,
  legacy: ModuleExecutionResult,
  context: ActionEnrichmentContext
): ModuleResult {
  if (!isMrcActionsEnabled() || envelope.status !== 'success') {
    return envelope;
  }

  const actions = resolveActions({
    moduleId: context.moduleId,
    payload: legacy.data,
    recommendations: envelope.recommendations,
    governedRegistry: context.governedRegistry,
  });

  return {
    ...envelope,
    actions,
  };
}
