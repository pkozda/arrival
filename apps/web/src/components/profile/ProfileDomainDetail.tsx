'use client';

import { AtlasLink as Link } from '@/components/atlas-runtime';
import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/atlas-runtime';
import { AtlasSurface } from '@/components/atlas-runtime/legacy';
import { useApp } from '@/components/AppProvider';
import { DomainStatusBadge } from '@/components/profile/DomainStatusBadge';
import { ProfileCorrectionToast } from '@/components/profile/ProfileCorrectionToast';
import { DomainInsightBlock, findDomainInsight } from '@/components/profile/DomainInsightBlock';
import { ProfileEditCTA } from '@/components/profile/ProfileEditCTA';
import { findProfileMirrorDomain, resolveDomainCtaTitle } from '@/lib/profile-mirror-utils';
import { isProfileMirrorDomainSlug } from '@/lib/profile-mirror-utils';
import { selectUserContextProfile } from '@/lib/user-context';

type Props = {
  domainSlug: string;
};

export function ProfileDomainDetail({ domainSlug }: Props) {
  const searchParams = useSearchParams();
  const { uiSnapshot, userContext, profileInsights, modules } = useApp();
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
      <AtlasSurface>
        <p className="text-body text-body--muted">This section could not be found.</p>
        <Link href="/profile" className="text-link-accent">
          ← Back to your situation
        </Link>
      </AtlasSurface>
    );
  }

  const ctaTitle = resolveDomainCtaTitle(domain, modules);
  const hasData = domain.fields.length > 0;
  const editSlug = isProfileMirrorDomainSlug(domainSlug) ? domainSlug : domain.slug;
  const domainInsight = isProfileMirrorDomainSlug(editSlug)
    ? findDomainInsight(profileInsights?.domainInsights, editSlug)
    : undefined;

  return (
    <>
      {showUpdatedToast && <ProfileCorrectionToast />}

      <PageHeader
        eyebrow="Profile"
        leading={
          <Link href="/profile">← Your situation in Germany</Link>
        }
        title={domain.title}
        trailing={<DomainStatusBadge status={domain.status} />}
      />

      <AtlasSurface className="mb-md">
        {hasData ? (
          <>
            <dl className="profile-field-list">
              {domain.fields.map((field) => (
                <div key={field.label}>
                  <dt className="text-label">{field.label}</dt>
                  <dd className="text-body">{field.value}</dd>
                </div>
              ))}
            </dl>
            {domain.provenanceModuleTitle && (
              <p className="text-caption mt-md">
                {`Last updated when you used ${domain.provenanceModuleTitle}`}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-body text-body--muted">{domain.emptyExplanation}</p>
            {domain.ctaModuleId && ctaTitle && (
              <Link href={`/modules/${domain.ctaModuleId}`} className="btn-primary-link">
                {`Open ${ctaTitle}`}
              </Link>
            )}
          </>
        )}

        <div className="mt-md">
          <ProfileEditCTA domainSlug={editSlug} />
        </div>
      </AtlasSurface>

      <DomainInsightBlock insight={domainInsight} />

      <AtlasSurface as="section" className="mt-md">
        <h2 className="text-section-title--sm mb-sm">Why this matters</h2>
        <p className="text-body text-body--muted">{domain.whyItMatters}</p>
      </AtlasSurface>
    </>
  );
}
