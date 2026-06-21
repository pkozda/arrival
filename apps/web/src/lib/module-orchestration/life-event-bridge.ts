import type { LifeEventPlanV1, PublicModuleContract } from '@/lib/product-contract';
import { suggestModulesForLifeContext } from '@arrival-atlas/modules/module-orchestration';
import type { ModuleSuggestion } from '@/lib/situation-utils';

const CATALOG_SUGGESTION_REASONS: Record<string, string> = {
  'economic-reality': 'Review your economic situation and next steps',
  'financial-reality': 'Understand take-home pay and compare job options',
  'benefits-simulator': 'Estimate income-based support if your situation changes',
  'life-event': 'Plan next steps when something in your life changes',
};

export function suggestEconomicModulesFromLifePlan(plan: LifeEventPlanV1) {
  return suggestModulesForLifeContext({
    lifeStateId: plan.currentLifeState,
    nodeIds: plan.nextBestActions.map((action) => action.id),
  });
}

export function buildCatalogModuleSuggestions(
  plan: LifeEventPlanV1 | null,
  modules: PublicModuleContract[]
): ModuleSuggestion[] {
  if (!plan) {
    return [];
  }

  const targets = suggestEconomicModulesFromLifePlan(plan);
  const suggestions: ModuleSuggestion[] = [];
  const seen = new Set<string>();

  for (const target of targets) {
    if (seen.has(target.moduleId)) {
      continue;
    }

    const module = modules.find((entry) => entry.id === target.moduleId);
    if (!module) {
      continue;
    }

    seen.add(target.moduleId);
    suggestions.push({
      module,
      reason:
        CATALOG_SUGGESTION_REASONS[module.id] ??
        module.description ??
        'Recommended based on your current life situation',
      href: target.route,
    });
  }

  return suggestions;
}
