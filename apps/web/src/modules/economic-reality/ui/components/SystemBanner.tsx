'use client';

import { ER_COPY_KEYS } from '@/lib/product-contract';
import type { PresentationFocusV1 } from '@/lib/product-contract';
import { AtlasSurface } from '@/components/atlas-runtime/legacy';
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
    <AtlasSurface
      as="aside"
      className="mb-md"
      data-ui-panel="SystemBanner"
      style={{ padding: '0.875rem 1rem' }}
    >
      <p className="text-eyebrow">{copy(ER_COPY_KEYS.UI_SYSTEM)}</p>
      <p className="text-body" style={{ marginTop: '0.25rem' }}>
        {copy(highlight.labelKey)}
      </p>
    </AtlasSurface>
  );
}
