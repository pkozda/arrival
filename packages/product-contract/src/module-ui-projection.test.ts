import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ModuleRegistry } from '@arrival-atlas/core';
import { allModuleRegistrations } from '@arrival-atlas/modules';
import { bootstrapGovernedRuntime, sealModuleResult } from '@arrival-atlas/module-runtime';
import type { ActionItem, ModuleResult, Recommendation } from '@arrival-atlas/module-runtime';
import { bootstrapProductContractLayer } from './bootstrapProductContractLayer.js';
import { projectModuleUI } from './projectModuleUI.js';

const FORBIDDEN_PROJECTION_KEYS = [
  'payload',
  'meta',
  'runtimeContractVersion',
  'executionConstraints',
  'featureFlags',
  'ruleIds',
  'scopeRef',
  'recommendationId',
  'target',
  'frozen',
  'spec',
  'governance',
  'trace',
  'normalizer',
] as const;

function collectForbiddenKeys(value: unknown, path = ''): string[] {
  if (value === null || typeof value !== 'object') {
    return [];
  }

  const violations: string[] = [];

  if (Array.isArray(value)) {
    for (const [index, entry] of value.entries()) {
      violations.push(...collectForbiddenKeys(entry, `${path}[${index}]`));
    }
    return violations;
  }

  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const fullPath = path ? `${path}.${key}` : key;
    if (FORBIDDEN_PROJECTION_KEYS.includes(key as (typeof FORBIDDEN_PROJECTION_KEYS)[number])) {
      violations.push(fullPath);
    }
    violations.push(...collectForbiddenKeys(entry, fullPath));
  }

  return violations;
}

function buildSealedSuccessResult(): ModuleResult {
  const recommendations: Recommendation[] = [
    {
      id: 'rec_internal',
      title: 'Review tax options',
      description: 'Consider reviewing your tax class.',
      priority: 'high',
      scopeRef: 'internal-scope',
      explanation: {
        summary: 'Tax class affects net income.',
        confidence: 'high',
        factors: [
          {
            id: 'factor_internal',
            label: 'Tax class',
            value: 1,
            source: 'profile',
          },
        ],
        ruleIds: ['RULE_INTERNAL'],
      },
    },
  ];

  const actions: ActionItem[] = [
    {
      id: 'act_internal',
      kind: 'contact',
      title: 'Contact Finanzamt',
      description: 'Schedule a tax consultation.',
      priority: 'high',
      target: 'internal-target',
      recommendationId: 'rec_internal',
    },
  ];

  let envelope: ModuleResult = {
    status: 'success',
    meta: {
      moduleId: 'financial-reality',
      moduleVersion: '2.0.0',
      runtimeContractVersion: '1.0',
      executionId: 'exec_ui_projection',
      executedAt: '2026-06-16T12:00:00.000Z',
      confidence: 'high',
    },
    payload: { income: { gross: 2500, net: 1800 } },
    recommendations,
    actions,
    explanation: {
      summary: 'Your tax profile suggests review.',
      confidence: 'high',
      factors: [
        {
          id: 'factor_trace',
          label: 'Employment status',
          value: 'employed',
          source: 'profile',
        },
      ],
      ruleIds: ['RULE_TRACE'],
    },
  };

  return sealModuleResult(envelope, envelope.payload);
}

describe('ModuleUIProjection', () => {
  const coreRegistry = new ModuleRegistry();
  const { governedRegistry } = bootstrapGovernedRuntime(coreRegistry, allModuleRegistrations);
  const contractStore = bootstrapProductContractLayer(governedRegistry);
  const contractSnapshot = contractStore.getContractSnapshot('financial-reality');

  it('projects sealed module results without internal runtime fields', () => {
    expect(contractSnapshot).toBeDefined();

    const projection = projectModuleUI(buildSealedSuccessResult(), contractSnapshot!);

    expect(projection.moduleId).toBe('financial-reality');
    expect(projection.status).toBe('success');
    expect(projection.title).toBeTruthy();
    expect(collectForbiddenKeys(projection)).toEqual([]);
  });

  it('preserves sanitized MRC-3 recommendations and MRC-4 actions', () => {
    const projection = projectModuleUI(buildSealedSuccessResult(), contractSnapshot!);

    expect(projection.recommendations).toEqual([
      {
        title: 'Review tax options',
        description: 'Consider reviewing your tax class.',
        priority: 'high',
        reason: 'Tax class affects net income.',
      },
    ]);

    expect(projection.actions).toEqual([
      {
        label: 'Contact Finanzamt',
        description: 'Schedule a tax consultation.',
        priority: 'high',
        kind: 'contact',
      },
    ]);
  });

  it('maps explanation factors to UI-safe reason text without trace leakage', () => {
    const projection = projectModuleUI(buildSealedSuccessResult(), contractSnapshot!);

    expect(projection.explanation).toEqual({
      summary: 'Your tax profile suggests review.',
      confidence: 'high',
      reasons: ['Employment status: employed'],
    });
    expect(JSON.stringify(projection.explanation)).not.toContain('ruleIds');
    expect(JSON.stringify(projection.explanation)).not.toContain('factor_trace');
  });

  it('returns deterministic output for the same sealed input', () => {
    const sealed = buildSealedSuccessResult();
    const first = projectModuleUI(sealed, contractSnapshot!);
    const second = projectModuleUI(sealed, contractSnapshot!);

    expect(first).toEqual(second);
  });

  it('does not call execute or enrichment systems during projection', () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'projectModuleUI.ts'),
      'utf8'
    );

    expect(source).not.toContain('executeGovernedModule');
    expect(source).not.toContain('execute(');
    expect(source).not.toContain('enrichModuleResult');
    expect(source).not.toContain('normalizeRecommendations');
    expect(source).not.toContain('buildActionItems');
    expect(source).not.toContain('payload');
  });

  it('maps execution errors to UI-safe error projection', () => {
    const errorResult: ModuleResult = {
      status: 'execution_error',
      meta: {
        moduleId: 'financial-reality',
        moduleVersion: '2.0.0',
        runtimeContractVersion: '1.0',
        executionId: 'exec_error',
        executedAt: '2026-06-16T12:00:00.000Z',
        confidence: 'medium',
      },
      error: 'Invalid input combination',
    };

    const projection = projectModuleUI(errorResult, contractSnapshot!);

    expect(projection.status).toBe('error');
    expect(projection.error).toEqual({
      message: 'Invalid input combination',
      code: 'execution_error',
    });
    expect(projection.recommendations).toEqual([]);
    expect(projection.actions).toEqual([]);
  });
});
