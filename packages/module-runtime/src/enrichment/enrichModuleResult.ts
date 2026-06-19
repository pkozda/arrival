import type { ModuleExecutionResult } from '@arrival-atlas/core';
import type { ModuleResult } from '../types/ModuleResult.js';
import type { ModuleRuntimeContext } from '../types/ModuleRuntimeContext.js';
import type { GovernedModuleRegistry } from '../governance/GovernedModuleRegistry.js';
import { isMrcExplanationEnabled } from '../config/mrc-explanation.js';
import { generateModuleExplanation } from '../normalizers/generateModuleExplanation.js';
import { resolveRecommendations } from '../normalizers/normalizer-resolver.js';

export type SemanticEnrichmentContext = {
  moduleId: string;
  runtimeContext?: ModuleRuntimeContext;
  mergedInput?: Record<string, unknown>;
  governedRegistry?: GovernedModuleRegistry;
};

export function enrichModuleResultSemantics(
  envelope: ModuleResult,
  legacy: ModuleExecutionResult,
  context: SemanticEnrichmentContext
): ModuleResult {
  if (!isMrcExplanationEnabled() || envelope.status !== 'success') {
    return envelope;
  }

  const recommendations = resolveRecommendations({
    moduleId: context.moduleId,
    payload: legacy.data,
    governedRegistry: context.governedRegistry,
  });

  const explanation = generateModuleExplanation({
    moduleId: context.moduleId,
    payload: legacy.data,
    recommendations,
    runtimeContext: context.runtimeContext,
    mergedInput: context.mergedInput,
  });

  return {
    ...envelope,
    recommendations,
    explanation,
    meta: {
      ...envelope.meta,
      confidence: explanation.confidence,
    },
  };
}
