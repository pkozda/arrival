import type { AppContext } from '@arrivalos/core';

export interface FinancialProfileContext {
  hasHealthInsurance: boolean;
  daysInGermany: number | undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function pickInsurance(
  profileSlice: Record<string, unknown> | undefined,
  mergedInput: Record<string, unknown>
): Record<string, unknown> | undefined {
  return asRecord(profileSlice?.insurance) ?? asRecord(mergedInput.insurance);
}

function pickBenefits(
  profileSlice: Record<string, unknown> | undefined,
  mergedInput: Record<string, unknown>
): Record<string, unknown> | undefined {
  return asRecord(profileSlice?.benefits) ?? asRecord(mergedInput.benefits);
}

function resolveHasCoverage(insurance: Record<string, unknown> | undefined): boolean {
  if (insurance === undefined) {
    return false;
  }
  return typeof insurance.hasCoverage === 'boolean' ? insurance.hasCoverage : false;
}

function resolveDaysInGermany(benefits: Record<string, unknown> | undefined): number | undefined {
  if (benefits === undefined) {
    return undefined;
  }
  const days = benefits.daysInGermany;
  return typeof days === 'number' ? days : undefined;
}

function warnMissingProfileContext(context: AppContext, profileSlice: Record<string, unknown> | undefined): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  console.warn('[FinancialReality] Missing insurance/benefits in profile context', {
    profileId: context.profileId,
    availableKeys: Object.keys(profileSlice ?? {}),
  });
}

/**
 * Resolve insurance/benefits for admin rules from Profile Engine outputs.
 *
 * Resolution order:
 * 1. context.profileSlice.insurance / benefits
 * 2. merged module input insurance / benefits
 * 3. Neutral defaults — hasCoverage: false, daysInGermany: undefined
 */
export function resolveFinancialProfileContext(
  context: AppContext,
  mergedInput: Record<string, unknown>
): FinancialProfileContext {
  const profileSlice = asRecord(context.profileSlice);
  const insurance = pickInsurance(profileSlice, mergedInput);
  const benefits = pickBenefits(profileSlice, mergedInput);

  if (insurance === undefined || benefits === undefined) {
    warnMissingProfileContext(context, profileSlice);
  }

  return {
    hasHealthInsurance: resolveHasCoverage(insurance),
    daysInGermany: resolveDaysInGermany(benefits),
  };
}
