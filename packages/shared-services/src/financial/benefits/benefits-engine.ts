import type { FinancialParameterSet } from '../parameters/index.js';
import { getParameters } from '../parameters/index.js';
import type {
  Employment,
  FinancialScenario,
  HouseholdInput,
  MemberPayrollResult,
  PayrollDeductions,
  ScenarioResult,
  TaxClass,
} from '../types/index.js';
import { getAdultMembers } from '../household/index.js';
import { payrollEngine } from '../payroll/payroll-engine.js';
import {
  assertValidLegacyEmploymentRouting,
  buildApplicantEmploymentFromGross,
  legacyRoutingWarningsForGross,
} from '../payroll/employment-classification.js';
import { calculateBuergergeld } from './buergergeld/calculator.js';
import { countChildren } from '../household/index.js';

export class BenefitsEngine {
  evaluateScenario(
    scenario: FinancialScenario,
    household: HouseholdInput,
    params: FinancialParameterSet
  ): ScenarioResult {
    const memberPayrolls: MemberPayrollResult[] = [];

    for (const member of household.members) {
      const employment = scenario.employments[member.id] ?? { type: 'none' as const };
      const payroll = payrollEngine.calculateMemberPayroll(
        member.id,
        member.role,
        employment,
        params
      );
      memberPayrolls.push({ ...payroll, role: member.role });
    }

    const totalDeductions = aggregateDeductions(memberPayrolls);
    const totalGross = memberPayrolls.reduce((s, m) => s + m.gross, 0);
    const totalNet = memberPayrolls.reduce((s, m) => s + m.net, 0);

    const buergergeld = calculateBuergergeld(household, memberPayrolls, params);
    const childCount = countChildren(household.members);
    const kindergeld = childCount * params.kindergeld;

    const totalHouseholdResources = round2(totalNet + buergergeld.estimatedBenefit);

    return {
      id: scenario.id,
      label: scenario.label,
      household: {
        totalGross: round2(totalGross),
        totalNet: round2(totalNet),
        totalDeductions,
        members: memberPayrolls,
      },
      benefits: {
        buergergeld,
        kindergeld,
      },
      totalHouseholdResources,
    };
  }
}

function aggregateDeductions(members: MemberPayrollResult[]): PayrollDeductions {
  return members.reduce(
    (acc, m) => ({
      incomeTax: acc.incomeTax + m.deductions.incomeTax,
      solidaritySurcharge: acc.solidaritySurcharge + m.deductions.solidaritySurcharge,
      churchTax: acc.churchTax + m.deductions.churchTax,
      health: acc.health + m.deductions.health,
      pension: acc.pension + m.deductions.pension,
      unemployment: acc.unemployment + m.deductions.unemployment,
      care: acc.care + m.deductions.care,
      socialContributions: acc.socialContributions + m.deductions.socialContributions,
    }),
    {
      incomeTax: 0,
      solidaritySurcharge: 0,
      churchTax: 0,
      health: 0,
      pension: 0,
      unemployment: 0,
      care: 0,
      socialContributions: 0,
    }
  );
}

export const benefitsEngine = new BenefitsEngine();

export interface LegacyEmploymentResolution {
  employments: Record<string, Employment>;
  routingWarnings: string[];
}

export function resolveEmploymentsForLegacyInput(
  household: HouseholdInput,
  grossIncome: number,
  taxClass: TaxClass,
  churchTax: boolean,
  employmentStatus: string,
  options: { taxYear?: number } = {}
): LegacyEmploymentResolution {
  const params = getParameters(options.taxYear ?? 2025);
  const employments: Record<string, Employment> = {};
  const routingWarnings: string[] = [];

  for (const member of household.members) {
    employments[member.id] = { type: 'none' };
  }

  if (employmentStatus === 'unemployed' || employmentStatus === 'student') {
    return { employments, routingWarnings };
  }

  if (employmentStatus === 'self-employed') {
    employments.applicant = { type: 'self-employed', netMonthlyEstimate: grossIncome * 0.7 };
    return { employments, routingWarnings };
  }

  employments.applicant = buildApplicantEmploymentFromGross(
    grossIncome,
    taxClass,
    churchTax,
    params
  );

  assertValidLegacyEmploymentRouting(employments.applicant, grossIncome, params);

  const inferredWarnings = legacyRoutingWarningsForGross(grossIncome, params);
  if (inferredWarnings.length > 0) {
    routingWarnings.push(...inferredWarnings);
    console.warn(
      `[financial] ${inferredWarnings.join(', ')}: gross €${grossIncome} classified as ${employments.applicant.type}`
    );
  }

  return { employments, routingWarnings };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export { getAdultMembers };
