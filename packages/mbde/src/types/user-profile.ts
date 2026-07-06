import { z } from 'zod';

export const MbdePersonSchema = z.object({
  id: z.string(),
  role: z.enum(['primary', 'partner', 'child', 'dependent']),
  age: z.number().int().min(0).optional(),
  employmentStatus: z.string().optional(),
  disabilityDegree: z.number().int().min(0).max(100).optional(),
});

export type MbdePerson = z.infer<typeof MbdePersonSchema>;

export const MbdeLocationSchema = z.object({
  country: z.string().default('DE'),
  state: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  postalCode: z.string().optional(),
});

export type MbdeLocation = z.infer<typeof MbdeLocationSchema>;

export const MbdeUserProfileSchema = z.object({
  household: z.array(MbdePersonSchema).default([]),
  location: MbdeLocationSchema,
  legalStatus: z
    .object({
      visaType: z.string().optional(),
      residenceYears: z.number().min(0).optional(),
      euCitizen: z.boolean().optional(),
    })
    .default({}),
  financial: z
    .object({
      grossMonthlyIncome: z.number().min(0).optional(),
      netMonthlyIncome: z.number().min(0).optional(),
      savings: z.number().min(0).optional(),
      benefitsAlreadyReceiving: z.array(z.string()).default([]),
      taxClass: z.number().int().min(1).max(6).optional(),
    })
    .default({ benefitsAlreadyReceiving: [] }),
  health: z
    .object({
      chronicConditions: z.array(z.string()).default([]),
      mobilityLimitations: z.string().optional(),
      insuranceType: z.string().optional(),
      disabilityDegree: z.number().int().min(0).max(100).optional(),
    })
    .default({ chronicConditions: [] }),
  housing: z
    .object({
      type: z.enum(['rented', 'owned', 'temporary', 'unknown']).default('unknown'),
      monthlyRent: z.number().min(0).optional(),
      householdSize: z.number().int().min(1).optional(),
    })
    .default({ type: 'unknown' }),
  education: z
    .object({
      languageLevel: z.string().optional(),
      courses: z.array(z.string()).default([]),
      studentStatus: z.boolean().optional(),
    })
    .default({ courses: [] }),
  employment: z
    .object({
      status: z.string().optional(),
      hoursPerWeek: z.number().min(0).optional(),
      minijob: z.boolean().optional(),
    })
    .default({}),
});

export type MbdeUserProfile = z.infer<typeof MbdeUserProfileSchema>;

/** Flattened evaluation context for rule engine field paths. */
export function flattenMbdeProfile(profile: MbdeUserProfile): Record<string, unknown> {
  const primary = profile.household.find((p) => p.role === 'primary') ?? profile.household[0];

  return {
    'location.country': profile.location.country,
    'location.state': profile.location.state,
    'location.city': profile.location.city,
    'location.district': profile.location.district,
    'location.postalCode': profile.location.postalCode,
    'legalStatus.visaType': profile.legalStatus.visaType,
    'legalStatus.residenceYears': profile.legalStatus.residenceYears,
    'legalStatus.euCitizen': profile.legalStatus.euCitizen,
    'financial.grossMonthlyIncome': profile.financial.grossMonthlyIncome,
    'financial.netMonthlyIncome': profile.financial.netMonthlyIncome,
    'financial.savings': profile.financial.savings,
    'financial.benefitsAlreadyReceiving': profile.financial.benefitsAlreadyReceiving,
    'financial.taxClass': profile.financial.taxClass,
    'health.chronicConditions': profile.health.chronicConditions,
    'health.mobilityLimitations': profile.health.mobilityLimitations,
    'health.insuranceType': profile.health.insuranceType,
    'health.disabilityDegree': profile.health.disabilityDegree ?? primary?.disabilityDegree,
    'housing.type': profile.housing.type,
    'housing.monthlyRent': profile.housing.monthlyRent,
    'housing.householdSize': profile.housing.householdSize ?? (profile.household.length || 1),
    'education.languageLevel': profile.education.languageLevel,
    'education.courses': profile.education.courses,
    'education.studentStatus': profile.education.studentStatus,
    'employment.status': profile.employment.status,
    'employment.hoursPerWeek': profile.employment.hoursPerWeek,
    'employment.minijob': profile.employment.minijob,
    householdSize: profile.housing.householdSize ?? (profile.household.length || 1),
    hasChildren: profile.household.some((p) => p.role === 'child'),
    childCount: profile.household.filter((p) => p.role === 'child').length,
  };
}
