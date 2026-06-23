'use client';

import { AtlasLink as Link } from '@/components/atlas-runtime';
import type { EconomicRealityClientStateV1 } from '@/lib/economic-reality';
import { ER_COPY_KEYS, ECONOMIC_REALITY_MODULE_CATALOG_ENTRY, buildModuleCatalogRoute } from '@/lib/product-contract';
import { useEconomicCopy } from '@/lib/economic-reality';
import { useApp } from '@/components/AppProvider';
import { shouldShowEconomicRealitySurface } from '@/app-shell/navigation/visibility';
import { useSurfaceRetry } from '@/components/surface/useSurfaceRetry';

type Props = {
  state: EconomicRealityClientStateV1;
  onRetry: () => Promise<void>;
};

/**
 * Layer 3 — compact Economic Reality context strip.
 * UX-H2, UX-RETRY-ER-H — preserves `economic-reality-home-card` surface marker.
 */
export function HomeSecondaryContext({ state, onRetry }: Props) {
  const copy = useEconomicCopy();
  const { t } = useApp();
  const { retrying, onRetry: handleRetry } = useSurfaceRetry(onRetry);

  const visible = shouldShowEconomicRealitySurface({
    evaluation: state.evaluation,
    presentation: state.presentation,
    actionSet: state.actionSet,
  });

  const showStrip = state.loading || Boolean(state.error) || visible || retrying;

  if (!showStrip) {
    return null;
  }

  return (
    <aside
      className={`home-secondary-context${retrying ? ' home-secondary-context--retrying' : ''}${state.error ? ' home-secondary-context--error' : ''}`}
      data-home-layer="context"
      data-ui-surface="economic-reality-home-card"
    >
      <div className="home-secondary-context__scan" aria-hidden="true" />
      <div className="home-secondary-context__heartbeat" aria-hidden="true" />
      <div className="home-secondary-context__glass">
      <div className="home-secondary-context__label">{t('life-event.home.context.economicLabel')}</div>

      {(state.loading || retrying) && (
        <div className="home-secondary-context__line home-secondary-context__line--loading" aria-busy="true">
          <span className="home-secondary-context__pulse" />
          <span className="home-secondary-context__shimmer" />
        </div>
      )}

      {!state.loading && !retrying && state.error && (
        <div className="home-secondary-context__line home-secondary-context__line--error">
          <span>{copy(ER_COPY_KEYS.UI_ERROR)}</span>
          <button
            type="button"
            className="home-secondary-context__retry"
            onClick={() => void handleRetry()}
            disabled={retrying}
          >
            {t('common.retry')}
          </button>
        </div>
      )}

      {!state.loading && !retrying && !state.error && state.presentation && (
        <div className="home-secondary-context__line">
          <p className="home-secondary-context__insight">{copy(state.presentation.primaryHighlight.labelKey)}</p>
          {state.presentation.systemHighlights[0] && (
            <p className="home-secondary-context__subline">
              {copy(state.presentation.systemHighlights[0].labelKey)}
            </p>
          )}
          <Link
            href={buildModuleCatalogRoute(ECONOMIC_REALITY_MODULE_CATALOG_ENTRY)}
            className="home-secondary-context__link"
          >
            {copy(ER_COPY_KEYS.UI_VIEW_PLAN)} →
          </Link>
        </div>
      )}
      </div>
    </aside>
  );
}
