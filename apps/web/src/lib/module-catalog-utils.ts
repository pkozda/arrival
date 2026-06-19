import type { NormalizedCapabilities, PublicModuleContract } from '@/lib/product-contract';

export const DEFAULT_MODULE_CATEGORY = 'General';

export type ModuleCapabilityVisibility = {
  showRecommendations: boolean;
  showActions: boolean;
  showExplanation: boolean;
  showRiskModel: boolean;
};

export function resolveModuleCategory(module: PublicModuleContract): string {
  const category = module.metadata.category?.trim();
  return category && category.length > 0 ? category : DEFAULT_MODULE_CATEGORY;
}

export function formatCategoryLabel(category: string): string {
  return category
    .split(/[-_\s]+/)
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

export function groupModulesByCategory(
  modules: PublicModuleContract[]
): Array<{ category: string; modules: PublicModuleContract[] }> {
  const groups = new Map<string, PublicModuleContract[]>();

  for (const module of modules) {
    if (module.status !== 'available') {
      continue;
    }

    const category = resolveModuleCategory(module);
    const existing = groups.get(category) ?? [];
    existing.push(module);
    groups.set(category, existing);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([category, categoryModules]) => ({
      category,
      modules: [...categoryModules].sort((left, right) => left.title.localeCompare(right.title)),
    }));
}

export function capabilityVisibilityFromContract(
  contract: PublicModuleContract
): ModuleCapabilityVisibility {
  const supports = contract.capabilities.supports;

  return {
    showRecommendations: supports.recommendations,
    showActions: supports.actions,
    showExplanation: supports.explanation,
    showRiskModel: supports.riskModel,
  };
}

export function capabilityVisibilityFromSupports(
  supports: NormalizedCapabilities['supports'] | undefined
): ModuleCapabilityVisibility {
  return {
    showRecommendations: supports?.recommendations ?? false,
    showActions: supports?.actions ?? false,
    showExplanation: supports?.explanation ?? false,
    showRiskModel: supports?.riskModel ?? false,
  };
}

export function buildModuleContractLookup(
  modules: PublicModuleContract[]
): Map<string, PublicModuleContract> {
  return new Map(modules.map((module) => [module.id, module]));
}
