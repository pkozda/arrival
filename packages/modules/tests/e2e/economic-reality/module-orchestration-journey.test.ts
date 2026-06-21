import { describe, expect, it } from 'vitest';
import { buildLifeEventPlan } from '../../../src/life-event/plan/build-life-event-plan.js';
import {
  listCatalogBackedModuleRoutes,
  resolveCrossModuleLink,
  suggestModulesForLifeContext,
} from '../../../src/module-orchestration/catalog-routing.js';
import { E2E_FIXED_META, lifeEventFixture, lifeEventNodeIds } from './helpers.js';

describe('E2E module orchestration — Life Event → catalog → Economic Reality (modules)', () => {
  it('resolves a single catalog-backed economic-reality target per life state', () => {
    const fixture = lifeEventFixture('F04');
    const lifePlan = buildLifeEventPlan({
      userContext: fixture.userContext,
      generatedAt: E2E_FIXED_META.generatedAt,
    });

    const suggestions = suggestModulesForLifeContext({
      lifeStateId: lifePlan.currentLifeState,
      nodeIds: lifeEventNodeIds(lifePlan),
    });

    const economicTargets = suggestions.filter((entry) => entry.moduleId === 'economic-reality');
    expect(economicTargets.length).toBeGreaterThan(0);
    expect(new Set(suggestions.map((entry) => entry.moduleId)).size).toBe(suggestions.length);

    for (const target of economicTargets) {
      expect(target.route.startsWith('/modules/economic-reality')).toBe(true);
      expect(target.source.type).not.toBe('static_map');
    }
  });

  it('uses catalog entrypoints for institutional node handoff', () => {
    const target = resolveCrossModuleLink({
      type: 'life_event_node',
      nodeId: 'g3-benefits-pathway',
    });

    expect(target?.moduleId).toBe('economic-reality');
    expect(target?.entrypoint).toBe('OVERVIEW');
    expect(target?.route).toBe('/modules/economic-reality?entry=OVERVIEW');
  });

  it('lists only catalog-backed module routes', () => {
    const routes = listCatalogBackedModuleRoutes();
    expect(routes.every((entry) => entry.entry.route.startsWith('/modules/'))).toBe(true);
    expect(routes.some((entry) => entry.id === 'economic-reality')).toBe(true);
  });
});
