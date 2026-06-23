'use client';

import { AtlasLink as Link } from '@/components/atlas-runtime';
import type { SituationSummary } from '@/lib/situation-utils';
import { useApp } from '@/components/AppProvider';

type Props = {
  summary: SituationSummary;
};

function formatCountTemplate(template: string, count: number): string {
  return template.replace('{count}', String(count));
}

export function YourSituationSummaryCard({ summary }: Props) {
  const { t } = useApp();

  const areasLabel =
    summary.completeCount === 1
      ? formatCountTemplate(t('life-event.home.situationAreaComplete'), summary.completeCount)
      : formatCountTemplate(t('life-event.home.situationAreasComplete'), summary.completeCount);

  const attentionLabel =
    summary.needsAttentionCount === 1
      ? formatCountTemplate(t('life-event.home.situationNeedAttention'), summary.needsAttentionCount)
      : formatCountTemplate(t('life-event.home.situationNeedsAttention'), summary.needsAttentionCount);

  return (
    <section className="card" style={{ marginBottom: '1rem' }}>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem' }}>
        {t('life-event.home.situationTitle')}
      </h2>

      {summary.isEmpty ? (
        <p style={{ fontSize: '0.9375rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
          {t('life-event.home.situationEmpty')}
        </p>
      ) : (
        <>
          {summary.headlineLines.length > 0 && (
            <p style={{ fontSize: '1rem', fontWeight: 500, marginBottom: '0.5rem' }}>
              {summary.headlineLines.join(' · ')}
            </p>
          )}
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
            {areasLabel}
            {summary.needsAttentionCount > 0 && (
              <>
                {' '}
                · {attentionLabel}
              </>
            )}
            {summary.notAddedCount > 0 && summary.completeCount === 0 && summary.needsAttentionCount === 0 && (
              <>
                {' '}
                · {formatCountTemplate(t('life-event.home.situationNotAdded'), summary.notAddedCount)}
              </>
            )}
          </p>
        </>
      )}

      <Link
        href="/profile"
        style={{
          display: 'inline-block',
          marginTop: '0.75rem',
          fontSize: '0.875rem',
          color: 'var(--color-accent)',
          textDecoration: 'none',
        }}
      >
        {t('life-event.home.situationViewProfile')} →
      </Link>
    </section>
  );
}
