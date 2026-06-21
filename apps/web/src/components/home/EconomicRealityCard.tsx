'use client';

import Link from 'next/link';
import { ER_COPY_KEYS, ECONOMIC_REALITY_MODULE_CATALOG_ENTRY, buildModuleCatalogRoute } from '@/lib/product-contract';
import type { EconomicRealityClientStateV1 } from '@/lib/economic-reality';
import { useEconomicCopy } from '@/lib/economic-reality';
import { shouldShowEconomicRealitySurface } from '@/app-shell/navigation/visibility';

type Props = {
  state: EconomicRealityClientStateV1;
};

export function EconomicRealityCard({ state }: Props) {
  const copy = useEconomicCopy();
  const visible = shouldShowEconomicRealitySurface({
    evaluation: state.evaluation,
    presentation: state.presentation,
    actionSet: state.actionSet,
  });

  if (!visible || state.loading || state.error || !state.presentation) {
    return null;
  }

  const primaryHighlight = state.presentation.primaryHighlight;
  const systemHighlight = state.presentation.systemHighlights[0];

  return (
    <section className="card" data-ui-surface="economic-reality-home-card" style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>{copy(ER_COPY_KEYS.MODULE_TITLE)}</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
            {copy(primaryHighlight.labelKey)}
          </p>
        </div>
        <Link
          href={buildModuleCatalogRoute(ECONOMIC_REALITY_MODULE_CATALOG_ENTRY)}
          className="btn btn-secondary"
          style={{ flexShrink: 0 }}
        >
          {copy(ER_COPY_KEYS.UI_VIEW_PLAN)}
        </Link>
      </div>

      {systemHighlight && (
        <p style={{ fontSize: '0.8125rem', marginTop: '0.75rem', color: 'var(--color-text-muted)' }}>
          {copy(systemHighlight.labelKey)}
        </p>
      )}
    </section>
  );
}
