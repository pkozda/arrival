import { describe, expect, it } from 'vitest';
import {
  MODULE_CATALOG_V1,
  ECONOMIC_REALITY_MODULE_CATALOG_ENTRY,
  ECONOMIC_STATE_TRIGGER_CODE,
  findModuleCatalogEntry,
  matchesModuleTriggers,
  resolveTriggeredModules,
  buildModuleCatalogRoute,
} from './module-catalog.js';

describe('ModuleCatalogV1', () => {
  it('registers economic-reality as a first-class catalog entry', () => {
    expect(MODULE_CATALOG_V1.version).toBe('1.0.0');
    expect(findModuleCatalogEntry('economic-reality')).toEqual(ECONOMIC_REALITY_MODULE_CATALOG_ENTRY);
  });

  it('matches economic state trigger codes E3–E7', () => {
    for (const stateCode of ['E3', 'E4', 'E5', 'E6', 'E7'] as const) {
      expect(
        matchesModuleTriggers(ECONOMIC_REALITY_MODULE_CATALOG_ENTRY, { economicStateCode: stateCode })
      ).toBe(true);
    }

    expect(
      matchesModuleTriggers(ECONOMIC_REALITY_MODULE_CATALOG_ENTRY, { economicStateCode: 'E1' })
    ).toBe(false);
  });

  it('maps economic state ids to trigger codes deterministically', () => {
    expect(ECONOMIC_STATE_TRIGGER_CODE.unemployment_transition).toBe('E3');
    expect(ECONOMIC_STATE_TRIGGER_CODE.financial_crisis).toBe('E7');
  });

  it('builds stable module routes with entrypoints', () => {
    expect(buildModuleCatalogRoute(ECONOMIC_REALITY_MODULE_CATALOG_ENTRY)).toBe(
      '/modules/economic-reality'
    );
    expect(buildModuleCatalogRoute(ECONOMIC_REALITY_MODULE_CATALOG_ENTRY, 'CRISIS')).toBe(
      '/modules/economic-reality?entry=CRISIS'
    );
  });

  it('resolves triggered modules from life and system context', () => {
    const modules = resolveTriggeredModules({
      lifeStateId: 'economic_setup_pending',
      systemIntents: ['start_jobcenter_process'],
    });

    expect(modules.map((entry) => entry.id)).toEqual(['economic-reality']);
  });
});
