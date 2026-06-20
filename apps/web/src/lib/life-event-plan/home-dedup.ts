import type { MissingContextHint } from '@/lib/product-contract';
import type { ModuleSuggestion } from '@/lib/situation-utils';
import type { ActionSurfaceV1 } from './actions';
import type { P4PlanOverlayV1 } from './p4-merge';
import {
  collectActionSurfaceSemanticKeys,
  overlapsSemanticIdentity,
  semanticKeysFromHint,
  semanticKeysFromModuleSuggestion,
  type SemanticIdentityKey,
} from './semantic-identity';

export type HomeDedupResultV1 = {
  planSemanticKeys: SemanticIdentityKey[];
  visibleHints: MissingContextHint[];
  visibleModuleSuggestions: ModuleSuggestion[];
  suppressedHintCount: number;
  suppressedModuleCount: number;
};

const PLAN_ACTIVE_MODULE_KEYS: SemanticIdentityKey[] = ['module:life-event'];

function isPlanActive(surface: ActionSurfaceV1): boolean {
  return Boolean(surface.primaryAction?.id);
}

export function dedupeHomeSurfaces(input: {
  actionSurface: ActionSurfaceV1;
  p4Overlay: P4PlanOverlayV1;
  moduleSuggestions: ModuleSuggestion[];
}): HomeDedupResultV1 {
  const { actionSurface, p4Overlay, moduleSuggestions } = input;
  const planActive = isPlanActive(actionSurface);
  const planKeys = collectActionSurfaceSemanticKeys(actionSurface);

  if (planActive) {
    for (const key of PLAN_ACTIVE_MODULE_KEYS) {
      planKeys.add(key);
    }
  }

  const visibleHints: MissingContextHint[] = [];
  let suppressedHintCount = 0;

  for (const hint of p4Overlay.contextualHints) {
    if (planActive && overlapsSemanticIdentity(planKeys, semanticKeysFromHint(hint))) {
      suppressedHintCount += 1;
      continue;
    }
    visibleHints.push(hint);
  }

  const visibleModuleSuggestions: ModuleSuggestion[] = [];
  let suppressedModuleCount = 0;

  for (const suggestion of moduleSuggestions) {
    if (planActive && overlapsSemanticIdentity(planKeys, semanticKeysFromModuleSuggestion(suggestion))) {
      suppressedModuleCount += 1;
      continue;
    }
    visibleModuleSuggestions.push(suggestion);
  }

  return {
    planSemanticKeys: [...planKeys],
    visibleHints,
    visibleModuleSuggestions,
    suppressedHintCount,
    suppressedModuleCount,
  };
}
