'use client';

import { AtlasLink as Link, AtlasSecondaryLink } from '@/components/atlas-runtime';
import type { ProfileMirrorDomainSlug } from '@/lib/profile-mirror-utils';
import { formatDomainStatus } from '@/lib/profile-mirror-utils';
import type { ProfileGalaxyNodePayload } from '@/lib/presentation/profile/build-galaxy-graph';
import { ProfileEditCTA } from '@/components/profile/ProfileEditCTA';
import { ConfidenceBadge } from '@/components/profile/ConfidenceBadge';

type Props = {
  payload: ProfileGalaxyNodePayload;
  depth: 'summary' | 'detail';
};

export function ProfileDomainInspectorActions({ payload, depth }: Props) {
  const { domain, moduleHref, moduleTitle } = payload;

  return (
    <div className="stack-sm">
      {moduleHref && moduleTitle && (
        <AtlasSecondaryLink href={moduleHref}>
          {`Open ${moduleTitle}`}
        </AtlasSecondaryLink>
      )}
      <ProfileEditCTA
        domainSlug={domain.slug as ProfileMirrorDomainSlug}
        label={depth === 'detail' ? 'Correct information' : 'Edit domain'}
      />
      {depth === 'summary' && (
        <Link href={payload.detailHref} className="text-link-accent">
          View full domain
        </Link>
      )}
    </div>
  );
}

export function ProfileDomainInspectorBody({
  payload,
  depth,
}: Props) {
  const { domain, domainInsight } = payload;
  const hasData = domain.fields.length > 0;

  return (
    <>
      <p className="le-consequence-inspector__status">{formatDomainStatus(domain.status)}</p>

      {depth === 'detail' && hasData && (
        <dl className="profile-field-list le-consequence-inspector__fields">
          {domain.fields.map((field) => (
            <div key={field.label}>
              <dt className="text-label">{field.label}</dt>
              <dd className="text-body">{field.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {depth === 'detail' && domain.provenanceModuleTitle && (
        <p className="text-caption mt-sm">
          {`Last updated when you used ${domain.provenanceModuleTitle}`}
        </p>
      )}

      {depth === 'summary' && hasData && (
        <p className="text-body text-body--muted">
          {domain.previewLines.join(' · ')}
        </p>
      )}

      {depth === 'summary' && !hasData && (
        <p className="text-body text-body--muted">{domain.emptyExplanation}</p>
      )}

      {domainInsight && domainInsight.confidence.level !== 'none' && (
        <div className="mt-sm">
          <ConfidenceBadge level={domainInsight.confidence.level} />
          {domainInsight.provenanceNarrative && (
            <p className="text-body mt-sm">{domainInsight.provenanceNarrative}</p>
          )}
          {domainInsight.suggestions.map((suggestion) => (
            <p key={suggestion.href} className="text-meta" style={{ marginBottom: '0.375rem' }}>
              <Link href={suggestion.href} style={{ color: 'var(--color-accent)' }}>
                {suggestion.message}
              </Link>
            </p>
          ))}
        </div>
      )}
    </>
  );
}
