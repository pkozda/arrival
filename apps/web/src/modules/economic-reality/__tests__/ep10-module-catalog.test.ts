import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildEconomicRealityPlan } from '@arrival-atlas/modules/economic-reality';
import { ECONOMIC_FIXTURES } from '@arrival-atlas/modules/economic-reality';
import { resolveCrossModuleLink } from '@arrival-atlas/modules';
import {
  MODULE_CATALOG_V1,
  findModuleCatalogEntry,
} from '@arrival-atlas/product-contract';
import { resolveModule, resolveModuleFromOpenAction } from '@/app-shell/modules/router';
import { APP_NAVIGATION_GRAPH_EDGES, economicRealityGraphNode } from '@/app-shell/navigation/graph';
import { shouldShowEconomicRealitySurface } from '@/app-shell/navigation/visibility';
import { suggestEconomicModulesFromLifePlan } from '@/lib/module-orchestration/life-event-bridge';

const FIXED_META = {
  requestId: 'req_ep10_test',
  generatedAt: '2026-06-21T12:00:00.000Z',
};

describe('EP-10 module catalog + cross-module graph linking', () => {
  it('includes economic-reality in module catalog', () => {
    expect(findModuleCatalogEntry('economic-reality')).toBeDefined();
    expect(MODULE_CATALOG_V1.modules.some((entry) => entry.id === 'economic-reality')).toBe(true);
  });

  it('resolves deterministic module routes from catalog', () => {
    const resolved = resolveModule('economic-reality', { entrypoint: 'CRISIS' });
    expect(resolved).toEqual({
      moduleId: 'economic-reality',
      route: '/modules/economic-reality?entry=CRISIS',
      surface: 'full_page',
      catalogVersion: '1.0.0',
    });
  });

  it('includes economic-reality in global navigation graph', () => {
    expect(economicRealityGraphNode().route).toBe('/modules/economic-reality');
    expect(APP_NAVIGATION_GRAPH_EDGES.some((edge) => edge.to === 'economic-reality')).toBe(true);
  });

  it('uses catalog triggers for module visibility', () => {
    const hidden = buildEconomicRealityPlan(ECONOMIC_FIXTURES[0]!.userContext, FIXED_META);
    const visible = buildEconomicRealityPlan(ECONOMIC_FIXTURES[2]!.userContext, FIXED_META);

    expect(
      shouldShowEconomicRealitySurface({
        evaluation: hidden.evaluation,
        actionSet: hidden.actionSet,
      })
    ).toBe(false);

    expect(
      shouldShowEconomicRealitySurface({
        evaluation: visible.evaluation,
        actionSet: visible.actionSet,
      })
    ).toBe(true);
  });

  it('resolves LE → ER transition through cross-module links', () => {
    const target = resolveCrossModuleLink({
      type: 'life_event_node',
      nodeId: 'g2-economic-path',
    });

    expect(target?.moduleId).toBe('economic-reality');
    expect(target?.route).toContain('/modules/economic-reality');
  });

  it('suggests economic-reality from life event plan via catalog bridge only', () => {
    const suggestions = suggestEconomicModulesFromLifePlan({
      currentLifeState: 'economic_setup_pending',
      nextBestActions: [{ id: 'g3-benefits-pathway' }],
    } as never);

    expect(suggestions.some((entry) => entry.moduleId === 'economic-reality')).toBe(true);
  });

  it('open_module actions include catalog-backed economic-reality routes after plan build', () => {
    const plan = buildEconomicRealityPlan(ECONOMIC_FIXTURES[2]!.userContext, FIXED_META);
    const openActions = plan.plan.primaryTrack.actions
      .concat(plan.plan.secondaryTrack?.actions ?? [])
      .concat(plan.plan.systemTrack.actions)
      .filter(
        (action) => action.type === 'open_module' && action.payload.moduleId === 'economic-reality'
      );

    if (openActions.length > 0) {
      expect(openActions[0]?.payload.href).toContain('/modules/economic-reality');
      expect(openActions[0]?.payload.entrypoint).toBeDefined();
    } else {
      const enriched = plan.actionSet.actions.find(
        (action) => action.type === 'open_module' && action.payload.moduleId === 'economic-reality'
      );
      expect(enriched?.payload.href).toContain('/modules/economic-reality');
    }
  });

  it('resolveModuleFromOpenAction ignores action href and uses catalog route', () => {
    const resolved = resolveModuleFromOpenAction({
      moduleId: 'economic-reality',
      entrypoint: 'CRISIS',
      href: '/modules/economic-reality?entry=OVERRIDE',
    });

    expect(resolved?.route).toBe('/modules/economic-reality?entry=CRISIS');
  });

  it('catalog and router layers do not import economic engine functions', () => {
    const forbidden = ['evaluate(', 'buildPlan', 'resolveGraphContext', 'buildPresentation'];
    const files = [
      join(__dirname, '../../../app-shell/modules/router.ts'),
      join(__dirname, '../../../app-shell/navigation/graph.ts'),
      join(__dirname, '../../../app-shell/navigation/visibility.ts'),
      join(__dirname, '../../../lib/module-orchestration/life-event-bridge.ts'),
    ];

    const violations: string[] = [];
    for (const filePath of files) {
      const source = readFileSync(filePath, 'utf8');
      for (const pattern of forbidden) {
        if (source.includes(pattern)) {
          violations.push(`${filePath}: ${pattern}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
