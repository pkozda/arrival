import { describe, expect, it } from 'vitest';
import { buildLifeEventPlan, CLASSIFIER_FIXTURES } from '@arrival-atlas/modules/life-event';
import type { MissingContextHint, ProfileInsightViewV1 } from '@/lib/product-contract';
import type { PublicModuleContract } from '@/lib/product-contract';
import {
  buildExecutionSurface,
  buildHomePlanViewModelV2,
  dedupeHomeSurfaces,
  mergeP4WithPlan,
  projectActionSurface,
} from '@/lib/life-event-plan';
import {
  collectActionSurfaceSemanticKeys,
  overlapsSemanticIdentity,
  semanticKeysFromHint,
} from '@/lib/life-event-plan/semantic-identity';
import type { ModuleSuggestion } from '@/lib/situation-utils';

const GENERATED_AT = '2026-06-20T12:00:00.000Z';

function buildFixturePlan(fixtureId: string) {
  const fixture = CLASSIFIER_FIXTURES.find((entry) => entry.id === fixtureId);
  if (!fixture) {
    throw new Error(`Missing fixture ${fixtureId}`);
  }

  return buildLifeEventPlan({
    userContext: fixture.userContext,
    generatedAt: GENERATED_AT,
  });
}

function mockInsights(hints: MissingContextHint[]): ProfileInsightViewV1 {
  return {
    schemaVersion: '1.0.0',
    generatedAt: GENERATED_AT,
    globalConfidence: 'medium',
    missingContext: hints,
    domainInsights: [],
  };
}

function mockModule(id: string): PublicModuleContract {
  return {
    id,
    title: id,
    description: `${id} description`,
    version: '1.0.0',
    category: 'finance',
    capabilities: { supports: { actions: false, explanation: false, recommendations: false, riskModel: false } },
    inputSchema: {},
    outputSchema: {},
  };
}

function mockSuggestion(moduleId: string): ModuleSuggestion {
  return {
    module: mockModule(moduleId),
    reason: `Try ${moduleId}`,
  };
}

describe('mergeP4WithPlan (LE-6)', () => {
  it('passes through contextual hints without mutating the plan', () => {
    const plan = buildFixturePlan('F05');
    const hints: MissingContextHint[] = [
      {
        domain: 'healthInsurance',
        mirrorSlug: 'health-insurance',
        message: 'Health insurance information is missing',
        suggestedAction: 'open_module',
        ctaModuleId: 'healthcare-navigation',
        href: '/modules/healthcare-navigation',
      },
    ];
    const insights = mockInsights(hints);
    const overlay = mergeP4WithPlan(plan, insights);

    expect(overlay.contextualHints).toEqual(hints);
    expect(overlay.metadata.planConfidence).toBe(plan.reasoning.planConfidence);
    expect(plan.nextBestActions).toEqual(
      buildFixturePlan('F05').nextBestActions
    );
  });
});

