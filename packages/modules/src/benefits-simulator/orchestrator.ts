import {
  describeEvents,
  runScenarioGrid,
  type ScenarioComparison,
  type ScenarioResult,
  type SimulatorGridOutput,
} from '@arrivalos/shared-services';
import { adaptToSimulatorGridInput } from './adapter.js';
import {
  BENEFITS_SIMULATOR_SCHEMA_VERSION,
  type BenefitsSimulatorInput,
  type BenefitsSimulatorOutput,
} from './schema.js';

export function runBenefitsSimulator(
  input: BenefitsSimulatorInput
): BenefitsSimulatorOutput {
  const gridInput = adaptToSimulatorGridInput(input);
  const gridOutput = runScenarioGrid(gridInput);
  return mapGridOutputToModuleOutput(gridOutput, input);
}

function mapGridOutputToModuleOutput(
  grid: SimulatorGridOutput,
  input: BenefitsSimulatorInput
): BenefitsSimulatorOutput {
  const comparisonByScenarioId = new Map<string, ScenarioComparison>(
    grid.comparisons
      .filter((c) => c.proposedId)
      .map((c) => [c.proposedId!, c])
  );

  const eventLabelsByScenarioId = new Map(
    input.scenarios.map((s) => [s.id, describeEvents(s.events)])
  );

  return {
    meta: {
      ...grid.meta,
      schemaVersion: BENEFITS_SIMULATOR_SCHEMA_VERSION,
    },
    baseline: mapScenarioSummary(grid.baseline, grid.baseline, null, ['baseline']),
    scenarios: grid.scenarios.map((scenario) =>
      mapScenarioSummary(
        scenario,
        grid.baseline,
        comparisonByScenarioId.get(scenario.id) ?? null,
        eventLabelsByScenarioId.get(scenario.id) ?? []
      )
    ),
    comparison: grid.comparisonSummary,
    riskWarnings: grid.riskWarnings,
    recommendations: grid.recommendations,
    summary: grid.summary,
  };
}

function mapScenarioSummary(
  scenario: ScenarioResult,
  baseline: ScenarioResult,
  comparison: ScenarioComparison | null,
  eventsApplied: string[]
): BenefitsSimulatorOutput['baseline'] {
  const buergergeldAfter = scenario.benefits.buergergeld.estimatedBenefit;
  const buergergeldBefore = baseline.benefits.buergergeld.estimatedBenefit;
  const kindergeldAfter = scenario.benefits.kindergeld;
  const kindergeldBefore = baseline.benefits.kindergeld;

  return {
    id: scenario.id,
    label: scenario.label,
    eventsApplied,
    financialImpact: {
      totalGross: scenario.household.totalGross,
      totalNet: scenario.household.totalNet,
      totalHouseholdResources: scenario.totalHouseholdResources,
      deltaFromBaseline: round2(scenario.totalHouseholdResources - baseline.totalHouseholdResources),
    },
    benefitChanges: {
      buergergeld: {
        before: buergergeldBefore,
        after: buergergeldAfter,
        delta: round2(buergergeldAfter - buergergeldBefore),
        eligible: scenario.benefits.buergergeld.eligible,
        breakdown: {
          regelbedarf: scenario.benefits.buergergeld.breakdown.regelbedarf,
          kdu: scenario.benefits.buergergeld.breakdown.kdu,
          freibetragApplied: scenario.benefits.buergergeld.breakdown.freibetragApplied,
          kindergeld: scenario.benefits.buergergeld.breakdown.kindergeldIncome,
        },
      },
      kindergeld: {
        before: kindergeldBefore,
        after: kindergeldAfter,
        delta: round2(kindergeldAfter - kindergeldBefore),
      },
    },
    effectiveGainFromWork: comparison?.effectiveGainFromWork ?? null,
    marginalRetentionRate: comparison?.marginalRetentionRate ?? null,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
