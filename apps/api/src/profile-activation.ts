import {
  EmploymentStatusSchema,
  InsuranceTypeSchema,
  MaritalStatusSchema,
  ProfilePatchSchema,
  type ProfilePatch,
} from '@arrival-atlas/profile';

function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

function patchHasContent(patch: ProfilePatch): boolean {
  return Object.keys(patch).length > 0;
}

/**
 * Maps module request input → ProfileDocument patch.
 * Only fields explicitly present in request input are written.
 */
export function moduleInputToProfilePatch(
  moduleId: string,
  input: Record<string, unknown>
): ProfilePatch | null {
  switch (moduleId) {
    case 'financial-reality':
      return mapFinancialRealityInput(input);
    case 'healthcare-navigation':
      return mapHealthcareNavigationInput(input);
    default:
      return null;
  }
}

function mapFinancialRealityInput(input: Record<string, unknown>): ProfilePatch | null {
  const patch: ProfilePatch = {};

  if (isPresent(input.grossIncome)) {
    patch.employment = {
      ...patch.employment,
      grossMonthlyIncome: Number(input.grossIncome),
    };
  }

  if (isPresent(input.employmentStatus)) {
    const status = EmploymentStatusSchema.safeParse(input.employmentStatus);
    if (status.success) {
      patch.employment = { ...patch.employment, status: status.data };
    }
  }

  if (isPresent(input.maritalStatus)) {
    const maritalStatus = MaritalStatusSchema.safeParse(input.maritalStatus);
    if (maritalStatus.success) {
      patch.household = { ...patch.household, maritalStatus: maritalStatus.data };
    }
  }

  if (isPresent(input.monthlyRent)) {
    patch.housing = {
      ...patch.housing,
      monthlyColdRent: Number(input.monthlyRent),
    };
  }

  if (isPresent(input.householdSize)) {
    patch.household = {
      ...patch.household,
      size: Number(input.householdSize),
    };
  }

  if (!patchHasContent(patch)) {
    return null;
  }

  return ProfilePatchSchema.parse(patch);
}

function mapHealthcareNavigationInput(input: Record<string, unknown>): ProfilePatch | null {
  const patch: ProfilePatch = {};

  if (input.hasInsurance !== undefined && input.hasInsurance !== null) {
    patch.insurance = {
      ...patch.insurance,
      hasCoverage: Boolean(input.hasInsurance),
    };
  }

  if (isPresent(input.insuranceType)) {
    const type = InsuranceTypeSchema.safeParse(input.insuranceType);
    if (type.success) {
      patch.insurance = { ...patch.insurance, type: type.data };
    };
  }

  if (!patchHasContent(patch)) {
    return null;
  }

  return ProfilePatchSchema.parse(patch);
}
