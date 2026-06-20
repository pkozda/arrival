import type {
  AdvisorySuggestion,
  MissingContextHint,
  ProfileDomain,
  UserProfileViewV1,
} from '@arrival-atlas/product-contract';
import type { MirrorSectionDefinition } from './types.js';
import { domainToMirrorSlug, profileHasDomainData } from './types.js';

const DOMAIN_HINTS: Partial<
  Record<
    ProfileDomain,
    { message: string; ctaModuleId?: string; priority: number }
  >
> = {
  income: {
    message: 'Income information is missing — this affects benefits and tax estimates.',
    ctaModuleId: 'financial-reality',
    priority: 1,
  },
  employment: {
    message: 'Employment details are missing — some tools need this to give accurate guidance.',
    ctaModuleId: 'financial-reality',
    priority: 2,
  },
  housing: {
    message: 'Housing information is missing — rent details help with benefits estimates.',
    ctaModuleId: 'financial-reality',
    priority: 3,
  },
  healthInsurance: {
    message: 'Health insurance information is missing — coverage rules depend on this.',
    ctaModuleId: 'healthcare-navigation',
    priority: 4,
  },
  benefits: {
    message: 'Benefits information is missing — simulators need this for estimates.',
    ctaModuleId: 'benefits-simulator',
    priority: 5,
  },
  migration: {
    message: 'Arrival details are missing — residency status helps tailor guidance.',
    ctaModuleId: 'financial-reality',
    priority: 6,
  },
  household: {
    message: 'Household details are missing — family size affects benefit calculations.',
    ctaModuleId: 'benefits-simulator',
    priority: 7,
  },
};

const MAX_HINTS = 3;

function buildHintHref(mirrorSlug: string | undefined, ctaModuleId?: string): string {
  if (mirrorSlug) {
    return `/profile/${mirrorSlug}/edit`;
  }
  if (ctaModuleId) {
    return `/modules/${ctaModuleId}`;
  }
  return '/profile';
}

export function buildMissingContextHints(
  profile: UserProfileViewV1 | null | undefined
): MissingContextHint[] {
  const hints: Array<MissingContextHint & { priority: number }> = [];

  const missingDomains = profile?.completeness.missingDomains ?? [];

  for (const domain of missingDomains) {
    const config = DOMAIN_HINTS[domain];
    const mirrorSlug = domainToMirrorSlug(domain);
    hints.push({
      domain,
      mirrorSlug,
      message: config?.message ?? `Information about ${domain} is missing.`,
      suggestedAction: mirrorSlug ? 'correct_in_profile' : 'open_module',
      ctaModuleId: config?.ctaModuleId,
      href: buildHintHref(mirrorSlug, config?.ctaModuleId),
      priority: config?.priority ?? 99,
    });
  }

  if (profile && profileHasDomainData(profile, 'employment') && !profileHasDomainData(profile, 'income')) {
    hints.push({
      domain: 'income',
      mirrorSlug: 'work-income',
      message: 'Employment is saved but monthly income is missing.',
      suggestedAction: 'correct_in_profile',
      ctaModuleId: 'financial-reality',
      href: '/profile/work-income/edit',
      priority: 0,
    });
  }

  return hints
    .sort((left, right) => left.priority - right.priority)
    .slice(0, MAX_HINTS)
    .map(({ priority: _priority, ...hint }) => hint);
}

export function buildAdvisorySuggestions(
  section: MirrorSectionDefinition,
  hasData: boolean,
  confidenceLevel: string
): AdvisorySuggestion[] {
  const suggestions: AdvisorySuggestion[] = [];

  if (!hasData && section.ctaModuleId) {
    suggestions.push({
      message: 'This section is incomplete — you can add information manually or use a tool.',
      action: 'correct_in_profile',
      href: `/profile/${section.mirrorSlug}/edit`,
    });
    return suggestions;
  }

  if (confidenceLevel === 'low' && hasData) {
    suggestions.push({
      message: 'You might want to review this section and update anything that changed.',
      action: 'correct_in_profile',
      href: `/profile/${section.mirrorSlug}/edit`,
    });
  }

  return suggestions;
}

export function buildCompletenessSummary(profile: UserProfileViewV1 | null | undefined): string | null {
  if (!profile) {
    return null;
  }

  if (profile.completeness.score >= 70 && profile.completeness.missingDomains.length <= 1) {
    return 'Your situation is mostly complete.';
  }

  return null;
}
