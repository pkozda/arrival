import { describe, it, expect } from 'vitest';
import { LohnsteuerrechnerAdapter } from './payroll/tax-adapter.js';
import { PARAMETERS_2025 } from './parameters/2025.js';
import { PayrollEngine } from './payroll/payroll-engine.js';
import { calculateEmploymentFreibetrag } from './benefits/buergergeld/income-imputation.js';
import { calculateRegelbedarf } from './benefits/buergergeld/regelbedarf.js';
import { buildHouseholdFromLegacy } from './household/index.js';
import payrollFixtures from './__fixtures__/payroll-2025.json';
import buergergeldFixtures from './__fixtures__/buergergeld-2025.json';

const params = PARAMETERS_2025;
const payrollEngine = new PayrollEngine();

interface PayrollFixture {
  id: string;
  input: Record<string, unknown>;
  expected: Record<string, number>;
}

interface BuergergeldFixture {
  id: string;
  input: Record<string, unknown>;
  expected: Record<string, number>;
}

describe('LohnsteuerrechnerAdapter', () => {
  const adapter = new LohnsteuerrechnerAdapter();

  it('calculates plausible Lohnsteuer for €2500 StKl I', () => {
    const result = adapter.calculate({
      grossMonthly: 2500,
      taxClass: 1,
      churchTax: false,
      taxYear: 2025,
      params,
    });
    expect(result.incomeTax).toBeGreaterThan(200);
    expect(result.incomeTax).toBeLessThan(220);
  });

  it('matches payroll golden fixtures (tax portion)', () => {
    const fixture = (payrollFixtures as PayrollFixture[]).find((f) => f.id === 'stkl1-2500-monthly')!;
    const tax = adapter.calculate({
      grossMonthly: fixture.input.grossMonthly as number,
      taxClass: fixture.input.taxClass as 1,
      churchTax: fixture.input.churchTax as boolean,
      taxYear: 2025,
      params,
    });
    expect(tax.incomeTax).toBeGreaterThanOrEqual(fixture.expected.incomeTaxMin);
    expect(tax.incomeTax).toBeLessThanOrEqual(fixture.expected.incomeTaxMax);
  });
});

describe('PayrollEngine', () => {
  it('calculates regular employment net within golden bounds', () => {
    const result = payrollEngine.inferAndCalculate(
      'applicant',
      'applicant',
      2500,
      1,
      false,
      params
    );
    expect(result.net).toBeGreaterThan(1750);
    expect(result.net).toBeLessThan(1820);
    expect(result.employmentType).toBe('regular');
  });

  it('handles Minijob with zero employee social when no RV opt-in', () => {
    const result = payrollEngine.calculateMemberPayroll(
      'applicant',
      'applicant',
      { type: 'minijob', grossMonthly: 450, rvOptIn: false },
      params
    );
    expect(result.net).toBe(450);
    expect(result.deductions.socialContributions).toBe(0);
  });

  it('handles Minijob with RV opt-in', () => {
    const fixture = (payrollFixtures as PayrollFixture[]).find((f) => f.id === 'minijob-556-rv-opt-in')!;
    const result = payrollEngine.calculateMemberPayroll(
      'applicant',
      'applicant',
      { type: 'minijob', grossMonthly: 556, rvOptIn: true },
      params
    );
    expect(result.net).toBeGreaterThanOrEqual(fixture.expected.netMin);
    expect(result.net).toBeLessThanOrEqual(fixture.expected.netMax);
  });

  it('applies Gleitzone assessment base for Midijob', () => {
    const result = payrollEngine.calculateMemberPayroll(
      'applicant',
      'applicant',
      { type: 'midijob', grossMonthly: 1000, taxClass: 1, churchTax: false },
      params
    );
    expect(result.employmentType).toBe('midijob');
    expect(result.assessmentBase!).toBeGreaterThan(800);
    expect(result.assessmentBase!).toBeLessThan(1000);
    expect(result.net).toBeGreaterThan(800);
    expect(result.net).toBeLessThan(900);
  });

  it('classifies €556 as minijob boundary', () => {
    const result = payrollEngine.inferAndCalculate('a', 'applicant', 556, 1, false, params);
    expect(result.employmentType).toBe('minijob');
  });

  it('classifies €557 as midijob', () => {
    const result = payrollEngine.inferAndCalculate('a', 'applicant', 557, 1, false, params);
    expect(result.employmentType).toBe('midijob');
  });
});

describe('Bürgergeld Freibeträge', () => {
  it('applies §11b tiers for €800 gross employment', () => {
    const fixture = (buergergeldFixtures as BuergergeldFixture[]).find((f) => f.id === 'freibetrag-800-gross')!;
    const freibetrag = calculateEmploymentFreibetrag(fixture.input.grossEmploymentIncome as number, params);
    expect(freibetrag).toBeGreaterThanOrEqual(fixture.expected.freibetragMin);
    expect(freibetrag).toBeLessThanOrEqual(fixture.expected.freibetragMax);
    const countable = (fixture.input.grossEmploymentIncome as number) - freibetrag;
    expect(countable).toBeLessThanOrEqual(fixture.expected.countableMax);
  });
});

describe('Regelbedarf', () => {
  it('uses tiered rates for couple with child', () => {
    const household = buildHouseholdFromLegacy(3, 'married', 1000, 1, false);
    const regelbedarf = calculateRegelbedarf(household.members, params);
    expect(regelbedarf).toBeGreaterThan(1400);
    expect(regelbedarf).toBeLessThan(1500);
  });
});
