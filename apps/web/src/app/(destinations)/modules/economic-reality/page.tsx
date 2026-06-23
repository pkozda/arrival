'use client';

import { useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { ER_COPY_KEYS } from '@/lib/product-contract';
import { useEconomicCopy, useEconomicRealityPlan } from '@/lib/economic-reality';
import { EconomicRealityPage } from '@/modules/economic-reality/ui/EconomicRealityPage';
import { isDevToolsUiEnabled } from '@/lib/dev-tools/reset-user-data';

export default function EconomicRealityModulePage() {
  const { sessionId } = useApp();
  const state = useEconomicRealityPlan();
  const copy = useEconomicCopy();
  const [debugOpen, setDebugOpen] = useState(false);
  const devToolsEnabled = isDevToolsUiEnabled();

  return (
    <main className="celestial-page-main">
      <div className="container">
        <header style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>{copy(ER_COPY_KEYS.MODULE_TITLE)}</h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
            {copy(ER_COPY_KEYS.MODULE_DESCRIPTION)}
          </p>
          {devToolsEnabled && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ marginTop: '0.75rem' }}
              onClick={() => setDebugOpen((open) => !open)}
            >
              {copy(debugOpen ? ER_COPY_KEYS.UI_HIDE_DEBUG : ER_COPY_KEYS.UI_SHOW_DEBUG)}
            </button>
          )}
        </header>

        <EconomicRealityPage
          sessionId={sessionId ?? undefined}
          mode="full"
          state={state}
          showDebug={devToolsEnabled && debugOpen}
          onRetry={state.refetch}
        />
      </div>
    </main>
  );
}
