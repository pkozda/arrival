import type { ProfileInsightViewV1 } from '@/lib/product-contract';
import type {
  ProfileMirrorDomain,
  ProfileMirrorDomainSlug,
} from '@/lib/profile-mirror-utils';
import type {
  CertaintyExpectedOutcome,
  CertaintyLevel,
  CertaintyReason,
  CertaintyState,
} from '../types';
import type { CertaintySurfaceBundle } from '../types-bundle';

const PROFILE_LOCATION = 'Profile';
const PROFILE_SITUATION_TITLE = 'Your situation';
const PROFILE_COMPLETENESS_TARGET = 'Profile completeness';
const ELIGIBILITY_ASSESSMENT_TARGET = 'Eligibility assessment';

const PROFILE_ACTION_LABELS: Partial<Record<ProfileMirrorDomainSlug, string>> = {
  'move-to-germany': 'Add your arrival details',
  'where-you-live': 'Add your housing details',
  'household-family': 'Complete your family information',
  'work-income': 'Add your work and income details',
  'health-insurance': 'Add your health insurance details',
  'benefits-support': 'Add your benefits information',
  'language-display': 'Set your preferred language',
};

export type BuildProfileCertaintyInput = {
  domains: ProfileMirrorDomain[];
  primaryFocusSlug: ProfileMirrorDomainSlug | null;
  selectedDomainSlug?: ProfileMirrorDomainSlug | null;
  dependencySourceSlugs?: ProfileMirrorDomainSlug[];
  profileInsights?: ProfileInsightViewV1 | null;
};

function domainBySlug(
  domains: ProfileMirrorDomain[],
  slug: ProfileMirrorDomainSlug | null | undefined
): ProfileMirrorDomain | undefined {
  if (!slug) {
    return undefined;
  }
  return domains.find((domain) => domain.slug === slug);
}

function countProfileProgress(domains: ProfileMirrorDomain[]): { completed: number; total: number } {
  const total = domains.length;
  const completed = domains.filter((domain) => domain.status === 'complete').length;
  return { completed, total };
}

function isProfileComplete(domains: ProfileMirrorDomain[]): boolean {
  return domains.length > 0 && domains.every((domain) => domain.status === 'complete');
}

function actionLabelForDomain(domain: ProfileMirrorDomain): string {
  return PROFILE_ACTION_LABELS[domain.slug] ?? domain.title;
}

function mapInsightConfidence(level: ProfileInsightViewV1['globalConfidence'] | undefined): CertaintyLevel {
  switch (level) {
    case 'high':
      return 'clear';
    case 'medium':
    case 'low':
      return 'needs_attention';
    default:
      return 'unknown';
  }
}

function resolveProfileConfidence(input: {
  domains: ProfileMirrorDomain[];
  focusDomain?: ProfileMirrorDomain;
  selectedDomain?: ProfileMirrorDomain;
  hasDependencyBlock: boolean;
  profileInsights?: ProfileInsightViewV1 | null;
}): CertaintyLevel {
  if (isProfileComplete(input.domains)) {
    return 'clear';
  }

  if (input.hasDependencyBlock) {
    return 'blocked';
  }

  const focusStatus = input.focusDomain?.status;
  if (focusStatus === 'needs_attention') {
    return 'needs_attention';
  }

  if (focusStatus === 'not_added' || focusStatus === 'complete') {
    return input.profileInsights ? mapInsightConfidence(input.profileInsights.globalConfidence) : 'needs_attention';
  }

  return 'unknown';
}

function nextDomainAfterFocus(
  domains: ProfileMirrorDomain[],
  focusSlug: ProfileMirrorDomainSlug
): ProfileMirrorDomain | undefined {
  const focusIndex = domains.findIndex((domain) => domain.slug === focusSlug);
  if (focusIndex < 0) {
    return undefined;
  }

  return domains.slice(focusIndex + 1).find((domain) => domain.status !== 'complete');
}

