import type { UserProfileViewV1 } from '@arrival-atlas/product-contract';
import type { MbdeUserProfile } from '../types/user-profile.js';
import { MbdeUserProfileSchema } from '../types/user-profile.js';

export function adaptUserProfileView(profile: UserProfileViewV1 | null | undefined): MbdeUserProfile {
  if (!profile) {
    return MbdeUserProfileSchema.parse({
      location: { country: 'DE' },
    });
  }

  const { domains } = profile;
  const children = domains.household?.children ?? [];

  const household = [
    {
      id: 'primary',
      role: 'primary' as const,
      employmentStatus: domains.employment?.employmentStatus,
    },
    ...children.map((child, index) => ({
      id: `child-${index}`,
      role: 'child' as const,
      age: child.age,
    })),
  ];

  const benefitsAlreadyReceiving: string[] = [];
  if (domains.benefits?.receivingBuergergeld) {
    benefitsAlreadyReceiving.push('de_federal_buergergeld', 'buergergeld');
  }
  if (domains.benefits?.receivingAlg1) {
    benefitsAlreadyReceiving.push('alg1');
  }
  if (domains.benefits?.receivingWohngeld) {
    benefitsAlreadyReceiving.push('de_federal_wohngeld', 'wohngeld');
  }
  if (domains.benefits?.receivingKindergeld) {
    benefitsAlreadyReceiving.push('de_federal_kindergeld', 'kindergeld');
  }
  if (domains.benefits?.receivingSozialamtSupport) {
    benefitsAlreadyReceiving.push('sozialamt');
  }

  // Income domain is the authoritative projection for gross monthly income.
  const grossMonthlyIncome = domains.income?.grossMonthlyIncome;

  return MbdeUserProfileSchema.parse({
    household,
    location: {
      country: 'DE',
      state: domains.housing?.bundesland,
      city: domains.housing?.city,
    },
    legalStatus: {
      visaType: domains.migration?.residencyStatus,
      residenceYears: domains.benefits?.daysInGermany
        ? Math.floor(domains.benefits.daysInGermany / 365)
        : undefined,
    },
    financial: {
      grossMonthlyIncome,
      benefitsAlreadyReceiving,
      taxClass: domains.employment?.taxClass
        ? Number(domains.employment.taxClass)
        : undefined,
    },
    health: {
      insuranceType: domains.healthInsurance?.insuranceType,
    },
    housing: {
      type: domains.housing?.monthlyColdRent ? 'rented' : 'unknown',
      monthlyRent: domains.housing?.monthlyColdRent,
      householdSize: domains.household?.householdSize,
    },
    education: {
      studentStatus: domains.employment?.employmentStatus === 'student',
    },
    employment: {
      status: domains.employment?.employmentStatus,
      minijob: domains.employment?.employmentStatus === 'part-time',
    },
  });
}

export function profileCompletenessScore(profile: MbdeUserProfile): number {
  const checks = [
    profile.location.state,
    profile.location.city,
    profile.financial.netMonthlyIncome ?? profile.financial.grossMonthlyIncome,
    profile.housing.type !== 'unknown',
    profile.employment.status,
    profile.health.insuranceType,
    profile.legalStatus.visaType,
  ];

  const filled = checks.filter((value) => value !== undefined && value !== null && value !== '').length;
  return Math.round((filled / checks.length) * 100);
}
