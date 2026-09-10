'use client';

import { useState } from 'react';
import {
  DEMO_PERSONA_IDS,
  getDemoPersona,
  type DemoPersonaId,
} from '@arrival-atlas/life-event-demo/personas';

type HeaderLifeEventDemosProps = {
  disabled: boolean;
  loadDemoPreset: (presetId: DemoPersonaId) => Promise<void>;
};

/**
 * Dev-only Life Event persona loaders. Imported dynamically from Header so
 * production client bundles do not eagerly pull @arrival-atlas/life-event-demo.
 */
export function HeaderLifeEventDemos({
  disabled,
  loadDemoPreset,
}: HeaderLifeEventDemosProps) {
  const [loadingPreset, setLoadingPreset] = useState<DemoPersonaId | null>(null);

  async function handleLoadPreset(presetId: DemoPersonaId) {
    const persona = getDemoPersona(presetId);
    setLoadingPreset(presetId);
    try {
      await loadDemoPreset(presetId);
      window.alert(`Demo loaded: ${persona.title}`);
    } catch (error) {
      console.error(error);
      window.alert(error instanceof Error ? error.message : 'Failed to load demo preset');
    } finally {
      setLoadingPreset(null);
    }
  }

  return (
    <>
      <span className="header-drawer-label">Life Event demos</span>
      <div className="header-dev-tools-actions header-dev-tools-actions--stack">
        {DEMO_PERSONA_IDS.map((presetId) => {
          const persona = getDemoPersona(presetId);
          return (
            <button
              key={presetId}
              type="button"
              className="header-dev-btn"
              disabled={loadingPreset !== null || disabled}
              onClick={() => void handleLoadPreset(presetId)}
            >
              {loadingPreset === presetId
                ? 'Loading…'
                : persona.title.replace('Persona ', '')}
            </button>
          );
        })}
      </div>
    </>
  );
}
