'use client';

import { useEffect, useMemo } from 'react';
import { ER_COPY_KEYS } from '@/lib/product-contract';
import type { EconomicRealityClientStateV1 } from '@/lib/economic-reality';
import { adaptPresentationToUi, useEconomicCopy } from '@/lib/economic-reality';
import { useApp } from '@/components/AppProvider';
import { AtlasSurface } from '@/components/atlas-runtime/legacy';
import { useEconomicFeedbackTracker } from '@/lib/economic-reality/useEconomicFeedbackTracker';
import { SurfaceErrorPanel } from '@/components/surface/SurfaceErrorPanel';
import { SurfaceLoadingSkeleton } from '@/components/surface/SurfaceLoadingSkeleton';
import { useSurfaceRetry } from '@/components/surface/useSurfaceRetry';
import { EconomicRealityGalaxyBridge } from './EconomicRealityGalaxyBridge';
import { HighlightPanel } from './components/HighlightPanel';
import { SystemBanner } from './components/SystemBanner';
import {
  PrimarySection,
  SecondarySection,
  SystemSection,
} from './sections/SectionRenderers';

type Props = {
  sessionId?: string;
  mode: 'full' | 'embedded';
  state: EconomicRealityClientStateV1;
  showDebug?: boolean;
  onRetry: () => Promise<void>;
};

export function EconomicRealityPage({ mode, state, showDebug = false, onRetry }: Props) {
  const copy = useEconomicCopy();
  const { t } = useApp();
  const { trackModuleEntered } = useEconomicFeedbackTracker();
  const { retrying, onRetry: handleRetry } = useSurfaceRetry(onRetry);

  useEffect(() => {
    if (state.deterministicHash) {
      void trackModuleEntered(state.deterministicHash);
    }
  }, [state.deterministicHash, trackModuleEntered]);

  const sections = useMemo(() => {
    if (!state.presentation) {
      return [];
    }

    return adaptPresentationToUi(state.presentation);
  }, [state.presentation]);

  if (state.loading || retrying) {
    return mode === 'full' ? (
      <div className="le-galaxy-viewport__overlay">
        <SurfaceLoadingSkeleton />
      </div>
    ) : (
      <AtlasSurface data-ui-surface="economic-reality-module-body">
        <SurfaceLoadingSkeleton />
      </AtlasSurface>
    );
  }

  if (state.error) {
    return mode === 'full' ? (
      <div className="le-galaxy-viewport__overlay">
        <SurfaceErrorPanel
          message={copy(state.error)}
          onRetry={handleRetry}
          retrying={retrying}
          title={copy(ER_COPY_KEYS.UI_ERROR)}
          retryLabel={t('common.retry')}
        />
      </div>
    ) : (
      <AtlasSurface data-ui-surface="economic-reality-module-body">
        <SurfaceErrorPanel
          message={copy(state.error)}
          onRetry={handleRetry}
          retrying={retrying}
          title={copy(ER_COPY_KEYS.UI_ERROR)}
          retryLabel={t('common.retry')}
        />
      </AtlasSurface>
    );
  }

  if (!state.presentation) {
    return mode === 'full' ? (
      <div className="le-galaxy-viewport__overlay le-galaxy-viewport__overlay--message">
        {copy(ER_COPY_KEYS.UI_NOT_AVAILABLE)}
      </div>
    ) : (
      <AtlasSurface className="text-body text-body--muted">
        {copy(ER_COPY_KEYS.UI_NOT_AVAILABLE)}
      </AtlasSurface>
    );
  }

  if (mode === 'full') {
    return (
      <div data-ui-surface="economic-reality-module-body">
        <EconomicRealityGalaxyBridge presentation={state.presentation} sections={sections} />

        {showDebug && state.plan && (
          <details className="le-galaxy-hud le-galaxy-hud--explorer">
            <summary className="le-galaxy-hud__explorer-toggle">{copy(ER_COPY_KEYS.UI_DEBUG_PLAN)}</summary>
            <div className="le-galaxy-hud__explorer-body">
              <pre className="text-caption" style={{ overflowX: 'auto' }}>
                {JSON.stringify(
                  {
                    planId: state.plan.planId,
                    deterministicHash: state.deterministicHash,
                    graphId: state.plan.graphId,
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          </details>
        )}
      </div>
    );
  }

  return (
    <div className="er-module-page" data-er-mode={mode} data-ui-surface="economic-reality-module-body">
      {state.presentation.primaryHighlight && (
        <HighlightPanel highlight={state.presentation.primaryHighlight} />
      )}

      {sections.map((section) => {
        if (section.section.type === 'PRIMARY') {
          return <PrimarySection key={section.section.sectionId} section={section} />;
        }
        if (section.section.type === 'SECONDARY') {
          return <SecondarySection key={section.section.sectionId} section={section} />;
        }
        return <SystemSection key={section.section.sectionId} section={section} />;
      })}

      <SystemBanner highlights={state.presentation.systemHighlights} />
    </div>
  );
}
