import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveModuleFromOpenAction } from '@/app-shell/modules/router';
import { suggestEconomicModulesFromLifePlan } from '@/lib/module-orchestration/life-event-bridge';
import { buildLifeEventPlan, CLASSIFIER_FIXTURES } from '@arrival-atlas/modules/life-event';
import { E2E_UI_FIXED_META } from './helpers.js';

describe('E2E module orchestration — Life Event → catalog → Economic Reality (web boundary)', () => {
  it('suggests economic-reality from life plan via catalog bridge only', () => {
    const fixture = CLASSIFIER_FIXTURES.find((entry) => entry.id === 'F04');
    if (!fixture) {
      throw new Error('Missing F04');
    }

    const lifePlan = buildLifeEventPlan({
      userContext: fixture.userContext,
      generatedAt: E2E_UI_FIXED_META.generatedAt,
    });

    const suggestions = suggestEconomicModulesFromLifePlan(lifePlan);
    expect(suggestions.some((entry) => entry.moduleId === 'economic-reality')).toBe(true);

    const uniqueModuleIds = new Set(suggestions.map((entry) => entry.moduleId));
    expect(uniqueModuleIds.size).toBe(suggestions.length);
  });

  it('router resolves catalog route even when action href disagrees', () => {
    const resolved = resolveModuleFromOpenAction({
      moduleId: 'economic-reality',
      entrypoint: 'CRISIS',
      href: '/modules/economic-reality?entry=OVERRIDE',
    });

    expect(resolved?.route).toBe('/modules/economic-reality?entry=CRISIS');
  });

  it('life-event bridge does not import static cross-module maps', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/lib/module-orchestration/life-event-bridge.ts'),
      'utf8'
    );
    expect(source).not.toContain('cross-module-links');
    expect(source).toContain('@arrival-atlas/modules/module-orchestration');
  });
});
