import type { FinancialEngineInput, FinancialEngineOutput, FinancialScenario } from '../types/index.js';
import { buildHouseholdFromLegacy } from '../household/index.js';
import { resolveEmploymentsForLegacyInput } from '../benefits/benefits-engine.js';
import { financialPipeline } from '../pipeline/financial-pipeline.js';

export interface LegacyFinancialInput {
  grossIncome: number;
  taxClass: 1 | 2 | 3 | 4 | 5 | 6;
  churchTax: boolean;
  householdSize: number;
  monthlyRent: number;
  employmentStatus: 'employed' | 'self-employed' | 'unemployed' | 'part-time' | 'student';
  maritalStatus: 'single' | 'married' | 'divorced' | 'widowed';
  /** Optional proposed job gross for scenario comparison */
  proposedGrossIncome?: number;
}

export function adaptLegacyInputToV2(
  input: LegacyFinancialInput,
  options: { taxYear?: number; compareUnemployed?: boolean } = {}
): FinancialEngineInput {
  const household = buildHouseholdFromLegacy(
    input.householdSize,
    input.maritalStatus,
    input.monthlyRent,
    input.taxClass,
    input.churchTax
  );

  const taxYear = options.taxYear ?? 2025;
  const routingWarnings: string[] = [];

  const baselineResolution = resolveEmploymentsForLegacyInput(
    household,
    input.employmentStatus === 'unemployed' ? 0 : input.grossIncome,
    input.taxClass,
    input.churchTax,
    input.employmentStatus === 'part-time' ? 'employed' : input.employmentStatus,
    { taxYear }
  );
  routingWarnings.push(...baselineResolution.routingWarnings);

  const baseline: FinancialScenario = {
    id: 'baseline',
    label: 'Current situation',
    employments: baselineResolution.employments,
  };

  let proposed: FinancialScenario | undefined;
  let mode: FinancialEngineInput['mode'] = 'quick';

  if (input.proposedGrossIncome !== undefined) {
    const proposedResolution = resolveEmploymentsForLegacyInput(
      household,
      input.proposedGrossIncome,
      input.taxClass,
      input.churchTax,
      'employed',
      { taxYear }
    );
    routingWarnings.push(...proposedResolution.routingWarnings);
    proposed = {
      id: 'proposed',
      label: 'Proposed job',
      employments: proposedResolution.employments,
    };
    mode = 'compare';
  } else if (options.compareUnemployed && input.employmentStatus !== 'unemployed') {
    proposed = baseline;
    const unemployedResolution = resolveEmploymentsForLegacyInput(
      household,
      0,
      input.taxClass,
      input.churchTax,
      'unemployed',
      { taxYear }
    );
    routingWarnings.push(...unemployedResolution.routingWarnings);
    baseline.employments = unemployedResolution.employments;
    mode = 'compare';
  }

  return {
    mode,
    household,
    baseline,
    proposed,
    taxYear,
    ruleSetVersion: '2025.1',
    routingWarnings: routingWarnings.length > 0 ? [...new Set(routingWarnings)] : undefined,
  };
}

/** Map v1 priority to closest v2 priority for UI compatibility */
function mapPriority(p: string): 'high' | 'medium' | 'low' {
  if (p === 'critical') return 'high';
  if (p === 'high' || p === 'medium' || p === 'low') return p;
  return 'medium';
}

export interface LegacyFinancialOutput {
  income: {
    gross: number;
    net: number;
    deductions: {
      incomeTax: number;
      solidaritySurcharge: number;
      churchTax: number;
      socialContributions: number;
    };
    effectiveTaxRate: number;
  };
  benefits: {
    buergergeld: {
      eligible: boolean;
      estimatedBenefit: number;
      reasoning: string[];
    };
  };
  decisions: Array<{
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    action?: string;
  }>;
  adminRules: string[];
  /** v2 extensions (optional, ignored by v1 UI) */
  meta?: FinancialEngineOutput['meta'];
  verdict?: FinancialEngineOutput['verdict'];
  comparison?: FinancialEngineOutput['comparison'];
  scenarios?: FinancialEngineOutput['scenarios'];
  expectedChanges?: FinancialEngineOutput['expectedChanges'];
}

export function adaptV2OutputToLegacy(
  v2: FinancialEngineOutput,
  adminRules: string[] = []
): LegacyFinancialOutput {
  const primary = v2.scenarios[0];
  const d = primary.household.totalDeductions;
  const gross = primary.household.totalGross;
  const net = primary.household.totalNet;
  const effectiveTaxRate =
    gross > 0 ? Math.round(((gross - net) / gross) * 1000) / 10 : 0;

  return {
    income: {
      gross,
      net,
      deductions: {
        incomeTax: d.incomeTax,
        solidaritySurcharge: d.solidaritySurcharge,
        churchTax: d.churchTax,
        socialContributions: d.socialContributions,
      },
      effectiveTaxRate,
    },
    benefits: {
      buergergeld: {
        eligible: primary.benefits.buergergeld.eligible,
        estimatedBenefit: primary.benefits.buergergeld.estimatedBenefit,
        reasoning: primary.benefits.buergergeld.reasoning,
      },
    },
    decisions: v2.decisions.map((dec) => ({
      title: dec.title,
      description: dec.description,
      priority: mapPriority(dec.priority),
      action: dec.action,
    })),
    adminRules,
    meta: v2.meta,
    verdict: v2.verdict,
    comparison: v2.comparison,
    scenarios: v2.scenarios,
    expectedChanges: v2.expectedChanges,
  };
}

export function runLegacyPipeline(
  input: LegacyFinancialInput,
  adminRules: string[] = []
): LegacyFinancialOutput {
  const engineInput = adaptLegacyInputToV2(input);
  const result = financialPipeline.run(engineInput);
  return adaptV2OutputToLegacy(result, adminRules);
}
