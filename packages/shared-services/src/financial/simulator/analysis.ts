import type { ScenarioComparison, ScenarioResult } from '../types/index.js';
import type {
  SimulatorComparisonSummary,
  SimulatorRecommendation,
  SimulatorRiskWarning,
  SimulatorScenarioDefinition,
} from './types.js';

export function buildComparisonSummary(
  baseline: ScenarioResult,
  scenarios: ScenarioResult[]
): SimulatorComparisonSummary {
  const all = [baseline, ...scenarios];
  if (all.length === 0) {
    return {
      bestScenarioId: null,
      worstScenarioId: null,
      maxHouseholdResources: 0,
      minHouseholdResources: 0,
      spread: 0,
    };
  }

  let best = all[0]!;
  let worst = all[0]!;

  for (const scenario of all) {
    if (scenario.totalHouseholdResources > best.totalHouseholdResources) {
      best = scenario;
    }
    if (scenario.totalHouseholdResources < worst.totalHouseholdResources) {
      worst = scenario;
    }
  }

  const maxHouseholdResources = best.totalHouseholdResources;
  const minHouseholdResources = worst.totalHouseholdResources;

  return {
    bestScenarioId: best.id,
    worstScenarioId: worst.id,
    maxHouseholdResources,
    minHouseholdResources,
    spread: round2(maxHouseholdResources - minHouseholdResources),
  };
}

export function buildRiskWarnings(
  baseline: ScenarioResult,
  scenarios: ScenarioResult[],
  comparisons: ScenarioComparison[],
  receivingBuergergeld: boolean
): SimulatorRiskWarning[] {
  const warnings: SimulatorRiskWarning[] = [];

  for (const comparison of comparisons) {
    if (comparison.effectiveGainFromWork !== null && comparison.effectiveGainFromWork > 0) {
      warnings.push({
        id: `MELDEPFLICHT_${comparison.proposedId ?? 'unknown'}`,
        severity: 'high',
        title: 'Income must be reported to Jobcenter',
        description:
          'Starting or changing employment while receiving benefits requires reporting within 2 weeks (Meldepflicht).',
        category: 'legal',
        action: 'Report income to Jobcenter within 2 weeks of first payment',
        institution: 'Jobcenter',
      });
    }

    if (
      comparison.effectiveGainFromWork !== null &&
      comparison.effectiveGainFromWork <= 0 &&
      comparison.deltaNetEmployment !== null &&
      comparison.deltaNetEmployment > 0
    ) {
      warnings.push({
        id: `BENEFIT_CLIFF_${comparison.proposedId ?? 'unknown'}`,
        severity: 'critical',
        title: 'Employment may not improve household finances',
        description:
          'Benefit reductions may offset employment income. Total household resources may not increase.',
        category: 'financial',
        action: 'Verify with Jobcenter before committing to employment change',
        institution: 'Jobcenter',
      });
    }

    if ((comparison.deltaBuergergeld ?? 0) < 0 && receivingBuergergeld) {
      warnings.push({
        id: `BURGERGELD_REDUCTION_${comparison.proposedId ?? 'unknown'}`,
        severity: 'high',
        title: 'Bürgergeld may decrease with new income',
        description: `Estimated Bürgergeld reduction: €${Math.abs(comparison.deltaBuergergeld ?? 0)}/month.`,
        category: 'benefits',
        institution: 'Jobcenter',
      });
    }
  }

  for (const scenario of scenarios) {
    if (
      scenario.household.totalNet > 0 &&
      scenario.household.totalNet < scenario.benefits.buergergeld.breakdown.kdu
    ) {
      warnings.push({
        id: `RENT_EXCEEDS_NET_${scenario.id}`,
        severity: 'high',
        title: 'Housing costs exceed net employment income',
        description: 'Net salary alone may not cover rent — Bürgergeld KdU or Wohngeld may apply.',
        category: 'housing',
        action: 'Review housing costs with Jobcenter or Wohngeldstelle',
      });
    }
  }

  if (baseline.benefits.buergergeld.eligible) {
    warnings.push({
      id: 'BURGERGELD_BASELINE',
      severity: 'medium',
      title: 'Baseline indicates potential Bürgergeld eligibility',
      description: `Estimated top-up of €${baseline.benefits.buergergeld.estimatedBenefit}/month in current situation.`,
      category: 'benefits',
      institution: 'Jobcenter',
    });
  }

  return dedupeWarnings(warnings);
}

export function buildRecommendations(
  baseline: ScenarioResult,
  scenarios: ScenarioResult[],
  comparisons: ScenarioComparison[],
  definitions: SimulatorScenarioDefinition[]
): SimulatorRecommendation[] {
  const recommendations: SimulatorRecommendation[] = [];

  for (const comparison of comparisons) {
    const scenario = scenarios.find((s) => s.id === comparison.proposedId);
    if (!scenario || comparison.effectiveGainFromWork === null) continue;

    if (comparison.effectiveGainFromWork > 10) {
      recommendations.push({
        id: `SCENARIO_VIABLE_${scenario.id}`,
        scenarioId: scenario.id,
        title: `${scenario.label} improves household resources`,
        description: `Net household gain of approximately €${comparison.effectiveGainFromWork}/month after benefit adjustments.`,
        priority: 'high',
        rationale: `Total resources increase from €${baseline.totalHouseholdResources} to €${scenario.totalHouseholdResources}.`,
      });
    } else if (comparison.effectiveGainFromWork <= -10) {
      recommendations.push({
        id: `SCENARIO_RISKY_${scenario.id}`,
        scenarioId: scenario.id,
        title: `${scenario.label} may reduce household resources`,
        description: `Estimated loss of €${Math.abs(comparison.effectiveGainFromWork)}/month vs baseline.`,
        priority: 'critical',
        rationale: 'Benefit reductions may outweigh employment income gains.',
      });
    }
  }

  const bestComparison = [...comparisons].sort(
    (a, b) => (b.effectiveGainFromWork ?? -Infinity) - (a.effectiveGainFromWork ?? -Infinity)
  )[0];

  if (bestComparison?.proposedId && (bestComparison.effectiveGainFromWork ?? 0) > 10) {
    const def = definitions.find((d) => d.id === bestComparison.proposedId);
    recommendations.push({
      id: 'BEST_SCENARIO',
      scenarioId: bestComparison.proposedId,
      title: `Best option: ${def?.label ?? bestComparison.proposedId}`,
      description: `Highest household resource gain among modeled scenarios.`,
      priority: 'high',
      rationale: `Effective gain from work: €${bestComparison.effectiveGainFromWork}/month.`,
    });
  }

  return recommendations;
}

export function buildSummary(
  comparisonSummary: SimulatorComparisonSummary,
  bestScenario?: ScenarioResult
): string {
  if (!bestScenario || comparisonSummary.spread <= 0) {
    return 'All modeled scenarios produce similar household resources — review details carefully.';
  }
  return `${bestScenario.label} appears most favorable (+€${round2(bestScenario.totalHouseholdResources - comparisonSummary.minHouseholdResources)} vs worst case).`;
}

function dedupeWarnings(warnings: SimulatorRiskWarning[]): SimulatorRiskWarning[] {
  const seen = new Set<string>();
  return warnings.filter((warning) => {
    if (seen.has(warning.id)) return false;
    seen.add(warning.id);
    return true;
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
