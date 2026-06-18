import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ModuleRegistry } from '@arrivalos/core';
import { allModuleRegistrations } from '@arrivalos/modules';
import {
  bootstrapGovernedRuntime,
  buildModuleResultEnvelope,
  executeGovernedModule,
  sealModuleResult,
} from '@arrivalos/module-runtime';
import type { ActionItem, ModuleResult, Recommendation } from '@arrivalos/module-runtime';
import { bootstrapProductContractLayer } from './bootstrapProductContractLayer.js';
import { buildExplanationView } from './reason-mapping/buildExplanationView.js';
import { mapExplanationFactors } from './reason-mapping/mapExplanationFactors.js';

const FORBIDDEN_EXPLANATION_KEYS = [
  'payload',
  'meta',
  'trace',
  'ruleIds',
  'governance',
  'normalizer',
  'runtimeContractVersion',
  'scopeRef',
  'target',
  'ENGINE_STEP',
  'INPUT_VALIDATED',
  'authorized',
  'executed',
  'sealed',
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
    if (FORBIDDEN_EXPLANATION_KEYS.includes(key as (typeof FORBIDDEN_EXPLANATION_KEYS)[number])) {
      violations.push(fullPath);
    }
    violations.push(...collectForbiddenKeys(entry, fullPath));
  }

  return violations;
}

function buildSealedExplainFixture(): ModuleResult {
  const recommendations: Recommendation[] = [
    {
      id: 'rec_tax_review',
      title: 'Review tax options',
      description: 'Consider reviewing your tax class.',
      priority: 'high',
      explanation: {
        summary: 'Tax class affects net income.',
        confidence: 'high',
        factors: [
          {
            id: 'factor_tax_class',
            label: 'Tax class',
            value: 1,
            source: 'input',
          },
        ],
      },
    },
  ];

  const actions: ActionItem[] = [
    {
      id: 'act_contact_finanzamt',
      kind: 'contact',
      title: 'Contact Finanzamt',
      description: 'Schedule a tax consultation.',
      priority: 'high',
      recommendationId: 'rec_tax_review',
    },
  ];

  const envelope: ModuleResult = {
    status: 'success',
    meta: {
      moduleId: 'financial-reality',
      moduleVersion: '2.0.0',
      runtimeContractVersion: '1.0',
      executionId: 'exec_explain_fixture',
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
          id: 'factor_employment',
          label: 'Employment status',
          value: 'employed',
          source: 'profile',
        },
        {
          id: 'factor_trace_leak',
          label: 'ENGINE_STEP completed',
          value: true,
          source: 'trace' as never,
        },
      ],
      ruleIds: ['RULE_INTERNAL'],
    },
  };

  return sealModuleResult(envelope, envelope.payload);
}

describe('ModuleExplanationView', () => {
  const coreRegistry = new ModuleRegistry();
  const { governedRegistry } = bootstrapGovernedRuntime(coreRegistry, allModuleRegistrations);
  const contractStore = bootstrapProductContractLayer(governedRegistry);
  const financialSnapshot = contractStore.getContractSnapshot('financial-reality');

  it('maps runtime factors to product ExplanationFactor types', () => {
    const mapped = mapExplanationFactors([
      { id: 'f1', label: 'Gross income', value: 2500, source: 'input' },
      { id: 'f2', label: 'Benefit rule', value: 'eligible', source: 'rule' },
      { id: 'f3', label: 'Profile language', value: 'en', source: 'profile' },
      { id: 'f4', label: 'Trace step', value: 'x', source: 'trace' as never },
    ]);

    expect(mapped).toEqual([
      { id: 'f1', label: 'Gross income: 2500', type: 'input' },
      { id: 'f2', label: 'Benefit rule: eligible', type: 'rule' },
      { id: 'f3', label: 'Profile language: en', type: 'context' },
    ]);
  });

  it('builds explanation view without trace or runtime leakage', () => {
    const view = buildExplanationView(
      buildSealedExplainFixture(),
      'exec_explain_fixture',
      financialSnapshot!
    );

    expect(view.moduleId).toBe('financial-reality');
    expect(view.executionId).toBe('exec_explain_fixture');
    expect(view.triggeredBecause).toEqual([
      {
        id: 'factor_employment',
        label: 'Employment status: employed',
        type: 'context',
      },
    ]);
    expect(view.recommendations).toEqual([
      {
        recommendationId: 'rec_tax_review',
        because: [{ id: 'factor_tax_class', label: 'Tax class: 1', type: 'input' }],
      },
    ]);
    expect(view.actions).toEqual([
      {
        actionId: 'act_contact_finanzamt',
        because: [{ id: 'factor_tax_class', label: 'Tax class: 1', type: 'input' }],
      },
    ]);
    expect(collectForbiddenKeys(view)).toEqual([]);
    expect(JSON.stringify(view)).not.toContain('ENGINE_STEP');
    expect(JSON.stringify(view)).not.toContain('ruleIds');
  });

  it('returns deterministic output for the same sealed input', () => {
    const sealed = buildSealedExplainFixture();
    const first = buildExplanationView(sealed, 'exec_explain_fixture', financialSnapshot!);
    const second = buildExplanationView(sealed, 'exec_explain_fixture', financialSnapshot!);

    expect(first).toEqual(second);
  });

  it('does not call execute or enrichment during explanation projection', () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'reason-mapping/buildExplanationView.ts'),
      'utf8'
    );

    expect(source).not.toContain('executeGovernedModule');
    expect(source).not.toContain('execute(');
    expect(source).not.toContain('enrichModuleResult');
    expect(source).not.toContain('normalizeRecommendations');
    expect(source).not.toContain('buildActionItems');
  });
});

