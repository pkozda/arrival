import type { UserProfileViewV1 } from '@/lib/product-contract';
import { mergeProfileIntoDefaults } from '@/lib/product-contract';

/**
 * Maps UserProfileViewV1 domain fields to module input keys for schema prefill.
 * Keeps module forms decoupled from ProfileDocument shape.
 */
export function userProfileToModulePrefill(
  profile: UserProfileViewV1 | null | undefined
): Record<string, unknown> | null {
  if (!profile) {
    return null;
  }

  const { domains, preferences } = profile;

  return {
    grossIncome: domains.income?.grossMonthlyIncome,
    employmentStatus: domains.employment?.employmentStatus,
    taxClass: domains.employment?.taxClass,
    churchTax: domains.employment?.churchTax,
    maritalStatus: domains.household?.maritalStatus,
    householdSize: domains.household?.householdSize,
    monthlyRent: domains.housing?.monthlyColdRent,
    monthlyUtilities: domains.housing?.monthlyUtilities,
    city: domains.housing?.city,
    bundesland: domains.housing?.bundesland,
    hasInsurance: domains.healthInsurance?.hasCoverage,
    insuranceType: domains.healthInsurance?.insuranceType,
    countryOfOrigin: domains.migration?.countryOfOrigin,
    preferredLanguage: preferences.preferredLanguage,
  };
}

export function mergeUserProfileIntoDefaults(
  defaults: Record<string, unknown>,
  profile: UserProfileViewV1 | null | undefined
): Record<string, unknown> {
  return mergeProfileIntoDefaults(defaults, userProfileToModulePrefill(profile));
}
