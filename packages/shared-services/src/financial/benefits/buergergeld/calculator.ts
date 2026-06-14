import type { FinancialParameterSet } from '../../parameters/index.js';
import type { BuergergeldBreakdown, HouseholdInput, MemberPayrollResult } from '../../types/index.js';
import { countChildren } from '../../household/index.js';
import { calculateRegelbedarf } from './regelbedarf.js';
import { calculateKdu } from './kdu.js';
import { calculateEmploymentFreibetrag } from './income-imputation.js';

export interface BuergergeldResult {
  eligible: boolean;
  estimatedBenefit: number;
  reasoning: string[];
  breakdown: BuergergeldBreakdown;
}

export function calculateBuergergeld(
  household: HouseholdInput,
  memberPayrolls: MemberPayrollResult[],
  params: FinancialParameterSet
): BuergergeldResult {
  const regelbedarf = calculateRegelbedarf(household.members, params);
  const kduResult = calculateKdu(household.housing, household.members, params);
  const grossNeed = round2(regelbedarf + kduResult.kdu);

  const grossEmploymentIncome = memberPayrolls.reduce((sum, m) => sum + m.gross, 0);
  const freibetragApplied = calculateEmploymentFreibetrag(grossEmploymentIncome, params);
  const countableEmployment = round2(Math.max(0, grossEmploymentIncome - freibetragApplied));

  const childCount = countChildren(household.members);
  const kindergeldIncome = childCount * params.kindergeld;

  const countableIncome = round2(countableEmployment + kindergeldIncome);
  const netBenefit = round2(Math.max(0, grossNeed - countableIncome));

  const reasoning: string[] = [
    `Regelbedarf (Bedarfsgemeinschaft): €${regelbedarf}/month`,
    `KdU (housing): €${kduResult.kdu}/month${kduResult.capped ? ` (capped at €${kduResult.capApplied})` : ''}`,
    `Total need (Bedarf): €${grossNeed}/month`,
    `Gross employment income: €${grossEmploymentIncome}/month`,
    `Freibetrag applied (§11b SGB II): €${freibetragApplied}/month`,
    `Kindergeld counted as income: €${kindergeldIncome}/month`,
    `Countable income (anrechenbares Einkommen): €${countableIncome}/month`,
  ];

  if (netBenefit <= 0) {
    reasoning.push('Countable income covers need — likely not eligible for Bürgergeld top-up');
  } else {
    reasoning.push(`Estimated Bürgergeld top-up: €${netBenefit}/month`);
  }

  return {
    eligible: netBenefit > 0,
    estimatedBenefit: netBenefit,
    reasoning,
    breakdown: {
      regelbedarf,
      kdu: kduResult.kdu,
      grossNeed,
      grossEmploymentIncome,
      freibetragApplied,
      countableIncome,
      kindergeldIncome,
      netBenefit,
    },
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
