'use client';

import { ER_COPY_KEYS } from '@/lib/product-contract';
import type { PresentationFocusV1 } from '@/lib/product-contract';
import { useEconomicCopy } from '@/lib/economic-reality';

type Props = {
  highlights: PresentationFocusV1[];
};

export function SystemBanner({ highlights }: Props) {
  const copy = useEconomicCopy();
  const highlight = highlights[0];
  if (!highlight) {
    return null;
  }

  return (
    <aside
      className="card"
      data-ui-panel="SystemBanner"
      style={{ marginBottom: '1rem', padding: '0.875rem 1rem', background: 'var(--color-surface-muted)' }}
    >
      <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
        {copy(ER_COPY_KEYS.UI_SYSTEM)}
      </p>
      <p style={{ fontSize: '0.9375rem', marginTop: '0.25rem' }}>{copy(highlight.labelKey)}</p>
    </aside>
  );
}
