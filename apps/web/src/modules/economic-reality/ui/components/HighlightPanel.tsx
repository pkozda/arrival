'use client';

import { ER_COPY_KEYS } from '@/lib/product-contract';
import type { PresentationFocusV1 } from '@/lib/product-contract';
import { useEconomicCopy } from '@/lib/economic-reality';

type Props = {
  highlight: PresentationFocusV1;
};

export function HighlightPanel({ highlight }: Props) {
  const copy = useEconomicCopy();

  return (
    <section
      className="card"
      data-ui-panel="HighlightPanel"
      style={{ marginBottom: '1rem', padding: '1rem' }}
    >
      <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
        {copy(ER_COPY_KEYS.UI_PRIMARY_FOCUS)}
      </p>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginTop: '0.25rem' }}>
        {copy(highlight.labelKey)}
      </h2>
    </section>
  );
}
