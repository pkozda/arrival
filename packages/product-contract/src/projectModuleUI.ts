import type { ModuleResult } from '@arrival-atlas/module-runtime';
import type { ContractSnapshot } from './ContractSnapshot.js';
import type { ModuleExecutionOutcome, ModuleUIProjection } from './ModuleUIProjection.js';
import { readModuleProjectionSemantics } from './readModuleProjectionSemantics.js';
import {
  sanitizeActions,
  sanitizeExplanation,
  sanitizeRecommendations,
} from './sanitizeModuleUI.js';

function mapResultStatus(status: ModuleResult['status']): ModuleUIProjection['status'] {
  return status === 'success' ? 'success' : 'error';
}

function mapErrorCode(status: ModuleResult['status']): string | undefined {
  if (status === 'validation_error') {
    return 'validation_error';
  }

  if (status === 'execution_error') {
    return 'execution_error';
  }

  return undefined;
}

export function projectModuleUI(
  sealedModuleResult: ModuleResult,
  contractSnapshot: ContractSnapshot
): ModuleUIProjection {
  const status = mapResultStatus(sealedModuleResult.status);
  const sealedRecommendations = sanitizeRecommendations(sealedModuleResult.recommendations);
  const actions = sanitizeActions(sealedModuleResult.actions);
  const explanation = sealedModuleResult.explanation
    ? sanitizeExplanation(sealedModuleResult.explanation)
    : undefined;

  const semantics = readModuleProjectionSemantics(sealedModuleResult);
  const outcome: ModuleExecutionOutcome | undefined =
    status === 'error' ? 'TECHNICAL_ERROR' : semantics.outcome;

  const recommendations =
    sealedRecommendations.length > 0
      ? sealedRecommendations
      : (semantics.fallbackRecommendations ?? sealedRecommendations);

  return {
    moduleId: contractSnapshot.moduleId,
    title: contractSnapshot.title,
    status,
    summary: explanation?.summary ?? semantics.summaryHint,
    recommendations,
    actions,
    ...(explanation ? { explanation } : {}),
    ...(outcome ? { outcome } : {}),
    ...(semantics.missingContext ? { missingContext: semantics.missingContext } : {}),
    ...(semantics.insuranceAssumption
      ? { insuranceAssumption: semantics.insuranceAssumption }
      : {}),
    ...(status === 'error'
      ? {
          error: {
            message: sealedModuleResult.error ?? 'Module execution failed',
            code: mapErrorCode(sealedModuleResult.status),
          },
        }
      : {}),
  };
}
