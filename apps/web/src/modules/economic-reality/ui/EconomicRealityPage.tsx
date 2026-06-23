'use client';

import { useEffect, useMemo } from 'react';
import { ER_COPY_KEYS } from '@/lib/product-contract';
import type { EconomicRealityClientStateV1 } from '@/lib/economic-reality';
import { adaptPresentationToUi, useEconomicCopy } from '@/lib/economic-reality';
import { useApp } from '@/components/AppProvider';
import { useEconomicFeedbackTracker } from '@/lib/economic-reality/useEconomicFeedbackTracker';
import { SurfaceErrorPanel } from '@/components/surface/SurfaceErrorPanel';
import { SurfaceLoadingSkeleton } from '@/components/surface/SurfaceLoadingSkeleton';
import { useSurfaceRetry } from '@/components/surface/useSurfaceRetry';
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
    return (
      <div className="card" data-ui-surface="economic-reality-module-body" style={{ padding: '1.5rem' }}>
        <SurfaceLoadingSkeleton />
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="card" data-ui-surface="economic-reality-module-body" style={{ padding: '1.5rem' }}>
        <SurfaceErrorPanel
          message={copy(state.error)}
          onRetry={handleRetry}
          retrying={retrying}
          title={copy(ER_COPY_KEYS.UI_ERROR)}
          retryLabel={t('common.retry')}
        />
      </div>
    );
  }

  if (!state.presentation) {
    return (
      <div className="card" style={{ padding: '1.5rem', color: 'var(--color-text-muted)' }}>
        {copy(ER_COPY_KEYS.UI_NOT_AVAILABLE)}
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

      {showDebug && state.plan && (
        <details className="card" style={{ marginTop: '1rem', padding: '1rem' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
            {copy(ER_COPY_KEYS.UI_DEBUG_PLAN)}
          </summary>
          <pre style={{ marginTop: '0.75rem', fontSize: '0.75rem', overflowX: 'auto' }}>
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
        </details>
      )}
    </div>
  );
}
