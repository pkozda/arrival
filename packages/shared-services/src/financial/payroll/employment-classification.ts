import type { FinancialParameterSet } from '../parameters/index.js';
import { getParameters } from '../parameters/index.js';
import type { Employment, TaxClass } from '../types/index.js';
import { classifyEmploymentByGross } from './social-contributions.js';

export const ROUTING_WARNING_EMPLOYMENT_INFERRED = 'EMPLOYMENT_TYPE_INFERRED_FROM_GROSS';

export type ClassifiedEmploymentType = 'minijob' | 'midijob' | 'regular';

/**
 * Infer employment type from gross monthly pay using 2025 thresholds by default.
 * ≤ minijobGrenze (€556) → minijob; above up to midijobObergrenze (€2,000) → midijob; else regular.
 */
export function inferEmploymentType(
  grossMonthly: number,
  params: FinancialParameterSet = getParameters(2025)
): ClassifiedEmploymentType {
  return classifyEmploymentByGross(grossMonthly, params);
}

export function buildApplicantEmploymentFromGross(
  grossMonthly: number,
  taxClass: TaxClass,
  churchTax: boolean,
  params: FinancialParameterSet
): Employment {
  if (grossMonthly <= 0) {
    return { type: 'none' };
  }

  const type = inferEmploymentType(grossMonthly, params);

  switch (type) {
    case 'minijob':
      return { type: 'minijob', grossMonthly, rvOptIn: false };
    case 'midijob':
      return { type: 'midijob', grossMonthly, taxClass, churchTax };
    case 'regular':
      return { type: 'regular', grossMonthly, taxClass, churchTax };
  }
}

export function legacyRoutingWarningsForGross(
  grossMonthly: number,
  params: FinancialParameterSet
): string[] {
  if (grossMonthly <= 0 || grossMonthly > params.midijobObergrenze) {
    return [];
  }
  return [ROUTING_WARNING_EMPLOYMENT_INFERRED];
}

/**
 * Guard against regressions where legacy routing forces regular for low-income bands.
 */
export function assertValidLegacyEmploymentRouting(
  employment: Employment,
  grossMonthly: number,
  params: FinancialParameterSet = getParameters(2025)
): void {
  if (
    grossMonthly <= 0 ||
    employment.type === 'none' ||
    employment.type === 'self-employed'
  ) {
    return;
  }

  const expected = inferEmploymentType(grossMonthly, params);
  if (employment.type !== expected) {
    throw new Error(
      `Invalid employment routing: legacy adapter must not force ${employment.type} classification for gross €${grossMonthly} (expected ${expected})`
    );
  }
}
