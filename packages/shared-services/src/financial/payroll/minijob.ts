import type { FinancialParameterSet } from '../parameters/index.js';
import type { MinijobEmployment, MemberPayrollResult, PayrollDeductions, PersonRole } from '../types/index.js';

export function calculateMinijobPayroll(
  personId: string,
  role: PersonRole,
  employment: MinijobEmployment,
  params: FinancialParameterSet
): MemberPayrollResult {
  const gross = employment.grossMonthly;
  const pension = employment.rvOptIn ? gross * params.minijob.rvOptInRate : 0;

  const deductions: PayrollDeductions = {
    incomeTax: 0,
    solidaritySurcharge: 0,
    churchTax: 0,
    health: 0,
    pension: round2(pension),
    unemployment: 0,
    care: 0,
    socialContributions: round2(pension),
  };

  return {
    personId,
    role,
    employmentType: 'minijob',
    gross,
    net: round2(gross - pension),
    deductions,
    assessmentBase: gross,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
