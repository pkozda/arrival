import type { ModuleResult } from '@arrival-atlas/module-runtime';
import type { ContractSnapshot } from '../ContractSnapshot.js';
import type { ModuleExplanationView } from '../ModuleExplanationView.js';
import { aggregateExplanationConfidence } from './aggregateExplanationConfidence.js';
import { mapActionReasons } from './mapActionReasons.js';
import { mapExplanationFactors } from './mapExplanationFactors.js';
import { mapRecommendationReasons } from './mapRecommendationReasons.js';

export function buildExplanationView(
  sealedModuleResult: ModuleResult,
  executionId: string,
  contractSnapshot?: ContractSnapshot
): ModuleExplanationView {
  const triggeredBecause = mapExplanationFactors(sealedModuleResult.explanation?.factors);
  const recommendations = mapRecommendationReasons(sealedModuleResult.recommendations);
  const actions = mapActionReasons(sealedModuleResult.actions, sealedModuleResult.recommendations);

  const recommendationsWithBecause = recommendations.filter(
    (entry) => entry.because.length > 0
  ).length;
  const actionsWithBecause = actions.filter((entry) => entry.because.length > 0).length;

  return {
    moduleId: contractSnapshot?.moduleId ?? sealedModuleResult.meta.moduleId,
    executionId,
    confidence: aggregateExplanationConfidence(
      sealedModuleResult,
      triggeredBecause.length,
      recommendationsWithBecause,
      recommendations.length,
      actionsWithBecause,
      actions.length
    ),
    triggeredBecause,
    recommendations,
    actions,
  };
}
