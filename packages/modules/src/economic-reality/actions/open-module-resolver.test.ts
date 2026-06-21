import { describe, expect, it } from 'vitest';
import { ER_COPY_KEYS } from '@arrival-atlas/product-contract';
import {
  resolveOpenModuleEntrypoint,
} from './open-module-resolver.js';
import { enrichEconomicOpenModuleActions } from './enrich-action-set.js';

const FIXED_META = {
  requestId: 'req_open_module',
  generatedAt: '2026-06-21T12:00:00.000Z',
};

describe('open_module resolver EP-10', () => {
  it('maps ordering strategy to economic-reality entrypoints', () => {
    expect(resolveOpenModuleEntrypoint('CRISIS_FIRST')).toBe('CRISIS');
    expect(resolveOpenModuleEntrypoint('INSTITUTION_FIRST')).toBe('OVERVIEW');
    expect(resolveOpenModuleEntrypoint('PROGRESSION_FIRST')).toBe('OVERVIEW');
  });

  it('enriches economic-reality open_module actions in action set', () => {
    const actionSet = {
      schemaVersion: '1.0.0' as const,
      graphId: 'G5' as const,
      actions: [
        {
          id: 'g5-system-entry:module-economic-reality',
          sourceNodeId: 'g5-system-entry',
          labelKey: ER_COPY_KEYS.ACTION_OPEN_ECONOMIC_REALITY,
          type: 'open_module' as const,
          payload: {
            moduleId: 'economic-reality',
            entrypoint: 'auto' as const,
            href: '/modules/economic-reality',
          },
          constraints: {},
          origin: { graphId: 'G5' as const, nodeId: 'g5-system-entry' },
        },
      ],
      metadata: {
        sourceExecutionId: 'exec',
        derivedFromNodes: ['g5-system-entry'],
      },
    };

    const enriched = enrichEconomicOpenModuleActions(actionSet, 'CRISIS_FIRST');
    expect(enriched.actions[0]?.payload.entrypoint).toBe('CRISIS');
    expect(enriched.actions[0]?.payload.href).toContain('/modules/economic-reality?entry=CRISIS');
  });

  it('leaves non-economic-reality open_module actions unchanged', () => {
    const actionSet = {
      schemaVersion: '1.0.0' as const,
      graphId: 'G2' as const,
      actions: [
        {
          id: 'a1',
          sourceNodeId: 'g2-first-payment',
          labelKey: ER_COPY_KEYS.ACTION_OPEN_FINANCIAL,
          type: 'open_module' as const,
          payload: {
            moduleId: 'financial-reality',
            href: '/modules/financial-reality',
          },
          constraints: {},
          origin: { graphId: 'G2' as const, nodeId: 'g2-first-payment' },
        },
      ],
      metadata: {
        sourceExecutionId: 'exec',
        derivedFromNodes: ['g2-first-payment'],
      },
    };

    const enriched = enrichEconomicOpenModuleActions(actionSet, 'CRISIS_FIRST');
    expect(enriched.actions[0]?.payload.entrypoint).toBeUndefined();
    expect(enriched.actions[0]?.payload.href).toBe('/modules/financial-reality');
  });
});
