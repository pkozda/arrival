import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildHouseholdFromLegacy } from './household/index.js';
import {
  resolveEmploymentsForLegacyInput,
  ROUTING_WARNING_EMPLOYMENT_INFERRED,
  inferEmploymentType,
  runLegacyPipeline,
  financialPipeline,
  adaptLegacyInputToV2,
} from './index.js';
import { PARAMETERS_2025 } from './parameters/2025.js';

const params = PARAMETERS_2025;
const household = buildHouseholdFromLegacy(1, 'single', 800, 1, false);

describe('inferEmploymentType', () => {
  it('classifies €450 as minijob', () => {
    expect(inferEmploymentType(450, params)).toBe('minijob');
  });

  it('classifies €800 as midijob', () => {
    expect(inferEmploymentType(800, params)).toBe('midijob');
  });

  it('classifies €2500 as regular', () => {
    expect(inferEmploymentType(2500, params)).toBe('regular');
  });
});

describe('resolveEmploymentsForLegacyInput', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('routes €450 to minijob employment', () => {
    const { employments } = resolveEmploymentsForLegacyInput(
      household,
      450,
      1,
      false,
      'employed'
    );
    expect(employments.applicant).toMatchObject({ type: 'minijob', grossMonthly: 450 });
  });

  it('routes €800 to midijob employment', () => {
    const { employments } = resolveEmploymentsForLegacyInput(
      household,
      800,
      1,
      false,
      'employed'
    );
    expect(employments.applicant).toMatchObject({
      type: 'midijob',
      grossMonthly: 800,
      taxClass: 1,
    });
  });

  it('routes €2500 to regular employment', () => {
    const { employments } = resolveEmploymentsForLegacyInput(
      household,
      2500,
      1,
      false,
      'employed'
    );
    expect(employments.applicant).toMatchObject({
      type: 'regular',
      grossMonthly: 2500,
      taxClass: 1,
    });
  });

  it('does NOT force regular classification for low-income gross (regression)', () => {
    for (const gross of [450, 556, 600, 800, 1000, 1200]) {
      const { employments } = resolveEmploymentsForLegacyInput(
        household,
        gross,
        1,
        false,
        'employed'
      );
      expect(employments.applicant.type).not.toBe('regular');
    }
  });

  it('attaches routing warning when gross is within midijob band', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { routingWarnings } = resolveEmploymentsForLegacyInput(
      household,
      800,
      1,
      false,
      'employed'
    );
    expect(routingWarnings).toContain(ROUTING_WARNING_EMPLOYMENT_INFERRED);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('does not attach routing warning for regular employment above midijob ceiling', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { routingWarnings } = resolveEmploymentsForLegacyInput(
      household,
      2500,
      1,
      false,
      'employed'
    );
    expect(routingWarnings).toEqual([]);
  });
});

describe('legacy pipeline payroll outcomes (S07–S11)', () => {
  const baseInput = {
    taxClass: 1 as const,
    churchTax: false,
    householdSize: 1,
    monthlyRent: 700,
    employmentStatus: 'employed' as const,
    maritalStatus: 'single' as const,
  };

  it('S07: minijob €450 net equals gross', () => {
    const out = runLegacyPipeline({ ...baseInput, grossIncome: 450 });
    expect(out.income.net).toBe(450);
  });

  it('S08: minijob €556 net equals gross', () => {
    const out = runLegacyPipeline({ ...baseInput, grossIncome: 556 });
    expect(out.income.net).toBe(556);
  });

  it('S09: midijob €600 net within Gleitzone range', () => {
    const out = runLegacyPipeline({ ...baseInput, grossIncome: 600 });
    expect(out.income.net).toBeGreaterThan(480);
    expect(out.income.net).toBeLessThan(500);
  });

  it('S10: midijob €800 net within Gleitzone range', () => {
    const out = runLegacyPipeline({ ...baseInput, grossIncome: 800 });
    expect(out.income.net).toBeGreaterThan(660);
    expect(out.income.net).toBeLessThan(675);
  });

  it('S11: midijob €1000 net within Gleitzone range', () => {
    const out = runLegacyPipeline({ ...baseInput, grossIncome: 1000 });
    expect(out.income.net).toBeGreaterThan(815);
    expect(out.income.net).toBeLessThan(825);
  });
});

describe('decision safety regression (S20)', () => {
  it('unemployed → €1200 job must not produce negative gain', () => {
    const v2Input = adaptLegacyInputToV2({
      grossIncome: 0,
      taxClass: 1,
      churchTax: false,
      householdSize: 1,
      monthlyRent: 800,
      employmentStatus: 'unemployed',
      maritalStatus: 'single',
      proposedGrossIncome: 1200,
    });

    expect(v2Input.proposed?.employments.applicant.type).toBe('midijob');

    const result = financialPipeline.run(v2Input);

    expect(result.comparison?.effectiveGainFromWork).toBeGreaterThan(0);
    expect(result.verdict.effectiveGainFromWork).toBeGreaterThan(0);
    expect(result.verdict.summary).not.toMatch(/reduce total household resources/);
  });
});
