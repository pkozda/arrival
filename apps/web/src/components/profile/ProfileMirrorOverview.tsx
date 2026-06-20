'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useApp } from '@/components/AppProvider';
import { ProfileDomainSectionCard } from '@/components/profile/ProfileDomainSectionCard';
import { buildProfileMirrorDomains, buildProfileMirrorHeadline } from '@/lib/profile-mirror-utils';
import { selectUserContextProfile } from '@/lib/user-context';

export function ProfileMirrorOverview() {
  const { uiSnapshot, userContext, modules } = useApp();
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
      <header style={{ marginBottom: '1.5rem' }}>
        <h1
          style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            marginBottom: '0.375rem',
            letterSpacing: '-0.02em',
          }}
        >
          Your situation in Germany
        </h1>
        <p style={{ fontSize: '1rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
          A summary built from the tools you use
        </p>
        <p style={{ fontSize: '1.0625rem', fontWeight: 500, lineHeight: 1.5 }}>{headline}</p>
      </header>

      <section>
        {domains.map((domain) => (
          <ProfileDomainSectionCard
            key={domain.slug}
            domain={domain}
            modules={modules}
            detailHref={`/profile/${domain.slug}`}
          />
        ))}
      </section>

      <p style={{ marginTop: '1.5rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
        <Link href="/" style={{ color: 'var(--color-accent)' }}>
          ← Back to home
        </Link>
      </p>
    </>
  );
}
