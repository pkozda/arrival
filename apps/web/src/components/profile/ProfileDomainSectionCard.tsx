'use client';

import Link from 'next/link';
import type { ProfileMirrorDomain } from '@/lib/profile-mirror-utils';
import { resolveDomainCtaTitle } from '@/lib/profile-mirror-utils';
import type { PublicModuleContract } from '@/lib/product-contract';
import { DomainStatusBadge } from '@/components/profile/DomainStatusBadge';
import { ProfileEditCTA } from '@/components/profile/ProfileEditCTA';

type Props = {
  domain: ProfileMirrorDomain;
  modules: PublicModuleContract[];
  detailHref?: string;
};

export function ProfileDomainSectionCard({ domain, modules, detailHref }: Props) {
  const ctaTitle = resolveDomainCtaTitle(domain, modules);
  const hasData = domain.fields.length > 0;

  return (
    <article className="card" style={{ marginBottom: '0.75rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '0.75rem',
          marginBottom: '0.5rem',
        }}
      >
        {detailHref ? (
          <Link
            href={detailHref}
            style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            {domain.title}
          </Link>
        ) : (
          <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{domain.title}</h3>
        )}
        <DomainStatusBadge status={domain.status} />
      </div>

      {hasData ? (
        <>
          {domain.previewLines.length > 0 && (
            <p style={{ fontSize: '0.9375rem', marginBottom: '0.375rem' }}>
              {domain.previewLines.join(' · ')}
            </p>
          )}
          {domain.provenanceModuleTitle && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              Last updated when you used {domain.provenanceModuleTitle}
            </p>
          )}
          {detailHref && (
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              <Link
                href={detailHref}
                style={{
                  fontSize: '0.875rem',
                  color: 'var(--color-accent)',
                }}
              >
                View details →
              </Link>
              <ProfileEditCTA domainSlug={domain.slug} variant="link" label="Correct information →" />
            </div>
          )}
        </>
      ) : (
        <>
          <p style={{ fontSize: '0.9375rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
            {domain.emptyExplanation}
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
            {domain.whyItMatters}
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
          <div style={{ marginTop: '0.75rem' }}>
            <ProfileEditCTA domainSlug={domain.slug} variant="link" label="Correct information →" />
          </div>
        </>
      )}
    </article>
  );
}
