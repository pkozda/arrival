import { describe, expect, it } from 'vitest';
import type { PublicModuleContract, UserProfileViewV1 } from '@/lib/product-contract';
import {
  buildSituationSummary,
  deriveOnboardingSteps,
  profilePrefillApplied,
  shouldShowOnboardingChecklist,
  suggestModules,
} from './situation-utils';
import { makeSnapshot } from './test-fixtures/ui-snapshot.js';

function makeProfile(overrides: Partial<UserProfileViewV1['domains']> = {}): UserProfileViewV1 {
  return {
    schemaVersion: '1.0.0',
    preferences: { preferredLanguage: 'en' },
    completeness: { score: 0, missingDomains: [] },
    domains: overrides,
  };
}

function makeModule(id: string, title: string): PublicModuleContract {
  return {
    id,
    title,
    description: `${title} description`,
    version: '1.0.0',
    status: 'available',
    capabilities: {
      supports: {
        recommendations: true,
        actions: true,
        explanation: true,
        riskModel: false,
      },
    },
    metadata: {},
  };
}

describe('buildSituationSummary', () => {
  it('returns empty state when profile has no meaningful data', () => {
    const summary = buildSituationSummary(null, 'en');
    expect(summary.isEmpty).toBe(true);
    expect(summary.headlineLines).toEqual([]);
  });

  it('builds human-readable headline lines without sensitive numbers', () => {
    const summary = buildSituationSummary(
      makeProfile({
        housing: { city: 'Berlin' },
        employment: { employmentStatus: 'employed' },
        income: { grossMonthlyIncome: 2500 },
        household: { householdSize: 2 },
      }),
      'en'
    );

    expect(summary.isEmpty).toBe(false);
    expect(summary.headlineLines).toEqual(['Berlin', 'Employed', 'Household of 2']);
    expect(summary.headlineLines.join(' ')).not.toContain('2500');
  });
});

describe('deriveOnboardingSteps', () => {
  it('marks first tool complete after an execution exists', () => {
    const snapshot = makeSnapshot({
      executionsByModuleId: { 'financial-reality': [{ executionId: 'e1' } as never] },
      executions: [{ executionId: 'e1' } as never],
    });

    const steps = deriveOnboardingSteps(snapshot, null);
    expect(steps.find((step) => step.id === 'firstTool')?.complete).toBe(true);
  });
});

describe('shouldShowOnboardingChecklist', () => {
  it('hides checklist when dismissed', () => {
    const snapshot = makeSnapshot();
    expect(shouldShowOnboardingChecklist(snapshot, null, true)).toBe(false);
  });
});

describe('suggestModules', () => {
  const modules = [
    makeModule('financial-reality', 'Financial Reality'),
    makeModule('healthcare-navigation', 'Healthcare Navigation'),
    makeModule('benefits-simulator', 'Benefits Simulator'),
  ];

  it('suggests financial and healthcare modules for an empty profile', () => {
    const suggestions = suggestModules(makeSnapshot(), modules, null);
    expect(suggestions.map((entry) => entry.module.id)).toEqual([
      'financial-reality',
      'healthcare-navigation',
    ]);
    expect(suggestions[0]?.reason.length).toBeGreaterThan(0);
    expect(suggestions.every((entry) => !entry.reason.includes('financial-reality'))).toBe(true);
  });

  it('suggests benefits when finance exists but benefits do not', () => {
    const suggestions = suggestModules(
      makeSnapshot({
        executionsByModuleId: { 'financial-reality': [{ executionId: 'e1' } as never] },
      }),
      modules,
      makeProfile({ employment: { employmentStatus: 'employed' } })
    );

    expect(suggestions.some((entry) => entry.module.id === 'benefits-simulator')).toBe(true);
  });
});

describe('profilePrefillApplied', () => {
  it('detects when merged defaults differ from schema defaults', () => {
    expect(
      profilePrefillApplied({ grossIncome: 0 }, { grossIncome: 2500 })
    ).toBe(true);
    expect(profilePrefillApplied({ grossIncome: 0 }, { grossIncome: 0 })).toBe(false);
  });
});
