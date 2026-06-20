'use client';

import Link from 'next/link';
import type { MissingContextHint, ProfileInsightViewV1 } from '@/lib/product-contract';
import { buildCompletenessSummary } from '@/lib/profile-insights/selectors';

type Props = {
  insights: ProfileInsightViewV1 | null;
};

function MissingContextItem({ hint }: { hint: MissingContextHint }) {
  return (
    <li style={{ marginBottom: '0.375rem' }}>
      <Link href={hint.href} style={{ color: 'var(--color-accent)', fontSize: '0.875rem' }}>
        {hint.message}
      </Link>
    </li>
  );
}

export function MissingContextHintsCard({ insights }: Props) {
  if (!insights) {
    return null;
  }

  const completenessSummary = buildCompletenessSummary(insights);
  const hints = insights.missingContext;

  if (!completenessSummary && hints.length === 0) {
    return null;
  }

  return (
    <section className="card" style={{ marginBottom: '1rem' }}>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem' }}>
        Situation insights
      </h2>

      {completenessSummary && (
        <p style={{ fontSize: '0.9375rem', marginBottom: hints.length > 0 ? '0.75rem' : 0 }}>
          {completenessSummary}
        </p>
      )}

      {hints.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
          {hints.map((hint) => (
            <MissingContextItem key={`${hint.domain}-${hint.href}`} hint={hint} />
          ))}
        </ul>
      )}
    </section>
  );
}
