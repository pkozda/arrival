import type { SnapshotProfile } from '@/lib/api';

type DefaultsBuilder = (profile: SnapshotProfile | null) => Record<string, unknown>;

const MODULE_DEFAULT_BUILDERS: Record<string, DefaultsBuilder> = {
  'financial-reality': (profile) => ({
    grossIncome: profile?.employment?.grossMonthlyIncome ?? 2500,
    taxClass: profile?.employment?.taxClass ?? 1,
    churchTax: profile?.employment?.churchTax ?? false,
    householdSize: profile?.household?.size ?? 1,
    monthlyRent: profile?.housing?.monthlyColdRent ?? 800,
    employmentStatus: profile?.employment?.status ?? 'employed',
    maritalStatus: profile?.household?.maritalStatus ?? 'single',
  }),
  'healthcare-navigation': (profile) => ({
    situation: 'new-arrival',
    urgency: 'routine',
    insuranceType: profile?.insurance?.type ?? 'none',
    hasInsurance: profile?.insurance?.hasCoverage ?? false,
  }),
  'life-event': () => ({
    event: 'arrival',
    timeline: 'planning',
    currentStatus: {
      employed: false,
      insured: false,
      registered: false,
    },
  }),
  'grocery-optimization': (profile) => ({
    monthlyBudget: 300,
    householdSize: profile?.household?.size ?? 1,
  }),
  'system-translation': () => ({
    query: '',
    mode: 'search',
  }),
};

export function getSchemaDefaults(moduleId: string): Record<string, unknown> {
  const builder = MODULE_DEFAULT_BUILDERS[moduleId];
  return builder ? builder(null) : {};
}

export function getProfileInputDefaults(
  profile: SnapshotProfile | null,
  moduleId: string
): Record<string, unknown> {
  const builder = MODULE_DEFAULT_BUILDERS[moduleId];
  return builder ? builder(profile) : {};
}
