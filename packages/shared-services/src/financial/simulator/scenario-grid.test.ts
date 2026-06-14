import { describe, it, expect } from 'vitest';
import { buildHouseholdFromLegacy } from '../household/index.js';
import { resolveEmploymentsForLegacyInput } from '../benefits/benefits-engine.js';
import { runScenarioGrid } from './scenario-grid.js';

describe('runScenarioGrid', () => {
  it('evaluates baseline and scenarios deterministically via shared engines', () => {
    const household = buildHouseholdFromLegacy(1, 'single', 800, 1, false);
    const { employments } = resolveEmploymentsForLegacyInput(
      household,
      2500,
      1,
      false,
      'employed'
    );

    const output = runScenarioGrid({
      taxYear: 2025,
      baseline: {
        label: 'Current situation',
        household,
        employments,
      },
      scenarios: [
        {
          id: 'unemployment',
          label: 'Unemployment',
          events: [{ type: 'unemployment' }],
        },
        {
          id: 'minijob-450',
          label: 'Minijob €450',
          events: [{ type: 'minijob', grossMonthly: 450 }],
        },
      ],
      receivingBuergergeld: false,
    });

    expect(output.baseline.id).toBe('baseline');
    expect(output.scenarios).toHaveLength(2);
    expect(output.comparisons).toHaveLength(2);
    expect(output.comparisonSummary.bestScenarioId).toBeTruthy();
    expect(output.meta.disclaimer).toContain('not legal');
    expect(output.riskWarnings.length).toBeGreaterThan(0);
    expect(output.recommendations.length).toBeGreaterThanOrEqual(0);
  });

  it('minijob scenario differs from baseline in household resources', () => {
    const household = buildHouseholdFromLegacy(1, 'single', 800, 1, false);
    household.currentBenefits = { receivingBuergergeld: true };
    const { employments } = resolveEmploymentsForLegacyInput(
      household,
      0,
      1,
      false,
      'unemployed'
    );

    const output = runScenarioGrid({
      taxYear: 2025,
      baseline: {
        label: 'Unemployed baseline',
        household,
        employments,
      },
      scenarios: [
        {
          id: 'minijob-450',
          label: 'Minijob €450',
          events: [{ type: 'minijob', grossMonthly: 450 }],
        },
      ],
      receivingBuergergeld: true,
    });

    const minijob = output.scenarios[0]!;
    expect(minijob.household.totalGross).toBeGreaterThan(0);
    expect(minijob.totalHouseholdResources).not.toBe(output.baseline.totalHouseholdResources);
  });
});
