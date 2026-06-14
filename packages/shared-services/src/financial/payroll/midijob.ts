import type { FinancialParameterSet } from '../parameters/index.js';
import type { MidijobEmployment, MemberPayrollResult, PayrollDeductions, PersonRole } from '../types/index.js';
import { calculateMidijobAssessmentBase, calculateSocialContributions } from './social-contributions.js';
import { defaultTaxAdapter } from './tax-adapter.js';

export function calculateMidijobPayroll(
  personId: string,
  role: PersonRole,
  employment: MidijobEmployment,
  params: FinancialParameterSet
): MemberPayrollResult {
  const gross = employment.grossMonthly;
  const assessmentBase = calculateMidijobAssessmentBase(gross, params);
  const social = calculateSocialContributions(assessmentBase, params);

  const tax = defaultTaxAdapter.calculate({
    grossMonthly: gross,
    taxClass: employment.taxClass,
    churchTax: employment.churchTax ?? false,
    taxYear: params.year,
    params,
  });

  const deductions: PayrollDeductions = {
    incomeTax: tax.incomeTax,
    solidaritySurcharge: tax.solidaritySurcharge,
    churchTax: tax.churchTax,
    health: social.health,
    pension: social.pension,
    unemployment: social.unemployment,
    care: social.care,
    socialContributions: social.total,
  };

  const totalDeductions =
    tax.incomeTax + tax.solidaritySurcharge + tax.churchTax + social.total;

  return {
    personId,
    role,
    employmentType: 'midijob',
    gross,
    net: round2(gross - totalDeductions),
    deductions,
    assessmentBase,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