function buildProfileReason(input: {
  focusDomain: ProfileMirrorDomain;
  selectedDomain?: ProfileMirrorDomain;
  dependencySourceSlugs: ProfileMirrorDomainSlug[];
  domains: ProfileMirrorDomain[];
  profileInsights?: ProfileInsightViewV1 | null;
}): CertaintyReason {
  const prerequisiteSlug = input.dependencySourceSlugs[0];
  const prerequisite = domainBySlug(input.domains, prerequisiteSlug);
  const blockedTarget = input.selectedDomain ?? input.focusDomain;

  if (prerequisite && blockedTarget && prerequisite.slug !== blockedTarget.slug) {
    return {
      type: 'dependency',
      prerequisite: prerequisite.title,
      target: blockedTarget.title,
    };
  }

  const hint = input.profileInsights?.missingContext.find(
    (entry) => entry.mirrorSlug === input.focusDomain.slug
  );
  if (hint?.message) {
    return { type: 'description', description: hint.message };
  }

  return { type: 'progress', target: input.focusDomain.title };
}

function buildProfileExpectedOutcome(input: {
  focusDomain: ProfileMirrorDomain;
  selectedDomain?: ProfileMirrorDomain;
  dependencySourceSlugs: ProfileMirrorDomainSlug[];
  domains: ProfileMirrorDomain[];
}): CertaintyExpectedOutcome | undefined {
  if (input.dependencySourceSlugs.length > 0) {
    const unlockTarget = input.selectedDomain?.title ?? ELIGIBILITY_ASSESSMENT_TARGET;
    return { type: 'unlock', target: unlockTarget };
  }

  const nextDomain = nextDomainAfterFocus(input.domains, input.focusDomain.slug);
  if (nextDomain) {
    return { type: 'openPath', target: nextDomain.title };
  }

  return { type: 'unlock', target: PROFILE_COMPLETENESS_TARGET };
}

export function buildProfileCertaintyState(input: BuildProfileCertaintyInput): CertaintyState {
  const { domains, primaryFocusSlug, selectedDomainSlug, dependencySourceSlugs = [], profileInsights } =
    input;

  const progress = countProfileProgress(domains);
  const selectedDomain = domainBySlug(domains, selectedDomainSlug ?? null);
  const focusDomain =
    selectedDomain ??
    domainBySlug(domains, primaryFocusSlug) ??
    domains.find((domain) => domain.status !== 'complete');

  const title = focusDomain?.title ?? PROFILE_SITUATION_TITLE;
  const hasDependencyBlock = dependencySourceSlugs.length > 0;
  const confidence = resolveProfileConfidence({
    domains,
    focusDomain,
    selectedDomain,
    hasDependencyBlock,
    profileInsights,
  });

  if (isProfileComplete(domains)) {
    return {
      location: PROFILE_LOCATION,
      title: PROFILE_SITUATION_TITLE,
      progress,
      confidence: 'clear',
    };
  }

  if (!focusDomain || focusDomain.status === 'complete') {
    return {
      location: PROFILE_LOCATION,
      title,
      progress,
      confidence,
    };
  }

  const reason = buildProfileReason({
    focusDomain,
    selectedDomain,
    dependencySourceSlugs,
    domains,
    profileInsights,
  });

  return {
    location: PROFILE_LOCATION,
    title,
    nextAction: {
      label: actionLabelForDomain(focusDomain),
      reason,
      expectedOutcome: buildProfileExpectedOutcome({
        focusDomain,
        selectedDomain,
        dependencySourceSlugs,
        domains,
      }),
    },
    progress,
    confidence,
  };
}

function resolveProfileRecommendedFocusId(
  input: BuildProfileCertaintyInput,
  state: CertaintyState
): string | null {
  if (!state.nextAction) {
    return null;
  }

  if (input.dependencySourceSlugs?.[0]) {
    return input.dependencySourceSlugs[0]!;
  }

  if (input.selectedDomainSlug) {
    return input.selectedDomainSlug;
  }

  return input.primaryFocusSlug;
}

export type ProfileCertaintyBundle = CertaintySurfaceBundle;

export function buildProfileCertaintyBundle(input: BuildProfileCertaintyInput): ProfileCertaintyBundle {
  const state = buildProfileCertaintyState(input);

  return {
    state,
    recommendedFocusId: resolveProfileRecommendedFocusId(input, state),
    meta: {
      primaryFocusSlug: input.primaryFocusSlug,
      selectedDomainSlug: input.selectedDomainSlug ?? null,
    },
  };
}
