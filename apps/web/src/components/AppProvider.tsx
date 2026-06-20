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
import {
  fetchUserContext,
  submitMutation as submitMutationRequest,
  buildHeaderLanguageMutation,
  buildHeaderThemeMutation,
} from '@/lib/mutations';
import { selectAppDisplayLanguage } from '@/lib/user-context';
import { fetchProfileInsights } from '@/lib/profile-insights';
import type {
  MutationRequest,
  ProfileInsightViewV1,
  PublicModuleContract,
  SupportedLanguage,
  ThemePreference,
  UiSnapshot,
  UserContextV1,
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
  userContext: UserContextV1 | null;
  userContextLoading: boolean;
  userContextError: string | null;
  profileInsights: ProfileInsightViewV1 | null;
  profileInsightsLoading: boolean;
  profileInsightsError: string | null;
  uiSnapshot: UiSnapshot | null;
  uiSnapshotLoading: boolean;
  uiSnapshotError: string | null;
  translations: Record<string, string>;
  refreshUserContext: () => Promise<void>;
  refreshProfileInsights: () => Promise<void>;
  refreshUiSnapshot: () => Promise<void>;
  refreshSessionState: () => Promise<void>;
  submitMutation: (request: MutationRequest) => Promise<{ userContext: UserContextV1; revision: number }>;
  profileHeadRevision: number;
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
  const [userContext, setUserContext] = useState<UserContextV1 | null>(null);
  const [userContextLoading, setUserContextLoading] = useState(true);
  const [userContextError, setUserContextError] = useState<string | null>(null);
  const [profileInsights, setProfileInsights] = useState<ProfileInsightViewV1 | null>(null);
  const [profileInsightsLoading, setProfileInsightsLoading] = useState(true);
  const [profileInsightsError, setProfileInsightsError] = useState<string | null>(null);
  const [uiSnapshot, setUiSnapshot] = useState<UiSnapshot | null>(null);
  const [uiSnapshotLoading, setUiSnapshotLoading] = useState(true);
  const [uiSnapshotError, setUiSnapshotError] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [profileHeadRevision, setProfileHeadRevision] = useState(0);

  const lastAppliedSnapshotVersionRef = useRef(-1);
  const snapshotFetchGenerationRef = useRef(0);
  const userContextFetchGenerationRef = useRef(0);
  const profileInsightsFetchGenerationRef = useRef(0);

  const themePreference = useMemo(() => getThemePreference(uiSnapshot), [uiSnapshot]);
  const systemTheme = useSystemColorScheme();
  const sessionLanguage = useMemo(() => getSessionLanguage(uiSnapshot), [uiSnapshot]);
  const language = useMemo(
    () => selectAppDisplayLanguage(userContext, sessionLanguage),
    [userContext, sessionLanguage]
  );
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

  const refreshUserContext = useCallback(async () => {
    if (!sessionId) return;

    const requestId = ++userContextFetchGenerationRef.current;

    setUserContextLoading(true);
    setUserContextError(null);

    try {
      const context = await fetchUserContext(sessionId);
      if (requestId !== userContextFetchGenerationRef.current) {
        return;
      }
      setUserContext(context);
    } catch (err: unknown) {
      if (requestId !== userContextFetchGenerationRef.current) {
        return;
      }
      setUserContextError(err instanceof Error ? err.message : 'Failed to load your situation');
    } finally {
      if (requestId === userContextFetchGenerationRef.current) {
        setUserContextLoading(false);
      }
    }
  }, [sessionId]);

  const refreshProfileInsights = useCallback(async () => {
    if (!sessionId) return;

    const requestId = ++profileInsightsFetchGenerationRef.current;

    setProfileInsightsLoading(true);
    setProfileInsightsError(null);

    try {
      const insights = await fetchProfileInsights(sessionId);
      if (requestId !== profileInsightsFetchGenerationRef.current) {
        return;
      }
      setProfileInsights(insights);
    } catch (err: unknown) {
      if (requestId !== profileInsightsFetchGenerationRef.current) {
        return;
      }
      setProfileInsightsError(err instanceof Error ? err.message : 'Failed to load situation insights');
    } finally {
      if (requestId === profileInsightsFetchGenerationRef.current) {
        setProfileInsightsLoading(false);
      }
    }
  }, [sessionId]);

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
      setUiSnapshotError(err instanceof Error ? err.message : 'Failed to refresh your situation');
    } finally {
      if (requestId === snapshotFetchGenerationRef.current) {
        setUiSnapshotLoading(false);
      }
    }
  }, [sessionId, applySnapshotIfNewer]);

  const refreshSessionState = useCallback(async () => {
    await Promise.all([refreshUserContext(), refreshProfileInsights(), refreshUiSnapshot()]);
  }, [refreshUserContext, refreshProfileInsights, refreshUiSnapshot]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let cancelled = false;

    setUserContextLoading(true);
    setProfileInsightsLoading(true);
    setUiSnapshotLoading(true);
    setUserContextError(null);
    setProfileInsightsError(null);
    setUiSnapshotError(null);

    const userContextRequestId = ++userContextFetchGenerationRef.current;
    const profileInsightsRequestId = ++profileInsightsFetchGenerationRef.current;
    const snapshotRequestId = ++snapshotFetchGenerationRef.current;

    Promise.all([
      fetchUserContext(sessionId),
      fetchProfileInsights(sessionId),
      fetchUiSnapshot(sessionId),
    ])
      .then(([context, insights, snapshot]) => {
        if (cancelled) {
          return;
        }
        if (userContextRequestId === userContextFetchGenerationRef.current) {
          setUserContext(context);
          setUserContextLoading(false);
        }
        if (profileInsightsRequestId === profileInsightsFetchGenerationRef.current) {
          setProfileInsights(insights);
          setProfileInsightsLoading(false);
        }
        if (snapshotRequestId === snapshotFetchGenerationRef.current) {
          applySnapshotIfNewer(snapshot);
          setUiSnapshotLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        const message = err instanceof Error ? err.message : 'Failed to load your situation';
        if (userContextRequestId === userContextFetchGenerationRef.current) {
          setUserContext(null);
          setUserContextError(message);
          setUserContextLoading(false);
        }
        if (profileInsightsRequestId === profileInsightsFetchGenerationRef.current) {
          setProfileInsights(null);
          setProfileInsightsError(message);
          setProfileInsightsLoading(false);
        }
        if (snapshotRequestId === snapshotFetchGenerationRef.current) {
          setUiSnapshot(null);
          setUiSnapshotError(message);
          setUiSnapshotLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, applySnapshotIfNewer]);

  useEffect(() => {
    fetchTranslations(language).then(setTranslations).catch(console.error);
  }, [language]);

  const submitMutation = useCallback(
    async (request: MutationRequest): Promise<{ userContext: UserContextV1; revision: number }> => {
      if (!sessionId) {
        throw new Error('Session is not ready');
      }

      const result = await submitMutationRequest(request, sessionId);
      setUserContext(result.userContext);
      setProfileHeadRevision(result.revision);
      void refreshProfileInsights();
      return result;
    },
    [sessionId, refreshProfileInsights]
  );

  const changeLanguage = useCallback(
    async (lang: SupportedLanguage) => {
      if (!sessionId) return;
      await submitMutation(buildHeaderLanguageMutation(lang));
      await updateSessionLanguage(sessionId, lang);
      await refreshUiSnapshot();
    },
    [sessionId, submitMutation, refreshUiSnapshot]
  );

  const changeTheme = useCallback(
    async (next: ThemePreference) => {
      if (!sessionId) return;
      await submitMutation(buildHeaderThemeMutation(next));
      await updateSessionTheme(sessionId, next);
      await refreshUiSnapshot();
    },
    [sessionId, submitMutation, refreshUiSnapshot]
  );

  const toggleTheme = useCallback(async () => {
    const next: ThemePreference = theme === 'dark' ? 'light' : 'dark';
    await changeTheme(next);
  }, [theme, changeTheme]);

  const t = useCallback(
    (key: string) => translations[key] ?? key,
    [translations]
  );

  return (
    <AppContext.Provider
      value={{
        language,
        theme,
        themePreference,
        sessionId,
        modules,
        modulesLoading,
        modulesError,
        userContext,
        userContextLoading,
        userContextError,
        profileInsights,
        profileInsightsLoading,
        profileInsightsError,
        uiSnapshot,
        uiSnapshotLoading,
        uiSnapshotError,
        translations,
        refreshUserContext,
        refreshProfileInsights,
        refreshUiSnapshot,
        refreshSessionState,
        submitMutation,
        profileHeadRevision,
        changeLanguage,
        changeTheme,
        toggleTheme,
        t,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
