import { getParameters } from '../parameters/index.js';
import { benefitsEngine } from '../benefits/benefits-engine.js';
import { compareScenarios } from '../scenarios/comparator.js';
import { DISCLAIMER } from '../decisions/decision-engine.js';
import type { FinancialScenario } from '../types/index.js';
import { applyEventsToBaseline } from './event-transform.js';
import {
  buildComparisonSummary,
  buildRecommendations,
  buildRiskWarnings,
  buildSummary,
} from './analysis.js';
import type { SimulatorGridInput, SimulatorGridOutput } from './types.js';

export function runScenarioGrid(input: SimulatorGridInput): SimulatorGridOutput {
  const params = getParameters(input.taxYear);

  const baselineScenario: FinancialScenario = {
    id: 'baseline',
    label: input.baseline.label,
    employments: structuredClone(input.baseline.employments),
  };

  const baselineHousehold = structuredClone(input.baseline.household);
  const baselineResult = benefitsEngine.evaluateScenario(
    baselineScenario,
    baselineHousehold,
    params
  );

  const scenarioResults = input.scenarios.map((definition) => {
    const transformed = applyEventsToBaseline(
      {
        household: input.baseline.household,
        employments: input.baseline.employments,
      },
      definition.events
    );

    const scenario: FinancialScenario = {
      id: definition.id,
      label: definition.label,
      employments: transformed.employments,
    };

    return benefitsEngine.evaluateScenario(
      scenario,
      transformed.household,
      params
    );
  });

  const comparisons = scenarioResults.map((result) =>
    compareScenarios(baselineResult, result)
  );

  const comparisonSummary = buildComparisonSummary(baselineResult, scenarioResults);
  const receivingBuergergeld =
    input.receivingBuergergeld ??
    input.baseline.household.currentBenefits?.receivingBuergergeld ??
    false;

  const riskWarnings = buildRiskWarnings(
    baselineResult,
    scenarioResults,
    comparisons,
    receivingBuergergeld
  );

  const recommendations = buildRecommendations(
    baselineResult,
    scenarioResults,
    comparisons,
    input.scenarios
  );

  const bestScenario = scenarioResults.find(
    (s) => s.id === comparisonSummary.bestScenarioId
  );

  return {
    meta: {
      engineVersion: '2.0.0',
      taxYear: input.taxYear,
      ruleSetVersion: params.version,
      confidence: assessConfidence(input),
      disclaimer: DISCLAIMER,
      calculatedAt: new Date().toISOString(),
      scenarioCount: scenarioResults.length,
    },
    baseline: baselineResult,
    scenarios: scenarioResults,
    comparisons,
    comparisonSummary,
    riskWarnings,
    recommendations,
    summary: buildSummary(comparisonSummary, bestScenario),
  };
}

function assessConfidence(input: SimulatorGridInput): 'high' | 'medium' | 'low' {
  if (!input.baseline.household.housing.bundesland) return 'low';
  if (input.baseline.household.housing.cityMietstufe === undefined) return 'medium';
  if (input.scenarios.length > 4) return 'medium';
  return 'medium';
}
