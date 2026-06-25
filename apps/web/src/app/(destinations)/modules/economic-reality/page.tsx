'use client';

import { useState } from 'react';
import { AtlasSecondaryButton } from '@/components/atlas-runtime';
import { useApp } from '@/components/AppProvider';
import { ER_COPY_KEYS } from '@/lib/product-contract';
import { useEconomicCopy, useEconomicRealityPlan } from '@/lib/economic-reality';
import { GalaxyViewport } from '@/lib/presentation/spatial-core';
import { EconomicRealityPage } from '@/modules/economic-reality/ui/EconomicRealityPage';
import { isDevToolsUiEnabled } from '@/lib/dev-tools/reset-user-data';

export default function EconomicRealityModulePage() {
  const { sessionId } = useApp();
  const state = useEconomicRealityPlan();
  const copy = useEconomicCopy();
  const [debugOpen, setDebugOpen] = useState(false);
  const devToolsEnabled = isDevToolsUiEnabled();

  return (
    <GalaxyViewport
      label={copy(ER_COPY_KEYS.MODULE_TITLE)}
      surfaceId="economic-reality-galaxy"
    >
      {devToolsEnabled && (
        <div className="le-galaxy-viewport__devtools">
          <AtlasSecondaryButton onClick={() => setDebugOpen((open) => !open)}>
            {copy(debugOpen ? ER_COPY_KEYS.UI_HIDE_DEBUG : ER_COPY_KEYS.UI_SHOW_DEBUG)}
          </AtlasSecondaryButton>
        </div>
      )}

      <EconomicRealityPage
        sessionId={sessionId ?? undefined}
        mode="full"
        state={state}
        showDebug={devToolsEnabled && debugOpen}
        onRetry={state.refetch}
      />
    </GalaxyViewport>
  );
}
