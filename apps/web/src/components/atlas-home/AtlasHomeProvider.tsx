'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  ATLAS_DEMO_STORAGE_KEY,
  readAtlasDemoState,
  writeAtlasDemoActive,
} from './atlas-demo-state';

type AtlasHomeDemoContextValue = {
  /** User chose to explore the Atlas demo (nav + member home), not a real account. */
  isExploringAtlas: boolean;
  enterAtlas: () => void;
};

const AtlasHomeDemoContext = createContext<AtlasHomeDemoContextValue | null>(null);

export function AtlasHomeProvider({ children }: { children: ReactNode }) {
  const [isExploringAtlas, setIsExploringAtlas] = useState(readAtlasDemoState);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== ATLAS_DEMO_STORAGE_KEY) {
        return;
      }
      setIsExploringAtlas(event.newValue === '1');
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const enterAtlas = useCallback(() => {
    writeAtlasDemoActive(true);
    setIsExploringAtlas(true);
  }, []);

  const value = useMemo(
    () => ({
      isExploringAtlas,
      enterAtlas,
    }),
    [isExploringAtlas, enterAtlas]
  );

  return <AtlasHomeDemoContext.Provider value={value}>{children}</AtlasHomeDemoContext.Provider>;
}

export function useAtlasHomeDemo(): AtlasHomeDemoContextValue {
  const context = useContext(AtlasHomeDemoContext);
  if (!context) {
    throw new Error('useAtlasHomeDemo must be used within AtlasHomeProvider');
  }
  return context;
}

/** @deprecated Use `useAtlasHomeDemo` — kept for incremental migration only. */
export function useAtlasHomeAuth(): AtlasHomeDemoContextValue {
  return useAtlasHomeDemo();
}
