'use client';

import type { ReactNode } from 'react';
import { AtlasHomeProvider } from '@/components/atlas-home/AtlasHomeProvider';
import { ArrivalProvider } from './ArrivalProvider';
import { SpatialCanvasLayer } from './SpatialCanvasLayer';
import { SpatialPageShell } from './SpatialPageShell';
import { SpatialParallaxProvider } from './SpatialParallaxProvider';

export function CelestialDestinationRoot({ children }: { children: ReactNode }) {
  return (
    <AtlasHomeProvider>
      <ArrivalProvider>
        <SpatialParallaxProvider>
          <div className="celestial-destination-root">
            <SpatialCanvasLayer />
            <SpatialPageShell>{children}</SpatialPageShell>
          </div>
        </SpatialParallaxProvider>
      </ArrivalProvider>
    </AtlasHomeProvider>
  );
}
