import type { ScenarioComparison, ScenarioResult } from '../types/index.js';

export function compareScenarios(
  baseline: ScenarioResult,
  proposed: ScenarioResult
): ScenarioComparison {
  const deltaTotalResources = round2(
    proposed.totalHouseholdResources - baseline.totalHouseholdResources
  );
  const deltaNetEmployment = round2(
    proposed.household.totalNet - baseline.household.totalNet
  );
  const deltaBuergergeld = round2(
    proposed.benefits.buergergeld.estimatedBenefit -
      baseline.benefits.buergergeld.estimatedBenefit
  );

  const grossDelta = proposed.household.totalGross - baseline.household.totalGross;
  const effectiveGainFromWork = deltaTotalResources;
  const marginalRetentionRate =
    grossDelta > 0 ? round2((effectiveGainFromWork / grossDelta) * 100) / 100 : null;

  return {
    baselineId: baseline.id,
    proposedId: proposed.id,
    deltaTotalResources,
    deltaNetEmployment,
    deltaBuergergeld,
    effectiveGainFromWork,
    marginalRetentionRate,
    benefitReductions: [
      {
        benefit: 'Bürgergeld',
        before: baseline.benefits.buergergeld.estimatedBenefit,
        after: proposed.benefits.buergergeld.estimatedBenefit,
        delta: deltaBuergergeld,
      },
    ],
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
