import type { ProfileDocument } from '../types/profile-document.js';
import type { Employment } from '@arrivalos/shared-services';
import { buildHouseholdFromLegacy, resolveEmploymentsForLegacyInput } from '@arrivalos/shared-services';

/**
 * Merge profile-derived defaults into benefits-simulator request input.
 * Called from mergeModuleInput — module never reads profile directly.
 */
export function mergeBenefitsSimulatorInputFromProfile(
  requestInput: Record<string, unknown>,
  profile: ProfileDocument | null
): Record<string, unknown> {
  if (!profile || requestInput.household) {
    return requestInput;
  }

  const householdSize = profile.household?.size ?? 1;
  const maritalStatus = profile.household?.maritalStatus ?? 'single';
  const monthlyRent = profile.housing?.monthlyColdRent ?? 0;
  const taxClass = profile.employment?.taxClass ?? 1;
  const churchTax = profile.employment?.churchTax ?? false;
  const grossIncome = profile.employment?.grossMonthlyIncome ?? 0;
  const employmentStatus = profile.employment?.status ?? 'unemployed';

  const household = buildHouseholdFromLegacy(
    householdSize,
    maritalStatus,
    monthlyRent,
    taxClass,
    churchTax
  );

  if (profile.location?.bundesland) {
    household.housing.bundesland = profile.location.bundesland;
  }

  if (profile.household?.children?.length) {
    const adults = maritalStatus === 'married' ? 2 : 1;
    household.members = household.members.filter((m) => m.role !== 'child');
    profile.household.children.forEach((child, index) => {
      household.members.push({
        id: `child-${index + 1}`,
        role: 'child',
        age: child.age,
      });
    });
    const childSlots = Math.max(0, householdSize - adults);
    if (profile.household.children.length < childSlots) {
      for (let i = profile.household.children.length; i < childSlots; i++) {
        household.members.push({
          id: `child-${i + 1}`,
          role: 'child',
          age: 8,
        });
      }
    }
  }

  household.housing.utilities = profile.housing?.monthlyUtilities ?? 0;
  household.currentBenefits = {
    receivingBuergergeld: profile.benefits?.receivingBuergergeld,
    receivingAlg1: profile.benefits?.receivingAlg1,
  };

  const { employments } = resolveEmploymentsForLegacyInput(
    household,
    employmentStatus === 'unemployed' ? 0 : grossIncome,
    taxClass,
    churchTax,
    employmentStatus === 'part-time' ? 'employed' : employmentStatus
  );

  return {
    taxYear: 2025,
    ...requestInput,
    household,
    baselineEmployments: requestInput.baselineEmployments ?? employments,
    scenarios: requestInput.scenarios ?? [],
  };
}

export function ensureBenefitsSimulatorEmployments(
  merged: Record<string, unknown>
): Record<string, unknown> {
  const household = merged.household as { members?: Array<{ id: string }> } | undefined;
  const employments = merged.baselineEmployments as Record<string, Employment> | undefined;

  if (!household?.members || employments) {
    return merged;
  }

  const defaults: Record<string, Employment> = {};
  for (const member of household.members) {
    defaults[member.id] = { type: 'none' };
  }

  return {
    ...merged,
    baselineEmployments: defaults,
  };
}
