'use client';

import Link from 'next/link';
import type { DomainInsight } from '@/lib/product-contract';
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
    <section className="card" style={{ marginTop: '1rem' }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
        What we know
      </h2>

      <div style={{ marginBottom: '0.75rem' }}>
        <ConfidenceBadge level={insight.confidence.level} />
      </div>

      {insight.provenanceNarrative && (
        <p style={{ fontSize: '0.9375rem', lineHeight: 1.5, marginBottom: '0.75rem' }}>
          {insight.provenanceNarrative}
        </p>
      )}

      {insight.confidence.reasons.length > 0 && (
        <ul style={{ margin: '0 0 0.75rem', paddingLeft: '1.25rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          {insight.confidence.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}

      {insight.suggestions.map((suggestion) => (
        <p key={suggestion.href} style={{ fontSize: '0.875rem', marginBottom: '0.375rem' }}>
          <Link href={suggestion.href} style={{ color: 'var(--color-accent)' }}>
            {suggestion.message}
          </Link>
        </p>
      ))}
    </section>
  );
}

export function findDomainInsight(
  insights: DomainInsight[] | undefined,
  mirrorSlug: string
): DomainInsight | undefined {
  return insights?.find((entry) => entry.mirrorSlug === mirrorSlug);
}
