import { describe, expect, it } from 'vitest';
import {
  resolveCrossModuleLink,
  suggestModulesForLifeContext,
} from './catalog-routing.js';

describe('catalog-routing EP-10 / EP-11.1', () => {
  it('resolves LE economic path node to economic-reality', () => {
    const target = resolveCrossModuleLink({
      type: 'life_event_node',
      nodeId: 'g2-economic-path',
    });

    expect(target).toMatchObject({
      moduleId: 'economic-reality',
      route: '/modules/economic-reality?entry=OVERVIEW',
    });
  });

  it('resolves job loss life event type to crisis entry', () => {
    const target = resolveCrossModuleLink({
      type: 'life_event_type',
      eventType: 'job_loss',
    });

    expect(target).toMatchObject({
      moduleId: 'economic-reality',
      route: '/modules/economic-reality?entry=CRISIS',
    });
  });

  it('resolves system intents to economic-reality open_module target', () => {
    const target = resolveCrossModuleLink({
      type: 'system_intent',
      intent: 'initiate_benefit_application',
    });

    expect(target?.moduleId).toBe('economic-reality');
  });

  it('suggests economic-reality from life state without engine imports', () => {
    const suggestions = suggestModulesForLifeContext({
      lifeStateId: 'economic_setup_pending',
      lifeEventType: 'arrival',
      nodeIds: ['g3-benefits-pathway'],
    });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.moduleId).toBe('economic-reality');
  });

  it('does not import economic engine functions', async () => {
    const { readFileSync } = await import('node:fs');
    const { join, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'catalog-routing.ts'),
      'utf8'
    );

    expect(source).not.toContain('evaluate(');
    expect(source).not.toContain('buildPlan');
    expect(source).not.toContain('resolveGraphContext');
    expect(source).not.toContain('LIFE_EVENT_NODE_TARGETS');
  });
});
