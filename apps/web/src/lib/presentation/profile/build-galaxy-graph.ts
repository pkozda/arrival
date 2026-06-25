import type { ProfileInsightViewV1, PublicModuleContract, UiSnapshot, UserProfileViewV1 } from '@/lib/product-contract';
import type { DomainInsight } from '@/lib/product-contract';
import {
  buildProfileMirrorDomains,
  buildProfileMirrorHeadline,
  isProfileMirrorDomainSlug,
  type ProfileMirrorDomain,
  type ProfileMirrorDomainSlug,
} from '@/lib/profile-mirror-utils';
import {
  layoutGalaxyGraphNodes,
  type GalaxyNodeState,
  type SpatialGraphEdge,
} from '@/lib/presentation/spatial-core';

export type ProfileGalaxyNodePayload = {
  domain: ProfileMirrorDomain;
  domainInsight?: DomainInsight;
  detailHref: string;
  editHref: string;
  moduleHref?: string;
  moduleTitle?: string;
};

const PROFILE_DOMAIN_DEPS: Partial<Record<ProfileMirrorDomainSlug, ProfileMirrorDomainSlug[]>> = {
  'benefits-support': [
    'move-to-germany',
    'where-you-live',
    'work-income',
    'household-family',
    'health-insurance',
  ],
  'work-income': ['move-to-germany'],
  'health-insurance': ['move-to-germany'],
};

type BuildInput = {
  uiSnapshot: UiSnapshot;
  modules: PublicModuleContract[];
  profile: UserProfileViewV1 | null | undefined;
  profileInsights?: ProfileInsightViewV1 | null;
};

function pickPrimaryFocus(
  domains: ProfileMirrorDomain[],
  profileInsights?: ProfileInsightViewV1 | null
): ProfileMirrorDomainSlug | null {
  const isActionable = (slug: ProfileMirrorDomainSlug) => {
    const domain = domains.find((entry) => entry.slug === slug);
    return Boolean(domain && domain.status !== 'complete');
  };

  const hintSlug = profileInsights?.missingContext[0]?.mirrorSlug;
  if (hintSlug && isProfileMirrorDomainSlug(hintSlug) && isActionable(hintSlug)) {
    return hintSlug;
  }

  const needsAttention = domains.find((domain) => domain.status === 'needs_attention');
  if (needsAttention) {
    return needsAttention.slug;
  }

  const notAdded = domains.find((domain) => domain.status === 'not_added');
  if (notAdded) {
    return notAdded.slug;
  }

  return domains.find((domain) => domain.status !== 'complete')?.slug ?? null;
}

function isUpstreamIncomplete(
  slug: ProfileMirrorDomainSlug,
  domains: ProfileMirrorDomain[]
): boolean {
  const domain = domains.find((entry) => entry.slug === slug);
  return !domain || domain.status !== 'complete';
}

function domainGalaxyStatus(
  domain: ProfileMirrorDomain,
  isPrimaryFocus: boolean
): GalaxyNodeState {
  if (domain.status === 'complete') {
    return 'completed';
  }
  if (isPrimaryFocus) {
    return 'recommended';
  }
  if (domain.status === 'needs_attention') {
    return 'blocked';
  }
  return 'future';
}

function resolveModuleTitle(
  modules: PublicModuleContract[],
  moduleId?: string
): string | undefined {
  if (!moduleId) {
    return undefined;
  }
  return modules.find((module) => module.id === moduleId)?.title;
}

