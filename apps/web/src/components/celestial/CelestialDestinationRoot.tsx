'use client';

import type { ReactNode } from 'react';
import { AtlasHomeProvider } from '@/components/atlas-home/AtlasHomeProvider';
import { LegacyGridField } from '@/components/atlas-runtime/legacy';
import { SpatialPageShell } from './SpatialPageShell';

/**
 * Destination shell — spatial page chrome + legacy content field.
 * Shared runtime providers (theme, motion, canvas) live in UnifiedAppShell.
 */
export function CelestialDestinationRoot({ children }: { children: ReactNode }) {
  return (
    <AtlasHomeProvider>
      <div className="celestial-destination-root">
        <SpatialPageShell>
          <LegacyGridField>{children}</LegacyGridField>
        </SpatialPageShell>
      </div>
    </AtlasHomeProvider>
  );
}
