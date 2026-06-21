import type { OrderingStrategy } from '@arrival-atlas/product-contract';
import {
  buildModuleCatalogRoute,
  ER_COPY_KEYS,
  findModuleCatalogEntry,
  type OpenModuleEntrypoint,
} from '@arrival-atlas/product-contract';
import type { ActionTemplate } from './types.js';

const ECONOMIC_REALITY_MODULE_ID = 'economic-reality';

function requireEconomicRealityCatalogRoute(entrypoint: OpenModuleEntrypoint): string {
  const catalogEntry = findModuleCatalogEntry(ECONOMIC_REALITY_MODULE_ID);
  if (!catalogEntry) {
    throw new Error('CATALOG_ROUTE_MISSING');
  }

  return buildModuleCatalogRoute(catalogEntry, entrypoint);
}

const ENTRYPOINT_BY_STRATEGY: Record<OrderingStrategy, OpenModuleEntrypoint> = {
  CRISIS_FIRST: 'CRISIS',
  INSTITUTION_FIRST: 'OVERVIEW',
  PROGRESSION_FIRST: 'OVERVIEW',
};

export function resolveOpenModuleEntrypoint(
  strategy: OrderingStrategy,
  requested?: OpenModuleEntrypoint
): OpenModuleEntrypoint {
  if (requested && requested !== 'auto') {
    return requested;
  }

  return ENTRYPOINT_BY_STRATEGY[strategy];
}

export function buildEconomicRealityOpenModuleTemplate(
  strategy: OrderingStrategy,
  entrypoint: OpenModuleEntrypoint = 'auto'
): ActionTemplate {
  const resolvedEntrypoint = resolveOpenModuleEntrypoint(strategy, entrypoint);

  return {
    templateId: 'module-economic-reality',
    labelKey: ER_COPY_KEYS.ACTION_OPEN_ECONOMIC_REALITY,
    type: 'open_module',
    payload: {
      moduleId: ECONOMIC_REALITY_MODULE_ID,
      entrypoint: resolvedEntrypoint,
      href: requireEconomicRealityCatalogRoute(resolvedEntrypoint),
    },
  };
}

export function enrichOpenModulePayload(input: {
  moduleId?: string;
  entrypoint?: OpenModuleEntrypoint;
  href?: string;
  strategy: OrderingStrategy;
}): { moduleId?: string; entrypoint?: OpenModuleEntrypoint; href?: string } {
  const { strategy, moduleId, entrypoint, href } = input;

  if (moduleId !== ECONOMIC_REALITY_MODULE_ID) {
    return { moduleId, entrypoint, href };
  }

  const resolvedEntrypoint = resolveOpenModuleEntrypoint(strategy, entrypoint);

  return {
    moduleId,
    entrypoint: resolvedEntrypoint,
    href: requireEconomicRealityCatalogRoute(resolvedEntrypoint),
  };
}