export function buildProfileGalaxyGraph({
  uiSnapshot,
  modules,
  profile,
  profileInsights,
}: BuildInput) {
  const domains = buildProfileMirrorDomains(uiSnapshot, modules, profile);
  const insightsBySlug = new Map(
    profileInsights?.domainInsights.map((entry) => [entry.mirrorSlug, entry]) ?? []
  );

  const primaryFocusSlug = pickPrimaryFocus(domains, profileInsights);

  const blocked = domains.filter(
    (domain) => domain.status === 'needs_attention' && domain.slug !== primaryFocusSlug
  );
  const completed = domains.filter(
    (domain) => domain.status === 'complete' && domain.slug !== primaryFocusSlug
  );
  const secondary = domains.filter(
    (domain) =>
      domain.status === 'not_added' &&
      domain.slug !== primaryFocusSlug &&
      domain.ctaModuleId != null
  );
  const contextual = domains.filter(
    (domain) =>
      domain.slug !== primaryFocusSlug &&
      !blocked.includes(domain) &&
      !completed.includes(domain) &&
      !secondary.includes(domain)
  );

  const toPayload = (domain: ProfileMirrorDomain): ProfileGalaxyNodePayload => ({
    domain,
    domainInsight: insightsBySlug.get(domain.slug),
    detailHref: `/profile/${domain.slug}`,
    editHref: `/profile/${domain.slug}/edit`,
    moduleHref: domain.ctaModuleId ? `/modules/${domain.ctaModuleId}` : undefined,
    moduleTitle: resolveModuleTitle(modules, domain.ctaModuleId),
  });

  const toLayoutNode = (domain: ProfileMirrorDomain, status: GalaxyNodeState) => ({
    id: domain.slug,
    status,
    payload: toPayload(domain),
  });

  const primaryDomain = primaryFocusSlug
    ? domains.find((domain) => domain.slug === primaryFocusSlug)
    : undefined;

  const graphNodes = layoutGalaxyGraphNodes<ProfileGalaxyNodePayload>({
    primary: primaryDomain
      ? toLayoutNode(primaryDomain, domainGalaxyStatus(primaryDomain, true))
      : undefined,
    blocked: blocked.map((domain) => toLayoutNode(domain, 'blocked')),
    completed: completed.map((domain) => toLayoutNode(domain, 'completed')),
    secondary: secondary.map((domain) => toLayoutNode(domain, 'recommended')),
    contextual: contextual.map((domain) => toLayoutNode(domain, 'future')),
  });

  const graphEdges: SpatialGraphEdge[] = [];
  const edgeIds = new Set<string>();
  const addEdge = (edge: SpatialGraphEdge) => {
    if (edgeIds.has(edge.id)) {
      return;
    }
    edgeIds.add(edge.id);
    graphEdges.push(edge);
  };

  const focusId = primaryFocusSlug;

  if (focusId) {
    addEdge({ id: `unlock-journey-${focusId}`, from: '__journey__', to: focusId, type: 'unlock' });
    [...secondary, ...contextual].forEach((domain) => {
      addEdge({
        id: `unlock-${focusId}-${domain.slug}`,
        from: focusId,
        to: domain.slug,
        type: 'unlock',
      });
    });
    blocked.forEach((domain) => {
      addEdge({
        id: `dep-${domain.slug}-${focusId}`,
        from: domain.slug,
        to: focusId,
        type: 'dependency',
      });
    });
  }

  for (const [targetSlug, sourceSlugs] of Object.entries(PROFILE_DOMAIN_DEPS) as Array<
    [ProfileMirrorDomainSlug, ProfileMirrorDomainSlug[]]
  >) {
    for (const sourceSlug of sourceSlugs) {
      if (!isUpstreamIncomplete(sourceSlug, domains)) {
        continue;
      }
      addEdge({
        id: `dep-${sourceSlug}-${targetSlug}`,
        from: sourceSlug,
        to: targetSlug,
        type: 'dependency',
      });
    }
  }

  return {
    graphNodes,
    graphEdges,
    primaryFocusDomainSlug: primaryFocusSlug,
    journeyLabel: buildProfileMirrorHeadline(profile, uiSnapshot.session.language),
    domainsBySlug: new Map(domains.map((domain) => [domain.slug, toPayload(domain)])),
  };
}
