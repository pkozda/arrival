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

const STORAGE_KEY = 'arrival_atlas_home_authenticated';

type AtlasHomeAuthContextValue = {
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
};

const AtlasHomeAuthContext = createContext<AtlasHomeAuthContextValue | null>(null);

export function AtlasHomeProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    setIsAuthenticated(stored === '1');
    setHydrated(true);
  }, []);

  const login = useCallback(() => {
    setIsAuthenticated(true);
    sessionStorage.setItem(STORAGE_KEY, '1');
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({ isAuthenticated: hydrated && isAuthenticated, login, logout }),
    [hydrated, isAuthenticated, login, logout]
  );

  return <AtlasHomeAuthContext.Provider value={value}>{children}</AtlasHomeAuthContext.Provider>;
}

export function useAtlasHomeAuth(): AtlasHomeAuthContextValue {
  const context = useContext(AtlasHomeAuthContext);
  if (!context) {
    throw new Error('useAtlasHomeAuth must be used within AtlasHomeProvider');
  }
  return context;
}
