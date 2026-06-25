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
    <AtlasSurface as="section" className="mb-md er-highlight-panel" data-ui-panel="HighlightPanel">
      <p className="text-eyebrow">{copy(ER_COPY_KEYS.UI_PRIMARY_FOCUS)}</p>
      <h2 className="text-section-title mt-sm">{copy(highlight.labelKey)}</h2>
    </AtlasSurface>
  );
}
