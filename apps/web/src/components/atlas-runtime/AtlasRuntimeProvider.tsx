'use client';

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import {
  ATLAS_COSMIC_THEME,
  SPATIAL_GRAPH,
  spatialTransitionEngine,
  type AtlasAppRuntime,
  type AtlasShellMode,
} from '@/lib/atlas-runtime';

const AtlasRuntimeContext = createContext<AtlasAppRuntime | null>(null);

export function AtlasRuntimeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const shellMode: AtlasShellMode = pathname === '/' ? 'star-map' : 'destination';

  const runtime = useMemo<AtlasAppRuntime>(
    () => ({
      theme: ATLAS_COSMIC_THEME,
      motionEngine: spatialTransitionEngine,
      shellMode,
      navigationModel: SPATIAL_GRAPH,
    }),
    [shellMode]
  );

  return <AtlasRuntimeContext.Provider value={runtime}>{children}</AtlasRuntimeContext.Provider>;
}

export function useAtlasRuntime(): AtlasAppRuntime {
  const context = useContext(AtlasRuntimeContext);
  if (!context) {
    throw new Error('useAtlasRuntime must be used within AtlasRuntimeProvider');
  }
  return context;
}
