import type {
  MutationEvent,
  ProfileDomain,
  ProfileMirrorDomainSlug,
  UserContextV1,
  UserProfileViewV1,
} from '@arrival-atlas/product-contract';

export type ExecutionInsightRecord = {
  moduleId: string;
  createdAt: string;
  moduleTitle?: string;
};

export type ExecutionMetadata = {
  executionsByModuleId: Record<string, ExecutionInsightRecord[]>;
};

export type InterpretProfileInsightsInput = {
  userContext: UserContextV1;
  mutationEvents?: readonly MutationEvent[];
  executionMeta?: ExecutionMetadata;
  generatedAt?: string;
};

export type MirrorSectionDefinition = {
  mirrorSlug: ProfileMirrorDomainSlug;
  primaryDomain: ProfileDomain;
  domains: ProfileDomain[];
  moduleIds: string[];
  ctaModuleId?: string;
};

export const MIRROR_SECTIONS: MirrorSectionDefinition[] = [
  {
    mirrorSlug: 'move-to-germany',
    primaryDomain: 'migration',
    domains: ['migration'],
    moduleIds: ['financial-reality', 'life-event'],
    ctaModuleId: 'financial-reality',
  },
  {
    mirrorSlug: 'where-you-live',
    primaryDomain: 'housing',
    domains: ['housing'],
    moduleIds: ['financial-reality', 'benefits-simulator'],
    ctaModuleId: 'financial-reality',
  },
  {
    mirrorSlug: 'household-family',
    primaryDomain: 'household',
    domains: ['household'],
    moduleIds: ['financial-reality', 'benefits-simulator'],
    ctaModuleId: 'benefits-simulator',
  },
  {
    mirrorSlug: 'work-income',
    primaryDomain: 'employment',
    domains: ['employment', 'income'],
    moduleIds: ['financial-reality'],
    ctaModuleId: 'financial-reality',
  },
  {
    mirrorSlug: 'health-insurance',
    primaryDomain: 'healthInsurance',
    domains: ['healthInsurance'],
    moduleIds: ['healthcare-navigation'],
    ctaModuleId: 'healthcare-navigation',
  },
  {
    mirrorSlug: 'benefits-support',
    primaryDomain: 'benefits',
    domains: ['benefits'],
    moduleIds: ['benefits-simulator', 'financial-reality'],
    ctaModuleId: 'benefits-simulator',
  },
  {
    mirrorSlug: 'language-display',
    primaryDomain: 'preferences',
    domains: ['preferences'],
    moduleIds: [],
  },
];

export function profileHasDomainData(
  profile: UserProfileViewV1 | null | undefined,
  domain: ProfileDomain
): boolean {
  if (!profile) {
    return false;
  }

  if (domain === 'preferences') {
    return Boolean(profile.preferences?.preferredLanguage);
  }

  const slice = profile.domains[domain as keyof UserProfileViewV1['domains']];
  if (!slice || typeof slice !== 'object') {
    return false;
  }

  return Object.values(slice).some((value) => value !== undefined && value !== null);
}

export function sectionHasData(
  profile: UserProfileViewV1 | null | undefined,
  section: MirrorSectionDefinition
): boolean {
  return section.domains.some((domain) => profileHasDomainData(profile, domain));
}

export function findMirrorSection(slug: ProfileMirrorDomainSlug): MirrorSectionDefinition {
  const section = MIRROR_SECTIONS.find((entry) => entry.mirrorSlug === slug);
  if (!section) {
    throw new Error(`Unknown mirror slug: ${slug}`);
  }
  return section;
}

export function domainToMirrorSlug(domain: ProfileDomain): ProfileMirrorDomainSlug | undefined {
  if (domain === 'employment' || domain === 'income') {
    return 'work-income';
  }

  const match = MIRROR_SECTIONS.find((section) => section.primaryDomain === domain);
  return match?.mirrorSlug;
}
