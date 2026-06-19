import type {
  MergeModuleInputParams,
  MergeModuleInputResult,
  ModuleMergeStrategy,
  ProfileDocument,
} from '@arrival-atlas/profile';
import type { Employment } from '@arrival-atlas/shared-services';
import {
  buildHouseholdFromLegacy,
  resolveEmploymentsForLegacyInput,
} from '@arrival-atlas/shared-services';

function mergeBenefitsSimulatorInputFromProfile(
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

function ensureBenefitsSimulatorEmployments(
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

export const benefitsSimulatorMergeStrategy: ModuleMergeStrategy = {
  moduleId: 'benefits-simulator',

  merge(params: MergeModuleInputParams): MergeModuleInputResult {
    const requestInput = params.requestInput ?? {};
    const requestOverrides = params.requestOverrides ?? {};
    const profile = params.profile ?? null;

    const profileMerged = mergeBenefitsSimulatorInputFromProfile(requestInput, profile);
    const merged = ensureBenefitsSimulatorEmployments({
      ...profileMerged,
      ...requestOverrides,
    });
    const provenance: MergeModuleInputResult['provenance'] = [];

    if (profile && !requestInput.household && merged.household) {
      provenance.push({ field: 'household', source: 'profile' });
    }
    if (profile && !requestInput.baselineEmployments && merged.baselineEmployments) {
      provenance.push({ field: 'baselineEmployments', source: 'profile' });
    }
    for (const [field, value] of Object.entries(requestInput)) {
      if (value !== undefined) {
        provenance.push({ field, source: 'input' });
      }
    }

    return { merged, provenance };
  },
};
