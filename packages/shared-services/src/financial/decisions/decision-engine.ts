import type {
  FinancialDecision,
  FinancialEngineOutput,
  FinancialVerdict,
  ScenarioComparison,
  ScenarioResult,
} from '../types/index.js';

export interface DecisionEngineInput {
  scenarios: ScenarioResult[];
  comparison?: ScenarioComparison;
  receivingBuergergeld: boolean;
}

const DISCLAIMER =
  'This is decision support, not legal or tax advice. Verify results with Jobcenter, Finanzamt, or a qualified advisor.';

export class DecisionEngine {
  evaluate(input: DecisionEngineInput): Pick<
    FinancialEngineOutput,
    'verdict' | 'decisions' | 'expectedChanges'
  > {
    const { scenarios, comparison, receivingBuergergeld } = input;
    const primary = scenarios[0];
    const decisions: FinancialDecision[] = [];
    const expectedChanges: FinancialEngineOutput['expectedChanges'] = [];

    if (comparison && comparison.proposedId) {
      decisions.push(...this.comparisonDecisions(comparison));

      if (comparison.effectiveGainFromWork !== null && comparison.effectiveGainFromWork > 0) {
        expectedChanges.push({
          trigger: 'Starting or increasing employment',
          obligations: [
            'Report income to Jobcenter within 2 weeks (Meldepflicht)',
            'Submit monthly Gehaltsabrechnungen if receiving Bürgergeld',
          ],
          timeline: 'Within 2 weeks of first payment',
        });
      }
    }

    if (primary.benefits.buergergeld.eligible) {
      decisions.push({
        id: 'BURGERGELD_ELIGIBLE',
        title: 'Potential Bürgergeld eligibility',
        description: `Estimated top-up of €${primary.benefits.buergergeld.estimatedBenefit}/month based on need vs countable income.`,
        priority: 'high',
        category: 'benefits',
        action: 'Contact local Jobcenter for Beratungsgespräch',
        institution: 'Jobcenter',
      });
    }

    if (primary.household.totalNet > 0 && primary.household.totalNet < primary.benefits.buergergeld.breakdown.kdu) {
      decisions.push({
        id: 'RENT_EXCEEDS_NET',
        title: 'Housing costs exceed net employment income',
        description: 'Net salary alone may not cover rent — Bürgergeld KdU or Wohngeld may apply.',
        priority: 'high',
        category: 'housing',
        action: 'Review housing costs with Jobcenter or Wohngeldstelle',
      });
    }

    const effectiveRate =
      primary.household.totalGross > 0
        ? (primary.household.totalGross - primary.household.totalNet) / primary.household.totalGross
        : 0;

    if (effectiveRate > 0.35 && primary.household.totalGross > 0) {
      decisions.push({
        id: 'HIGH_DEDUCTION_RATE',
        title: 'High deduction rate on employment income',
        description: `Approximately ${Math.round(effectiveRate * 100)}% of gross goes to tax and social contributions.`,
        priority: 'medium',
        category: 'tax',
        action: 'Review Steuerklasse options with Finanzamt',
        institution: 'Finanzamt',
      });
    }

    for (const member of primary.household.members) {
      if (member.employmentType === 'minijob') {
        decisions.push({
          id: 'MINIJOB_DETECTED',
          title: 'Minijob detected',
          description: 'Minijob income may have reduced social contributions. Bürgergeld Freibeträge still apply to gross.',
          priority: 'medium',
          category: 'employment',
        });
      }
      if (member.employmentType === 'midijob') {
        decisions.push({
          id: 'MIDJOB_DETECTED',
          title: 'Midijob (Gleitzone) detected',
          description: 'Social contributions calculated on reduced assessment base in the transition zone.',
          priority: 'medium',
          category: 'employment',
        });
      }
    }

    if (receivingBuergergeld && comparison && (comparison.deltaBuergergeld ?? 0) < 0) {
      decisions.push({
        id: 'BURGERGELD_REDUCTION',
        title: 'Bürgergeld may decrease with new income',
        description: `Estimated Bürgergeld reduction: €${Math.abs(comparison.deltaBuergergeld ?? 0)}/month. Check if total household resources still improve.`,
        priority: 'high',
        category: 'benefits',
        institution: 'Jobcenter',
      });
    }

    const verdict = this.buildVerdict(comparison);

    return { verdict, decisions, expectedChanges };
  }

  private buildVerdict(comparison?: ScenarioComparison): FinancialVerdict {
    if (!comparison || comparison.effectiveGainFromWork === null) {
      return {
        isJobFinanciallyBeneficial: null,
        summary: 'Single scenario analyzed — provide a proposed scenario to compare job impact.',
        householdDeltaMonthly: null,
        effectiveGainFromWork: null,
        marginalRetentionRate: null,
      };
    }

    const gain = comparison.effectiveGainFromWork;
    const beneficial = gain > 10;

    return {
      isJobFinanciallyBeneficial: beneficial,
      summary: beneficial
        ? `Employment improves household resources by approximately €${gain}/month after benefit adjustments.`
        : gain >= -10 && gain <= 10
          ? 'Employment has minimal net impact on total household resources — review carefully.'
          : `Employment may reduce total household resources by approximately €${Math.abs(gain)}/month.`,
      householdDeltaMonthly: comparison.deltaTotalResources,
      effectiveGainFromWork: gain,
      marginalRetentionRate: comparison.marginalRetentionRate,
    };
  }

  private comparisonDecisions(comparison: ScenarioComparison): FinancialDecision[] {
    const decisions: FinancialDecision[] = [];

    if (comparison.effectiveGainFromWork !== null && comparison.effectiveGainFromWork > 0) {
      decisions.push({
        id: 'WORK_IS_BENEFICIAL',
        title: 'Job appears financially beneficial',
        description: `Net household gain of ~€${comparison.effectiveGainFromWork}/month after Bürgergeld adjustment.`,
        priority: 'high',
        category: 'employment',
      });
    } else if (comparison.effectiveGainFromWork !== null && comparison.effectiveGainFromWork <= 0) {
      decisions.push({
        id: 'WORK_MAY_NOT_PAY',
        title: 'Job may not improve household finances',
        description: 'Benefit reductions may offset employment income. Verify with Jobcenter before deciding.',
        priority: 'critical',
        category: 'employment',
        institution: 'Jobcenter',
      });
    }

    return decisions;
  }
}

export const decisionEngine = new DecisionEngine();

export { DISCLAIMER };
