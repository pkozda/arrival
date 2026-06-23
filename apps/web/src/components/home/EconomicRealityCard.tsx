'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ER_COPY_KEYS, ECONOMIC_REALITY_MODULE_CATALOG_ENTRY, buildModuleCatalogRoute } from '@/lib/product-contract';
import type { EconomicRealityClientStateV1 } from '@/lib/economic-reality';
import { useEconomicCopy } from '@/lib/economic-reality';
import { useApp } from '@/components/AppProvider';
import { shouldShowEconomicRealitySurface } from '@/app-shell/navigation/visibility';
import { SurfaceErrorPanel } from '@/components/surface/SurfaceErrorPanel';
import { SurfaceLoadingSkeleton } from '@/components/surface/SurfaceLoadingSkeleton';
import { useSurfaceRetry } from '@/components/surface/useSurfaceRetry';

type Props = {
  state: EconomicRealityClientStateV1;
  onRetry: () => Promise<void>;
};

/** UX-H2, UX-RETRY-ER-H — Home ER card never silent on failure. */
export function EconomicRealityCard({ state, onRetry }: Props) {
  const copy = useEconomicCopy();
  const { t } = useApp();
  const { retrying, onRetry: handleRetry } = useSurfaceRetry(onRetry);
  const visible = shouldShowEconomicRealitySurface({
    evaluation: state.evaluation,
    presentation: state.presentation,
    actionSet: state.actionSet,
  });

  const showCardShell = state.loading || Boolean(state.error) || visible;

  if (!showCardShell) {
    return null;
  }

  const cardShell = (body: ReactNode) => (
    <section
      className="card"
      data-ui-surface="economic-reality-home-card"
      style={{ marginBottom: '1rem' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.75rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>{copy(ER_COPY_KEYS.MODULE_TITLE)}</h2>
        {!state.loading && !state.error && state.presentation && (
          <Link
            href={buildModuleCatalogRoute(ECONOMIC_REALITY_MODULE_CATALOG_ENTRY)}
            className="btn btn-secondary"
            style={{ flexShrink: 0 }}
          >
            {copy(ER_COPY_KEYS.UI_VIEW_PLAN)}
          </Link>
        )}
      </div>
      {body}
    </section>
  );

  if (state.loading || retrying) {
    return cardShell(<SurfaceLoadingSkeleton compact />);
  }

  if (state.error) {
    return cardShell(
      <SurfaceErrorPanel
        compact
        title={copy(ER_COPY_KEYS.UI_ERROR)}
        message={copy(state.error)}
        onRetry={handleRetry}
        retrying={retrying}
        retryLabel={t('common.retry')}
      />
    );
  }

  if (!state.presentation) {
    return null;
  }

  const primaryHighlight = state.presentation.primaryHighlight;
  const systemHighlight = state.presentation.systemHighlights[0];

  return cardShell(
    <>
      <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
        {copy(primaryHighlight.labelKey)}
      </p>
      {systemHighlight && (
        <p style={{ fontSize: '0.8125rem', marginTop: '0.75rem', color: 'var(--color-text-muted)' }}>
          {copy(systemHighlight.labelKey)}
        </p>
      )}
    </>
  );
}
