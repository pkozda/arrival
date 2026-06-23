'use client';

import { ER_COPY_KEYS } from '@/lib/product-contract';
import type { PresentationFocusV1 } from '@/lib/product-contract';
import { AtlasSurface } from '@/components/atlas-runtime/legacy';
import { useEconomicCopy } from '@/lib/economic-reality';

type Props = {
  highlight: PresentationFocusV1;
};

export function HighlightPanel({ highlight }: Props) {
  const copy = useEconomicCopy();

  return (
    <AtlasSurface as="section" className="mb-md" data-ui-panel="HighlightPanel" style={{ padding: '1rem' }}>
      <p className="text-eyebrow">{copy(ER_COPY_KEYS.UI_PRIMARY_FOCUS)}</p>
      <h2 className="text-section-title" style={{ marginTop: '0.25rem' }}>
        {copy(highlight.labelKey)}
      </h2>
    </AtlasSurface>
  );
}
