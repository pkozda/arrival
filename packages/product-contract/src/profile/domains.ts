import { z } from 'zod';

/** Canonical profile domain partition — single source of truth for product-contract. */
export const PROFILE_DOMAINS = [
  'migration',
  'housing',
  'household',
  'employment',
  'income',
  'healthInsurance',
  'benefits',
  'preferences',
] as const;

export const ProfileDomainSchema = z.enum(PROFILE_DOMAINS);

export type ProfileDomain = z.infer<typeof ProfileDomainSchema>;

export type ProfileDomainRegistryEntry = {
  domain: ProfileDomain;
  /** Human-facing label key for i18n */
  labelKey: string;
  /** Whether domain supports fact mutations */
  supportsFactMutations: boolean;
};

export const PROFILE_DOMAIN_REGISTRY: Readonly<Record<ProfileDomain, ProfileDomainRegistryEntry>> = {
  migration: {
    domain: 'migration',
    labelKey: 'profile.domain.migration',
    supportsFactMutations: true,
  },
  housing: {
    domain: 'housing',
    labelKey: 'profile.domain.housing',
    supportsFactMutations: true,
  },
  household: {
    domain: 'household',
    labelKey: 'profile.domain.household',
    supportsFactMutations: true,
  },
  employment: {
    domain: 'employment',
    labelKey: 'profile.domain.employment',
    supportsFactMutations: true,
  },
  income: {
    domain: 'income',
    labelKey: 'profile.domain.income',
    supportsFactMutations: true,
  },
  healthInsurance: {
    domain: 'healthInsurance',
    labelKey: 'profile.domain.healthInsurance',
    supportsFactMutations: true,
  },
  benefits: {
    domain: 'benefits',
    labelKey: 'profile.domain.benefits',
    supportsFactMutations: true,
  },
  preferences: {
    domain: 'preferences',
    labelKey: 'profile.domain.preferences',
    supportsFactMutations: false,
  },
};

export function isProfileDomain(value: unknown): value is ProfileDomain {
  return ProfileDomainSchema.safeParse(value).success;
}
