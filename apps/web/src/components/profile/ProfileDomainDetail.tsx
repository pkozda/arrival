'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/components/AppProvider';
import { DomainStatusBadge } from '@/components/profile/DomainStatusBadge';
import { ProfileCorrectionToast } from '@/components/profile/ProfileCorrectionToast';
import { ProfileEditCTA } from '@/components/profile/ProfileEditCTA';
import { findProfileMirrorDomain, resolveDomainCtaTitle } from '@/lib/profile-mirror-utils';
import { isProfileMirrorDomainSlug } from '@/lib/profile-mirror-utils';
import { selectUserContextProfile } from '@/lib/user-context';

type Props = {
  domainSlug: string;
};

export function ProfileDomainDetail({ domainSlug }: Props) {
  const searchParams = useSearchParams();
  const { uiSnapshot, userContext, modules } = useApp();
  const profile = selectUserContextProfile(userContext);
  const showUpdatedToast = searchParams.get('updated') === '1';

  const domain = useMemo(
    () =>
      uiSnapshot && isProfileMirrorDomainSlug(domainSlug)
        ? findProfileMirrorDomain(uiSnapshot, modules, domainSlug, profile)
        : undefined,
    [uiSnapshot, modules, domainSlug, profile]
  );

  if (!domain) {
    return (
      <div className="card">
        <p style={{ color: 'var(--color-text-muted)' }}>This section could not be found.</p>
        <Link href="/profile" style={{ color: 'var(--color-accent)' }}>
          ← Back to your situation
        </Link>
      </div>
    );
  }

  const ctaTitle = resolveDomainCtaTitle(domain, modules);
  const hasData = domain.fields.length > 0;
  const editSlug = isProfileMirrorDomainSlug(domainSlug) ? domainSlug : domain.slug;

  return (
    <>
      {showUpdatedToast && <ProfileCorrectionToast />}

      <header style={{ marginBottom: '1.5rem' }}>
        <p style={{ marginBottom: '0.75rem' }}>
          <Link href="/profile" style={{ fontSize: '0.875rem', color: 'var(--color-accent)' }}>
            ← Your situation in Germany
          </Link>
        </p>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '0.75rem',
          }}
        >
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>{domain.title}</h1>
          <DomainStatusBadge status={domain.status} />
        </div>
      </header>

      <div className="card" style={{ marginBottom: '1rem' }}>
        {hasData ? (
          <>
            <dl style={{ display: 'grid', gap: '0.875rem', margin: 0 }}>
              {domain.fields.map((field) => (
                <div key={field.label}>
                  <dt
                    style={{
                      fontSize: '0.8125rem',
                      color: 'var(--color-text-muted)',
                      marginBottom: '0.125rem',
                    }}
                  >
                    {field.label}
                  </dt>
                  <dd style={{ fontSize: '0.9375rem', margin: 0 }}>{field.value}</dd>
                </div>
              ))}
            </dl>
            {domain.provenanceModuleTitle && (
              <p
                style={{
                  marginTop: '1rem',
                  fontSize: '0.8125rem',
                  color: 'var(--color-text-muted)',
                }}
              >
                Last updated when you used {domain.provenanceModuleTitle}
              </p>
            )}
          </>
        ) : (
          <>
            <p style={{ fontSize: '0.9375rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              {domain.emptyExplanation}
            </p>
            {domain.ctaModuleId && ctaTitle && (
              <Link
                href={`/modules/${domain.ctaModuleId}`}
                className="btn btn-primary"
                style={{
                  display: 'inline-block',
                  marginTop: '0.75rem',
                  fontSize: '0.875rem',
                  textDecoration: 'none',
                }}
              >
                Open {ctaTitle}
              </Link>
            )}
          </>
        )}

        <div style={{ marginTop: '1rem' }}>
          <ProfileEditCTA domainSlug={editSlug} />
        </div>
      </div>

      <section className="card">
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          Why this matters
        </h2>
        <p style={{ fontSize: '0.9375rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
          {domain.whyItMatters}
        </p>
      </section>
    </>
  );
}
