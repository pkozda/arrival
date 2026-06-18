'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  clearLegacyThemeStorage,
  ensureSession,
  fetchModuleCatalog,
  fetchTranslations,
  fetchUiSnapshot,
  updateSessionLanguage,
  updateSessionTheme,
} from '@/lib/api';
import type {
  PublicModuleContract,
  SupportedLanguage,
  ThemePreference,
  UiSnapshot,
} from '@/lib/product-contract';
import {
  getSessionLanguage,
  getThemePreference,
  resolveTheme,
  type ResolvedTheme,
} from '@/lib/snapshot';

interface AppState {
  language: SupportedLanguage;
  theme: ResolvedTheme;
  themePreference: ThemePreference;
  sessionId: string | null;
  modules: PublicModuleContract[];
  modulesLoading: boolean;
  modulesError: string | null;
  uiSnapshot: UiSnapshot | null;
  uiSnapshotLoading: boolean;
  uiSnapshotError: string | null;
  translations: Record<string, string>;
  refreshUiSnapshot: () => Promise<void>;
  changeLanguage: (lang: SupportedLanguage) => Promise<void>;
  changeTheme: (theme: ThemePreference) => Promise<void>;
  toggleTheme: () => Promise<void>;
  t: (key: string) => string;
}

function subscribeSystemColorScheme(onStoreChange: () => void): () => void {
  const media = window.matchMedia('(prefers-color-scheme: light)');
  media.addEventListener('change', onStoreChange);
  return () => media.removeEventListener('change', onStoreChange);
}

function getSystemColorSchemeSnapshot(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function useSystemColorScheme(): ResolvedTheme {
  return useSyncExternalStore(
    subscribeSystemColorScheme,
    getSystemColorSchemeSnapshot,
    () => 'light'
  );
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [modules, setModules] = useState<PublicModuleContract[]>([]);
  const [modulesLoading, setModulesLoading] = useState(true);
  const [modulesError, setModulesError] = useState<string | null>(null);
  const [uiSnapshot, setUiSnapshot] = useState<UiSnapshot | null>(null);
  const [uiSnapshotLoading, setUiSnapshotLoading] = useState(true);
  const [uiSnapshotError, setUiSnapshotError] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});

  const lastAppliedSnapshotVersionRef = useRef(-1);
  const snapshotFetchGenerationRef = useRef(0);

  const language = useMemo(() => getSessionLanguage(uiSnapshot), [uiSnapshot]);
  const themePreference = useMemo(() => getThemePreference(uiSnapshot), [uiSnapshot]);
  const systemTheme = useSystemColorScheme();
  const theme = useMemo(
    () => (themePreference === 'system' ? systemTheme : resolveTheme(themePreference)),
    [themePreference, systemTheme]
  );

  const applySnapshotIfNewer = useCallback((snapshot: UiSnapshot): boolean => {
    if (snapshot.snapshotVersion > lastAppliedSnapshotVersionRef.current) {
      lastAppliedSnapshotVersionRef.current = snapshot.snapshotVersion;
      setUiSnapshot(snapshot);
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    clearLegacyThemeStorage();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    let cancelled = false;

    fetchModuleCatalog()
      .then((catalog) => {
        if (!cancelled) {
          setModules(catalog);
          setModulesLoading(false);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setModulesError(error instanceof Error ? error.message : 'Failed to load module catalog');
          setModulesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    ensureSession({
      userProfile: {
        language: 'en',
        uiPreferences: { theme: 'light' },
      },
    })
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
    } finally {
      if (requestId === snapshotFetchGenerationRef.current) {
        setUiSnapshotLoading(false);
      }
    }
  }, [sessionId, applySnapshotIfNewer]);

  const changeLanguage = useCallback(async (lang: SupportedLanguage) => {
    if (!sessionId) return;
    await updateSessionLanguage(sessionId, lang);
    await refreshUiSnapshot();
  }, [sessionId, refreshUiSnapshot]);

  const changeTheme = useCallback(async (next: ThemePreference) => {
    if (!sessionId) return;
    await updateSessionTheme(sessionId, next);
    await refreshUiSnapshot();
  }, [sessionId, refreshUiSnapshot]);

  const toggleTheme = useCallback(async () => {
    const next: ThemePreference = theme === 'dark' ? 'light' : 'dark';
    await changeTheme(next);
  }, [theme, changeTheme]);

  const t = useCallback(
    (key: string) => translations[key] ?? key,
    [translations]
  );

  return (
    <AppContext.Provider value={{
      language,
      theme,
      themePreference,
      sessionId,
      modules,
      modulesLoading,
      modulesError,
      uiSnapshot,
      uiSnapshotLoading,
      uiSnapshotError,
      translations,
      refreshUiSnapshot,
      changeLanguage,
      changeTheme,
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
