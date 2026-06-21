import {
  buildModuleCatalogRoute,
  findModuleCatalogEntry,
  matchesModuleTriggers,
  type ModuleCatalogEntryV1,
  type ModuleTriggerContextV1,
  type OpenModuleEntrypoint,
} from '@/lib/product-contract';

export type ModuleRouteContextV1 = ModuleTriggerContextV1 & {
  entrypoint?: OpenModuleEntrypoint;
};

export type ResolvedModuleRouteV1 = {
  moduleId: string;
  route: string;
  surface: ModuleCatalogEntryV1['entry']['surface'];
  catalogVersion: string;
};

export function resolveModule(
  moduleId: string,
  context: ModuleRouteContextV1 = {}
): ResolvedModuleRouteV1 | null {
  const entry = findModuleCatalogEntry(moduleId);
  if (!entry) {
    return null;
  }

  return {
    moduleId: entry.id,
    route: buildModuleCatalogRoute(entry, context.entrypoint),
    surface: entry.entry.surface,
    catalogVersion: entry.version,
  };
}

export function resolveModuleFromOpenAction(input: {
  moduleId?: string;
  entrypoint?: OpenModuleEntrypoint;
  href?: string;
}): ResolvedModuleRouteV1 | null {
  if (!input.moduleId) {
    return null;
  }

  const resolved = resolveModule(input.moduleId, { entrypoint: input.entrypoint });
  if (!resolved) {
    return null;
  }

  if (
    process.env.NODE_ENV === 'development' &&
    input.href &&
    input.href !== resolved.route
  ) {
    console.warn('ROUTER_HREF_IGNORED', { input, catalogRoute: resolved.route });
  }

  return resolved;
}

export function isModuleVisibleInContext(
  moduleId: string,
  context: ModuleTriggerContextV1
): boolean {
  const entry = findModuleCatalogEntry(moduleId);
  if (!entry) {
    return false;
  }

  return matchesModuleTriggers(entry, context);
}
