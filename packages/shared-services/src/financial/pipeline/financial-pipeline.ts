import { getParameters } from '../parameters/index.js';
import { benefitsEngine } from '../benefits/benefits-engine.js';
import { compareScenarios } from '../scenarios/comparator.js';
import { decisionEngine, DISCLAIMER } from '../decisions/decision-engine.js';
import type { FinancialEngineInput, FinancialEngineOutput } from '../types/index.js';

export class FinancialPipeline {
  run(input: FinancialEngineInput): FinancialEngineOutput {
    const params = getParameters(input.taxYear);
    const baselineResult = benefitsEngine.evaluateScenario(
      input.baseline,
      input.household,
      params
    );

    const scenarios = [baselineResult];
    let comparison;

    if (input.proposed) {
      const proposedResult = benefitsEngine.evaluateScenario(
        input.proposed,
        input.household,
        params
      );
      scenarios.push(proposedResult);
      comparison = compareScenarios(baselineResult, proposedResult);
    }

    const { verdict, decisions, expectedChanges } = decisionEngine.evaluate({
      scenarios,
      comparison,
      receivingBuergergeld: input.household.currentBenefits?.receivingBuergergeld ?? false,
    });

    const confidence = this.assessConfidence(input, comparison);

    return {
      meta: {
        engineVersion: '2.0.0',
        taxYear: input.taxYear,
        ruleSetVersion: params.version,
        mode: input.mode,
        confidence,
        disclaimer: DISCLAIMER,
        calculatedAt: new Date().toISOString(),
        routingWarnings: input.routingWarnings,
      },
      verdict,
      scenarios,
      comparison,
      decisions,
      expectedChanges,
      calculationTrace:
        input.mode === 'full'
          ? this.buildTrace(baselineResult, params.version)
          : undefined,
    };
  }

  private assessConfidence(
    input: FinancialEngineInput,
    comparison?: ReturnType<typeof compareScenarios>
  ): 'high' | 'medium' | 'low' {
    if (!input.household.housing.bundesland) return 'low';
    if (input.household.housing.cityMietstufe === undefined) return 'medium';
    if (comparison && comparison.effectiveGainFromWork !== null) return 'medium';
    return 'medium';
  }

  private buildTrace(
    scenario: ReturnType<typeof benefitsEngine.evaluateScenario>,
    ruleSetVersion: string
  ) {
    const b = scenario.benefits.buergergeld.breakdown;
    return [
      {
        step: 'regelbedarf',
        inputs: { ruleSetVersion },
        output: b.regelbedarf,
        legalReference: 'SGB II Regelbedarf',
      },
      {
        step: 'kdu',
        inputs: { coldRent: b.kdu },
        output: b.kdu,
        legalReference: 'SGB II KdU',
      },
      {
        step: 'freibetrag',
        inputs: { grossEmployment: b.grossEmploymentIncome },
        output: b.freibetragApplied,
        legalReference: '§ 11b SGB II',
      },
      {
        step: 'net_benefit',
        inputs: { grossNeed: b.grossNeed, countableIncome: b.countableIncome },
        output: b.netBenefit,
      },
    ];
  }
}

export const financialPipeline = new FinancialPipeline();