describe('dedupeHomeSurfaces (LE-6)', () => {
  it('suppresses P4 hints and module suggestions covered by plan semantic identity', () => {
    const plan = buildFixturePlan('F05');
    const surface = projectActionSurface(plan);
    const planKeys = collectActionSurfaceSemanticKeys(surface);

    const insuranceHint: MissingContextHint = {
      domain: 'healthInsurance',
      mirrorSlug: 'health-insurance',
      message: 'Health insurance information is missing',
      suggestedAction: 'open_module',
      ctaModuleId: 'healthcare-navigation',
      href: '/modules/healthcare-navigation',
    };

    expect(overlapsSemanticIdentity(planKeys, semanticKeysFromHint(insuranceHint))).toBe(true);

    const dedup = dedupeHomeSurfaces({
      actionSurface: surface,
      p4Overlay: mergeP4WithPlan(plan, mockInsights([insuranceHint])),
      moduleSuggestions: [
        mockSuggestion('healthcare-navigation'),
        mockSuggestion('system-translation'),
      ],
    });

    expect(dedup.suppressedHintCount).toBe(1);
    expect(dedup.visibleHints).toHaveLength(0);
    expect(dedup.suppressedModuleCount).toBe(1);
    expect(dedup.visibleModuleSuggestions.map((entry) => entry.module.id)).toEqual([
      'system-translation',
    ]);
  });

  it('passes through all hints and suggestions when plan has no primary focus', () => {
    const hints: MissingContextHint[] = [
      {
        domain: 'employment',
        mirrorSlug: 'work-income',
        message: 'Employment details are missing',
        suggestedAction: 'correct_in_profile',
        href: '/profile/work-income/edit',
      },
    ];

    const dedup = dedupeHomeSurfaces({
      actionSurface: projectActionSurface({} as never),
      p4Overlay: mergeP4WithPlan(null, mockInsights(hints)),
      moduleSuggestions: [mockSuggestion('financial-reality')],
    });

    expect(dedup.visibleHints).toEqual(hints);
    expect(dedup.visibleModuleSuggestions).toHaveLength(1);
    expect(dedup.suppressedHintCount).toBe(0);
    expect(dedup.suppressedModuleCount).toBe(0);
  });

  it('suppresses life-event module suggestion when plan is active', () => {
    const plan = buildFixturePlan('F01');
    const surface = projectActionSurface(plan);

    const dedup = dedupeHomeSurfaces({
      actionSurface: surface,
      p4Overlay: mergeP4WithPlan(plan, mockInsights([])),
      moduleSuggestions: [mockSuggestion('life-event'), mockSuggestion('grocery-optimization')],
    });

    expect(dedup.visibleModuleSuggestions.map((entry) => entry.module.id)).toEqual([
      'grocery-optimization',
    ]);
  });
});

describe('buildHomePlanViewModelV2 (LE-6)', () => {
  it('is deterministic for the same inputs', () => {
    const plan = buildFixturePlan('F01');
    const insights = mockInsights([]);
    const suggestions = [mockSuggestion('financial-reality')];
    const first = buildHomePlanViewModelV2({ plan, insights, moduleSuggestions: suggestions });
    const second = buildHomePlanViewModelV2({ plan, insights, moduleSuggestions: suggestions });

    expect(first).toEqual(second);
  });

  it('does not alter LE-4 ActionSurfaceV1 or LE-5 ExecutionSurfaceV1 structures', () => {
    const plan = buildFixturePlan('F01');
    const surface = projectActionSurface(plan);
    const execution = buildExecutionSurface(surface);

    const viewModel = buildHomePlanViewModelV2({
      plan,
      insights: mockInsights([]),
      moduleSuggestions: [],
      executionSurface: execution,
    });

    expect(viewModel.actionSurface).toEqual(surface);
    expect(viewModel.nextSteps.actionSurface).toEqual(surface);
    expect(viewModel.executionSurface).toEqual(execution);
    expect(viewModel.nextSteps.executionSurface).toEqual(execution);
  });

  it('hides overlapping P4 and suggested modules on Home when plan is active', () => {
    const plan = buildFixturePlan('F05');
    const insuranceHint: MissingContextHint = {
      domain: 'healthInsurance',
      mirrorSlug: 'health-insurance',
      message: 'Health insurance information is missing',
      suggestedAction: 'open_module',
      ctaModuleId: 'healthcare-navigation',
      href: '/modules/healthcare-navigation',
    };

    const viewModel = buildHomePlanViewModelV2({
      plan,
      insights: mockInsights([insuranceHint]),
      moduleSuggestions: [
        mockSuggestion('healthcare-navigation'),
        mockSuggestion('system-translation'),
      ],
    });

    expect(viewModel.nextSteps.showCard).toBe(true);
    expect(viewModel.p4.hints).toHaveLength(0);
    expect(viewModel.suggestedModules.items.map((entry) => entry.module.id)).toEqual([
      'system-translation',
    ]);
  });
});
