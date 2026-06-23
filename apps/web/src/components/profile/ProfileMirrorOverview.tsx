'use client';

import { AtlasLink as Link } from '@/components/atlas-runtime';
import { useMemo } from 'react';
import { PageHeader } from '@/components/atlas-runtime';
import { useApp } from '@/components/AppProvider';
import { ProfileDomainSectionCard } from '@/components/profile/ProfileDomainSectionCard';
import { buildProfileMirrorDomains, buildProfileMirrorHeadline } from '@/lib/profile-mirror-utils';
import { findMirrorInsight } from '@/lib/profile-insights/selectors';
import { selectUserContextProfile } from '@/lib/user-context';

export function ProfileMirrorOverview() {
  const { uiSnapshot, userContext, modules, profileInsights } = useApp();
  const profile = selectUserContextProfile(userContext);

  const domains = useMemo(
    () => (uiSnapshot ? buildProfileMirrorDomains(uiSnapshot, modules, profile) : []),
    [uiSnapshot, modules, profile]
  );

  const headline = useMemo(
    () =>
      uiSnapshot
        ? buildProfileMirrorHeadline(profile, uiSnapshot.session.language)
        : 'Nothing saved yet. Use tools to build your situation.',
    [uiSnapshot, profile]
  );

  if (!uiSnapshot) {
    return null;
  }

  return (
    <>
      <PageHeader
        eyebrow="Profile"
        title="Your situation in Germany"
        description="A summary built from the tools you use"
      />
      <p className="text-body text-body--emphasis mb-md">{headline}</p>

      <section>
        {domains.map((domain) => (
          <ProfileDomainSectionCard
            key={domain.slug}
            domain={domain}
            modules={modules}
            detailHref={`/profile/${domain.slug}`}
            domainInsight={findMirrorInsight(profileInsights, domain.slug)}
          />
        ))}
      </section>

      <p className="text-meta mt-lg">
        <Link href="/" style={{ color: 'var(--color-accent)' }}>
          ← Back to home
        </Link>
      </p>
    </>
  );
}
