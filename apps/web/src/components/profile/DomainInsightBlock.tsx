'use client';

import { AtlasLink as Link } from '@/components/atlas-runtime';
import type { DomainInsight } from '@/lib/product-contract';
import { AtlasSurface } from '@/components/atlas-runtime/legacy';
import { ConfidenceBadge } from '@/components/profile/ConfidenceBadge';

type Props = {
  insight: DomainInsight | undefined;
};

export function DomainInsightBlock({ insight }: Props) {
  if (!insight) {
    return null;
  }

  const hasContent =
    insight.confidence.level !== 'none' ||
    insight.provenanceNarrative ||
    insight.suggestions.length > 0;

  if (!hasContent) {
    return null;
  }

  return (
    <AtlasSurface as="section" className="mt-md">
      <h2 className="text-section-title--sm mb-sm">What we know</h2>

      <div className="mb-sm">
        <ConfidenceBadge level={insight.confidence.level} />
      </div>

      {insight.provenanceNarrative && (
        <p className="text-body mb-sm">{insight.provenanceNarrative}</p>
      )}

      {insight.confidence.reasons.length > 0 && (
        <ul className="text-meta" style={{ margin: '0 0 0.75rem', paddingLeft: '1.25rem' }}>
          {insight.confidence.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}

      {insight.suggestions.map((suggestion) => (
        <p key={suggestion.href} className="text-meta" style={{ marginBottom: '0.375rem' }}>
          <Link href={suggestion.href} style={{ color: 'var(--color-accent)' }}>
            {suggestion.message}
          </Link>
        </p>
      ))}
    </AtlasSurface>
  );
}

export function findDomainInsight(
  insights: DomainInsight[] | undefined,
  mirrorSlug: string
): DomainInsight | undefined {
  return insights?.find((entry) => entry.mirrorSlug === mirrorSlug);
}
