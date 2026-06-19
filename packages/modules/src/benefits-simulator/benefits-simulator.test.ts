import { describe, it, expect } from 'vitest';
import {
  adaptLegacyInputToV2,
  compareScenarios,
  financialPipeline,
  runScenarioGrid,
  buildHouseholdFromLegacy,
  resolveEmploymentsForLegacyInput,
} from '@arrival-atlas/shared-services';
import { benefitsSimulatorModule } from './index.js';

function buildMinijobScenarioInput() {
  const household = buildHouseholdFromLegacy(1, 'single', 800, 1, false);
  household.currentBenefits = { receivingBuergergeld: true };
  const { employments } = resolveEmploymentsForLegacyInput(
    household,
    0,
    1,
    false,
    'unemployed'
  );

  return {
    taxYear: 2025,
    household,
    baselineEmployments: employments,
    scenarios: [
      {
        id: 'minijob-450',
        label: 'Minijob €450',
        events: [{ type: 'minijob' as const, grossMonthly: 450 }],
      },
    ],
  };
}

describe('benefitsSimulatorModule', () => {
  it('returns strict output contract with baseline and scenarios', async () => {
    const output = await benefitsSimulatorModule.execute(
      buildMinijobScenarioInput(),
      {}
    );

    expect(output.meta.confidence).toBeDefined();
    expect(output.meta.disclaimer).toContain('not legal');
    expect(output.meta.schemaVersion).toBe('1.0.0');
    expect(output.baseline.id).toBe('baseline');
    expect(output.scenarios).toHaveLength(1);
    expect(output.comparison.spread).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(output.riskWarnings)).toBe(true);
    expect(Array.isArray(output.recommendations)).toBe(true);
    expect(output.summary.length).toBeGreaterThan(0);
  });

  it('matches financial-reality minijob comparison for overlapping scenario', async () => {
    const simulatorOutput = await benefitsSimulatorModule.execute(
      buildMinijobScenarioInput(),
      {}
    );

    const v2Input = adaptLegacyInputToV2({
      grossIncome: 0,
      taxClass: 1,
      churchTax: false,
      householdSize: 1,
      monthlyRent: 800,
      employmentStatus: 'unemployed',
      maritalStatus: 'single',
      proposedGrossIncome: 450,
    });
    const v2Output = financialPipeline.run(v2Input);

    const simulatorScenario = simulatorOutput.scenarios[0]!;
    const financialProposed = v2Output.scenarios[1]!;

    expect(simulatorScenario.financialImpact.totalGross).toBe(
      financialProposed.household.totalGross
    );
    expect(simulatorScenario.benefitChanges.buergergeld.after).toBe(
      financialProposed.benefits.buergergeld.estimatedBenefit
    );
  });

  it('uses immutable event transforms via shared scenario grid', () => {
    const input = buildMinijobScenarioInput();
    const grid = runScenarioGrid({
      taxYear: input.taxYear,
      baseline: {
        label: 'Current situation',
        household: input.household,
        employments: input.baselineEmployments,
      },
      scenarios: input.scenarios,
      receivingBuergergeld: true,
    });

    expect(grid.baseline.household.totalGross).toBe(0);
    expect(grid.scenarios[0]!.household.totalGross).toBe(450);
    expect(compareScenarios(grid.baseline, grid.scenarios[0]!).effectiveGainFromWork).not.toBeNull();
  });
});
