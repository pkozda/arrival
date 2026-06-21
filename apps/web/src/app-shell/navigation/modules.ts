import {
  ER_COPY_KEYS,
  ECONOMIC_REALITY_MODULE_CATALOG_ENTRY,
  findModuleCatalogEntry,
} from '@arrival-atlas/product-contract';

export type AppShellModuleNavBadgeSource = 'primaryHighlight' | 'none';

export type AppShellModuleNavVisibility = 'always' | 'conditional';

export type AppShellModuleNavEntry = {
  id: string;
  labelKey: string;
  route: string;
  badgeSource: AppShellModuleNavBadgeSource;
  visibility: AppShellModuleNavVisibility;
};

export const ECONOMIC_REALITY_MODULE_NAV: AppShellModuleNavEntry = {
  id: ECONOMIC_REALITY_MODULE_CATALOG_ENTRY.id,
  labelKey: ER_COPY_KEYS.MODULE_TITLE,
  route: ECONOMIC_REALITY_MODULE_CATALOG_ENTRY.entry.route,
  badgeSource: 'primaryHighlight',
  visibility: 'conditional',
};

export const APP_SHELL_MODULE_NAV: AppShellModuleNavEntry[] = [ECONOMIC_REALITY_MODULE_NAV];

export function resolveAppShellModuleNav(moduleId: string): AppShellModuleNavEntry | undefined {
  const catalogEntry = findModuleCatalogEntry(moduleId);
  if (!catalogEntry) {
    return undefined;
  }

  if (moduleId === ECONOMIC_REALITY_MODULE_CATALOG_ENTRY.id) {
    return ECONOMIC_REALITY_MODULE_NAV;
  }

  return {
    id: catalogEntry.id,
    labelKey: ER_COPY_KEYS.MODULE_TITLE,
    route: catalogEntry.entry.route,
    badgeSource: 'none',
    visibility: 'conditional',
  };
}
