'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ModuleProgressUIState } from './module-progress';

type GalaxyProgressContextValue = {
  progress: ModuleProgressUIState | null;
  setProgress: (input: ModuleProgressUIState | null) => void;
};

const GalaxyProgressContext = createContext<GalaxyProgressContextValue | null>(null);

export function GalaxyProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<ModuleProgressUIState | null>(null);

  const value = useMemo(
    () => ({
      progress,
      setProgress,
    }),
    [progress]
  );

  return <GalaxyProgressContext.Provider value={value}>{children}</GalaxyProgressContext.Provider>;
}

export function useGalaxyProgressContext(): GalaxyProgressContextValue {
  const context = useContext(GalaxyProgressContext);
  if (!context) {
    throw new Error('useGalaxyProgressContext must be used within GalaxyProgressProvider');
  }
  return context;
}

export function useGalaxyProgressState(): ModuleProgressUIState | null {
  return useContext(GalaxyProgressContext)?.progress ?? null;
}

export { GalaxyProgressContext };
