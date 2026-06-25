'use client';

import { AtlasLink as Link } from '@/components/atlas-runtime';
import { AtlasSurface } from '@/components/atlas-runtime/legacy';
import type { ProfileMirrorDomain } from '@/lib/profile-mirror-utils';
import { resolveDomainCtaTitle } from '@/lib/profile-mirror-utils';
import type { PublicModuleContract } from '@/lib/product-contract';
import type { DomainInsight } from '@/lib/product-contract';
import { DomainStatusBadge } from '@/components/profile/DomainStatusBadge';
import { ConfidenceBadge } from '@/components/profile/ConfidenceBadge';
import { ProfileEditCTA } from '@/components/profile/ProfileEditCTA';

type Props = {
  domain: ProfileMirrorDomain;
  modules: PublicModuleContract[];
  detailHref?: string;
  domainInsight?: DomainInsight;
};

export function ProfileDomainSectionCard({ domain, modules, detailHref, domainInsight }: Props) {
  const ctaTitle = resolveDomainCtaTitle(domain, modules);
  const hasData = domain.fields.length > 0;

  return (
    <AtlasSurface as="article" className="mb-sm">
      <div className="profile-domain-card__header">
        {detailHref ? (
          <Link href={detailHref} className="profile-domain-card__title">
            {domain.title}
          </Link>
        ) : (
          <h3 className="profile-domain-card__title">{domain.title}</h3>
        )}
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {domainInsight && <ConfidenceBadge level={domainInsight.confidence.level} compact />}
          <DomainStatusBadge status={domain.status} />
        </div>
      </div>

      {hasData ? (
        <>
          {domain.previewLines.length > 0 && (
            <p className="text-body">{domain.previewLines.join(' · ')}</p>
          )}
          {domain.provenanceModuleTitle && (
            <p className="text-caption">{`Last updated when you used ${domain.provenanceModuleTitle}`}</p>
          )}
          {detailHref && (
            <div className="profile-domain-card__actions">
              <Link href={detailHref} className="text-link-accent">
                View details →
              </Link>
              <ProfileEditCTA domainSlug={domain.slug} variant="link" label="Correct information →" />
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-body text-body--muted">{domain.emptyExplanation}</p>
          <p className="text-meta">{domain.whyItMatters}</p>
          {domain.ctaModuleId && ctaTitle && (
            <Link href={`/modules/${domain.ctaModuleId}`} className="btn-primary-link">
              {`Open ${ctaTitle}`}
            </Link>
          )}
          <div style={{ marginTop: '0.75rem' }}>
            <ProfileEditCTA domainSlug={domain.slug} variant="link" label="Correct information →" />
          </div>
        </>
      )}
    </AtlasSurface>
  );
}
