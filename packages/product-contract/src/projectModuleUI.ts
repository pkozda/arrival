import type { ModuleResult } from '@arrival-atlas/module-runtime';
import type { ContractSnapshot } from './ContractSnapshot.js';
import type { ModuleUIProjection } from './ModuleUIProjection.js';
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
  const recommendations = sanitizeRecommendations(sealedModuleResult.recommendations);
  const actions = sanitizeActions(sealedModuleResult.actions);
  const explanation = sealedModuleResult.explanation
    ? sanitizeExplanation(sealedModuleResult.explanation)
    : undefined;

  return {
    moduleId: contractSnapshot.moduleId,
    title: contractSnapshot.title,
    status,
    summary: explanation?.summary,
    recommendations,
    actions,
    ...(explanation ? { explanation } : {}),
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
