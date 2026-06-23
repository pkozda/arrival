'use client';

import type { ReactNode } from 'react';
import { ArrivalProvider } from '@/components/celestial/ArrivalProvider';
import { SpatialParallaxProvider } from '@/components/celestial/SpatialParallaxProvider';
import { AtlasRuntimeProvider } from './AtlasRuntimeProvider';
import { PersistentSpatialCanvas } from './PersistentSpatialCanvas';

type Props = {
  children: ReactNode;
};

/**
 * Unified app shell — single spatial runtime wrapping star-map and destination shells.
 * Shared providers: theme (AtlasRuntime), motion (Arrival), spatial parallax, background canvas.
 */
export function UnifiedAppShell({ children }: Props) {
  return (
    <AtlasRuntimeProvider>
      <ArrivalProvider>
        <SpatialParallaxProvider>
          <div className="unified-app-shell">
            <PersistentSpatialCanvas />
            <div className="unified-app-shell__viewport">{children}</div>
          </div>
        </SpatialParallaxProvider>
      </ArrivalProvider>
    </AtlasRuntimeProvider>
  );
}
