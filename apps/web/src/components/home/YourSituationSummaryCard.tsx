'use client';

import Link from 'next/link';
import type { SituationSummary } from '@/lib/situation-utils';

type Props = {
  summary: SituationSummary;
};

export function YourSituationSummaryCard({ summary }: Props) {
  return (
    <section className="card" style={{ marginBottom: '1rem' }}>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem' }}>
        Your situation
      </h2>

      {summary.isEmpty ? (
        <p style={{ fontSize: '0.9375rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
          Arrival Atlas builds a summary as you use tools. Nothing saved yet.
        </p>
      ) : (
        <>
          {summary.headlineLines.length > 0 && (
            <p style={{ fontSize: '1rem', fontWeight: 500, marginBottom: '0.5rem' }}>
              {summary.headlineLines.join(' · ')}
            </p>
          )}
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
            {summary.completeCount} {summary.completeCount === 1 ? 'area' : 'areas'} complete
            {summary.needsAttentionCount > 0 && (
              <>
                {' '}
                · {summary.needsAttentionCount}{' '}
                {summary.needsAttentionCount === 1 ? 'needs' : 'need'} attention
              </>
            )}
            {summary.notAddedCount > 0 && summary.completeCount === 0 && summary.needsAttentionCount === 0 && (
              <>
                {' '}
                · {summary.notAddedCount} not added yet
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
        View your situation →
      </Link>
    </section>
  );
}