describe('ModuleExplanationView golden fixtures', () => {
  const previousEnvelope = process.env.ARRIVALOS_MRC_ENVELOPE;
  const previousExplanation = process.env.ARRIVALOS_MRC_EXPLANATION;
  const previousActions = process.env.ARRIVALOS_MRC_ACTIONS;

  beforeEach(() => {
    process.env.ARRIVALOS_MRC_ENVELOPE = 'true';
    process.env.ARRIVALOS_MRC_EXPLANATION = 'true';
    process.env.ARRIVALOS_MRC_ACTIONS = 'true';
  });

  afterEach(() => {
    if (previousEnvelope === undefined) {
      delete process.env.ARRIVALOS_MRC_ENVELOPE;
    } else {
      process.env.ARRIVALOS_MRC_ENVELOPE = previousEnvelope;
    }
    if (previousExplanation === undefined) {
      delete process.env.ARRIVALOS_MRC_EXPLANATION;
    } else {
      process.env.ARRIVALOS_MRC_EXPLANATION = previousExplanation;
    }
    if (previousActions === undefined) {
      delete process.env.ARRIVALOS_MRC_ACTIONS;
    } else {
      process.env.ARRIVALOS_MRC_ACTIONS = previousActions;
    }
  });

  it('produces stable explanation output for financial-reality execution', async () => {
    const coreRegistry = new ModuleRegistry();
    const { governedRegistry } = bootstrapGovernedRuntime(coreRegistry, allModuleRegistrations);
    const contractStore = bootstrapProductContractLayer(governedRegistry);
    const contractSnapshot = contractStore.getContractSnapshot('financial-reality');

    const legacy = await executeGovernedModule(
      governedRegistry,
      'financial-reality',
      {
        grossIncome: 2500,
        taxClass: 1,
        churchTax: false,
        householdSize: 1,
        monthlyRent: 1200,
        employmentStatus: 'employed',
        maritalStatus: 'single',
      },
      { userProfile: { language: 'en' } }
    );

    expect(legacy.success).toBe(true);

    const sealed =
      buildModuleResultEnvelope(
        legacy,
        { executionId: 'exec_golden_financial', executedAt: legacy.executedAt },
        { moduleId: 'financial-reality', mergedInput: { grossIncome: 2500 } }
      ) ?? (() => {
        throw new Error('Expected sealed module result');
      })();

    const view = buildExplanationView(sealed, 'exec_golden_financial', contractSnapshot!);
    const repeat = buildExplanationView(sealed, 'exec_golden_financial', contractSnapshot!);

    expect(view.moduleId).toBe('financial-reality');
    expect(view.executionId).toBe('exec_golden_financial');
    expect(view.confidence).toMatch(/high|medium|low/);
    expect(view.triggeredBecause.length).toBeGreaterThan(0);
    expect(view).toEqual(repeat);
    expect(collectForbiddenKeys(view)).toEqual([]);
  });

  it('produces stable explanation output for benefits-simulator execution', async () => {
    const coreRegistry = new ModuleRegistry();
    const { governedRegistry } = bootstrapGovernedRuntime(coreRegistry, allModuleRegistrations);
    const contractStore = bootstrapProductContractLayer(governedRegistry);
    const contractSnapshot = contractStore.getContractSnapshot('benefits-simulator');

    const input = {
      taxYear: 2025,
      household: {
        members: [{ id: 'applicant', role: 'applicant', age: 30, taxClass: 1, churchTax: false }],
        housing: { coldRent: 800, utilities: 0, bundesland: 'BE', cityMietstufe: 3 },
        currentBenefits: { receivingBuergergeld: true },
      },
      baselineEmployments: { applicant: { type: 'none' } },
      scenarios: [
        {
          id: 'minijob-450',
          label: 'Minijob €450',
          events: [{ type: 'minijob', grossMonthly: 450 }],
        },
      ],
    };

    const legacy = await executeGovernedModule(
      governedRegistry,
      'benefits-simulator',
      input,
      { userProfile: { language: 'en' } }
    );

    expect(legacy.success).toBe(true);

    const sealed =
      buildModuleResultEnvelope(
        legacy,
        { executionId: 'exec_golden_benefits', executedAt: legacy.executedAt },
        { moduleId: 'benefits-simulator', mergedInput: input as Record<string, unknown> }
      ) ?? (() => {
        throw new Error('Expected sealed module result');
      })();

    const view = buildExplanationView(sealed, 'exec_golden_benefits', contractSnapshot!);
    const repeat = buildExplanationView(sealed, 'exec_golden_benefits', contractSnapshot!);

    expect(view.moduleId).toBe('benefits-simulator');
    expect(view.executionId).toBe('exec_golden_benefits');
    expect(view.confidence).toMatch(/high|medium|low/);
    expect(view).toEqual(repeat);
    expect(collectForbiddenKeys(view)).toEqual([]);
  });
});
