'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { ensureSession, fetchTranslations, fetchUiSnapshot, type UiSnapshot } from '@/lib/api';
import type { SupportedLanguage } from '@arrivalos/core';

export type Theme = 'light' | 'dark';

interface AppState {
  language: SupportedLanguage;
  theme: Theme;
  sessionId: string | null;
  uiSnapshot: UiSnapshot | null;
  uiSnapshotLoading: boolean;
  uiSnapshotError: string | null;
  translations: Record<string, string>;
  refreshUiSnapshot: () => Promise<void>;
  setLanguage: (lang: SupportedLanguage) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  t: (key: string) => string;
}

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem('arrivalos-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>('en');
  const [theme, setThemeState] = useState<Theme>('dark');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [uiSnapshot, setUiSnapshot] = useState<UiSnapshot | null>(null);
  const [uiSnapshotLoading, setUiSnapshotLoading] = useState(true);
  const [uiSnapshotError, setUiSnapshotError] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});

  const lastAppliedSnapshotVersionRef = useRef(-1);
  const snapshotFetchGenerationRef = useRef(0);

  const applySnapshotIfNewer = useCallback((snapshot: UiSnapshot): boolean => {
    if (snapshot.snapshotVersion > lastAppliedSnapshotVersionRef.current) {
      lastAppliedSnapshotVersionRef.current = snapshot.snapshotVersion;
      setUiSnapshot(snapshot);
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    setThemeState(getInitialTheme());
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('arrivalos-theme', theme);
  }, [theme]);

  useEffect(() => {
    ensureSession({ userProfile: { language } })
      .then(setSessionId)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const requestId = ++snapshotFetchGenerationRef.current;
    let cancelled = false;

    setUiSnapshotLoading(true);
    setUiSnapshotError(null);

    fetchUiSnapshot(sessionId)
      .then((snapshot) => {
        if (cancelled || requestId !== snapshotFetchGenerationRef.current) {
          return;
        }
        applySnapshotIfNewer(snapshot);
        setUiSnapshotLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled || requestId !== snapshotFetchGenerationRef.current) {
          return;
        }
        setUiSnapshot(null);
        setUiSnapshotError(err instanceof Error ? err.message : 'Failed to load snapshot');
        setUiSnapshotLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, applySnapshotIfNewer]);

  useEffect(() => {
    fetchTranslations(language).then(setTranslations).catch(console.error);
  }, [language]);

  const refreshUiSnapshot = useCallback(async () => {
    if (!sessionId) return;

    const requestId = ++snapshotFetchGenerationRef.current;

    setUiSnapshotLoading(true);
    setUiSnapshotError(null);

    try {
      const snapshot = await fetchUiSnapshot(sessionId);
      if (requestId !== snapshotFetchGenerationRef.current) {
        return;
      }
      applySnapshotIfNewer(snapshot);
    } catch (err: unknown) {
      if (requestId !== snapshotFetchGenerationRef.current) {
        return;
      }
      setUiSnapshotError(err instanceof Error ? err.message : 'Failed to refresh snapshot');
      // Degrade gracefully: keep existing snapshot and version cursor.
    } finally {
      if (requestId === snapshotFetchGenerationRef.current) {
        setUiSnapshotLoading(false);
      }
    }
  }, [sessionId, applySnapshotIfNewer]);

  const setLanguage = useCallback((lang: SupportedLanguage) => {
    setLanguageState(lang);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  const t = useCallback(
    (key: string) => translations[key] ?? key,
    [translations]
  );

  return (
    <AppContext.Provider value={{
      language,
      theme,
      sessionId,
      uiSnapshot,
      uiSnapshotLoading,
      uiSnapshotError,
      translations,
      refreshUiSnapshot,
      setLanguage,
      setTheme,
      toggleTheme,
      t,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
