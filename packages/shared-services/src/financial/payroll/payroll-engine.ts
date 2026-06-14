import type { FinancialParameterSet } from '../parameters/index.js';
import type {
  Employment,
  MemberPayrollResult,
  PayrollDeductions,
  PersonRole,
  RegularEmployment,
  SelfEmployedEmployment,
} from '../types/index.js';
import { calculateMinijobPayroll } from './minijob.js';
import { calculateMidijobPayroll } from './midijob.js';
import {
  calculateSocialContributions,
  cappedAssessmentBase,
  classifyEmploymentByGross,
} from './social-contributions.js';
import { defaultTaxAdapter, type PayrollTaxAdapter } from './tax-adapter.js';

export interface PayrollEngineOptions {
  taxAdapter?: PayrollTaxAdapter;
}

export class PayrollEngine {
  private taxAdapter: PayrollTaxAdapter;

  constructor(options: PayrollEngineOptions = {}) {
    this.taxAdapter = options.taxAdapter ?? defaultTaxAdapter;
  }

  calculateMemberPayroll(
    personId: string,
    role: PersonRole,
    employment: Employment,
    params: FinancialParameterSet
  ): MemberPayrollResult {
    if (employment.type === 'none') {
      return emptyPayroll(personId, role);
    }

    if (employment.type === 'self-employed') {
      return selfEmployedPayroll(personId, role, employment);
    }

    if (employment.type === 'minijob') {
      return calculateMinijobPayroll(personId, role, employment, params);
    }

    if (employment.type === 'midijob') {
      return calculateMidijobPayroll(personId, role, employment, params);
    }

    if (employment.type === 'regular') {
      return this.calculateRegularPayroll(personId, role, employment, params);
    }

    const _exhaustive: never = employment;
    return _exhaustive;
  }

  inferAndCalculate(
    personId: string,
    role: PersonRole,
    grossMonthly: number,
    taxClass: RegularEmployment['taxClass'],
    churchTax: boolean,
    params: FinancialParameterSet
  ): MemberPayrollResult {
    const classification = classifyEmploymentByGross(grossMonthly, params);

    if (classification === 'minijob') {
      return calculateMinijobPayroll(personId, role, { type: 'minijob', grossMonthly }, params);
    }
    if (classification === 'midijob') {
      return calculateMidijobPayroll(
        personId,
        role,
        { type: 'midijob', grossMonthly, taxClass, churchTax },
        params
      );
    }
    return this.calculateRegularPayroll(
      personId,
      role,
      { type: 'regular', grossMonthly, taxClass, churchTax },
      params
    );
  }

  private calculateRegularPayroll(
    personId: string,
    role: PersonRole,
    employment: RegularEmployment,
    params: FinancialParameterSet
  ): MemberPayrollResult {
    const gross = employment.grossMonthly;
    const assessmentBase = cappedAssessmentBase(gross, params);
    const social = calculateSocialContributions(assessmentBase, params);

    const tax = this.taxAdapter.calculate({
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
      employmentType: 'regular',
      gross,
      net: round2(gross - totalDeductions),
      deductions,
      assessmentBase,
    };
  }
}

function emptyPayroll(personId: string, role: PersonRole): MemberPayrollResult {
  const zero = {
    incomeTax: 0,
    solidaritySurcharge: 0,
    churchTax: 0,
    health: 0,
    pension: 0,
    unemployment: 0,
    care: 0,
    socialContributions: 0,
  };
  return {
    personId,
    role,
    employmentType: 'none',
    gross: 0,
    net: 0,
    deductions: zero,
  };
}

function selfEmployedPayroll(
  personId: string,
  role: PersonRole,
  employment: SelfEmployedEmployment
): MemberPayrollResult {
  const zero = {
    incomeTax: 0,
    solidaritySurcharge: 0,
    churchTax: 0,
    health: 0,
    pension: 0,
    unemployment: 0,
    care: 0,
    socialContributions: 0,
  };
  return {
    personId,
    role,
    employmentType: 'self-employed',
    gross: employment.netMonthlyEstimate,
    net: employment.netMonthlyEstimate,
    deductions: zero,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export const payrollEngine = new PayrollEngine();
