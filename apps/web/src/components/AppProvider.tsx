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
  resetDevUserData,
  type DevResetScope,
} from '@/lib/dev-tools/reset-user-data';
import { loadDemoPreset as loadDemoPresetRequest } from '@/lib/demo/load-demo-preset';
import type { DemoPersonaId } from '@arrival-atlas/life-event-demo/personas';
import {
  fetchUserContext,
  submitMutation as submitMutationRequest,
  buildHeaderLanguageMutation,
  buildHeaderThemeMutation,
} from '@/lib/mutations';
import { selectAppDisplayLanguage } from '@/lib/user-context';
import { fetchProfileInsights } from '@/lib/profile-insights';
import { fetchLifeEventPlan } from '@/lib/life-event-plan';
import type {
  MutationRequest,
  ProfileInsightViewV1,
  LifeEventPlanV1,
  PublicModuleContract,
  SupportedLanguage,
  ThemePreference,
  UiSnapshot,
  UserContextV1,
} from '@/lib/product-contract';
import { getTranslations } from '@arrival-atlas/core';
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
  lifeEventPlan: LifeEventPlanV1 | null;
  lifeEventPlanLoading: boolean;
  lifeEventPlanError: string | null;
  uiSnapshot: UiSnapshot | null;
  uiSnapshotLoading: boolean;
  uiSnapshotError: string | null;
  translations: Record<string, string>;
  refreshUserContext: () => Promise<void>;
  refreshProfileInsights: () => Promise<void>;
  refreshLifeEventPlan: () => Promise<void>;
  refreshUiSnapshot: () => Promise<void>;
  refreshSessionState: () => Promise<void>;
  resetUserData: (scope?: DevResetScope) => Promise<void>;
  loadDemoPreset: (presetId: DemoPersonaId) => Promise<void>;
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
  const [lifeEventPlan, setLifeEventPlan] = useState<LifeEventPlanV1 | null>(null);
  const [lifeEventPlanLoading, setLifeEventPlanLoading] = useState(true);
  const [lifeEventPlanError, setLifeEventPlanError] = useState<string | null>(null);
  const [uiSnapshot, setUiSnapshot] = useState<UiSnapshot | null>(null);
  const [uiSnapshotLoading, setUiSnapshotLoading] = useState(true);
  const [uiSnapshotError, setUiSnapshotError] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [profileHeadRevision, setProfileHeadRevision] = useState(0);

  const lastAppliedSnapshotVersionRef = useRef(-1);
  const snapshotFetchGenerationRef = useRef(0);
  const userContextFetchGenerationRef = useRef(0);
  const profileInsightsFetchGenerationRef = useRef(0);
  const lifeEventPlanFetchGenerationRef = useRef(0);

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

  const refreshLifeEventPlan = useCallback(async () => {
    if (!sessionId) return;

    const requestId = ++lifeEventPlanFetchGenerationRef.current;

    setLifeEventPlanLoading(true);
    setLifeEventPlanError(null);

    try {
      const plan = await fetchLifeEventPlan(sessionId);
      if (requestId !== lifeEventPlanFetchGenerationRef.current) {
        return;
      }
      setLifeEventPlan(plan);
    } catch (err: unknown) {
      if (requestId !== lifeEventPlanFetchGenerationRef.current) {
        return;
      }
      setLifeEventPlan(null);
      setLifeEventPlanError(
        err instanceof Error ? err.message : 'Failed to load your next steps plan'
      );
    } finally {
      if (requestId === lifeEventPlanFetchGenerationRef.current) {
        setLifeEventPlanLoading(false);
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
    await Promise.all([refreshUserContext(), refreshProfileInsights(), refreshLifeEventPlan(), refreshUiSnapshot()]);
  }, [refreshUserContext, refreshProfileInsights, refreshLifeEventPlan, refreshUiSnapshot]);

  const resetUserData = useCallback(
    async (scope: DevResetScope = 'session') => {
      const newSessionId = await resetDevUserData({
        scope,
        sessionId,
        language,
        theme: themePreference,
      });

      lastAppliedSnapshotVersionRef.current = -1;
      setProfileHeadRevision(0);
      setUserContext(null);
      setProfileInsights(null);
      setLifeEventPlan(null);
      setUiSnapshot(null);
      setSessionId(newSessionId);
    },
    [sessionId, language, themePreference]
  );

  const loadDemoPreset = useCallback(
    async (presetId: DemoPersonaId) => {
      if (!sessionId) {
        throw new Error('Session not ready');
      }

      await loadDemoPresetRequest(sessionId, presetId);
      lastAppliedSnapshotVersionRef.current = -1;
      await refreshSessionState();
    },
    [sessionId, refreshSessionState]
  );

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let cancelled = false;

    setUserContextLoading(true);
    setProfileInsightsLoading(true);
    setLifeEventPlanLoading(true);
    setUiSnapshotLoading(true);
    setUserContextError(null);
    setProfileInsightsError(null);
    setLifeEventPlanError(null);
    setUiSnapshotError(null);

    const userContextRequestId = ++userContextFetchGenerationRef.current;
    const profileInsightsRequestId = ++profileInsightsFetchGenerationRef.current;
    const lifeEventPlanRequestId = ++lifeEventPlanFetchGenerationRef.current;
    const snapshotRequestId = ++snapshotFetchGenerationRef.current;

    void Promise.allSettled([
      fetchUserContext(sessionId),
      fetchProfileInsights(sessionId),
      fetchLifeEventPlan(sessionId),
      fetchUiSnapshot(sessionId),
    ]).then((results) => {
      if (cancelled) {
        return;
      }

      const [contextResult, insightsResult, planResult, snapshotResult] = results;

      if (userContextRequestId === userContextFetchGenerationRef.current) {
        if (contextResult.status === 'fulfilled') {
          setUserContext(contextResult.value);
          setUserContextError(null);
        } else {
          setUserContext(null);
          setUserContextError(
            contextResult.reason instanceof Error
              ? contextResult.reason.message
              : 'Failed to load your situation'
          );
        }
        setUserContextLoading(false);
      }

      if (profileInsightsRequestId === profileInsightsFetchGenerationRef.current) {
        if (insightsResult.status === 'fulfilled') {
          setProfileInsights(insightsResult.value);
          setProfileInsightsError(null);
        } else {
          setProfileInsights(null);
          setProfileInsightsError(
            insightsResult.reason instanceof Error
              ? insightsResult.reason.message
              : 'Failed to load situation insights'
          );
        }
        setProfileInsightsLoading(false);
      }

      if (lifeEventPlanRequestId === lifeEventPlanFetchGenerationRef.current) {
        if (planResult.status === 'fulfilled') {
          setLifeEventPlan(planResult.value);
          setLifeEventPlanError(null);
        } else {
          setLifeEventPlan(null);
          setLifeEventPlanError(
            planResult.reason instanceof Error
              ? planResult.reason.message
              : 'Failed to load your next steps plan'
          );
        }
        setLifeEventPlanLoading(false);
      }

      if (snapshotRequestId === snapshotFetchGenerationRef.current) {
        if (snapshotResult.status === 'fulfilled') {
          applySnapshotIfNewer(snapshotResult.value);
          setUiSnapshotError(null);
        } else {
          setUiSnapshot(null);
          setUiSnapshotError(
            snapshotResult.reason instanceof Error
              ? snapshotResult.reason.message
              : 'Failed to refresh your situation'
          );
        }
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
      void refreshLifeEventPlan();
      return result;
    },
    [sessionId, refreshProfileInsights, refreshLifeEventPlan]
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
    (key: string) => translations[key] ?? getTranslations('en')[key] ?? key,
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
        lifeEventPlan,
        lifeEventPlanLoading,
        lifeEventPlanError,
        uiSnapshot,
        uiSnapshotLoading,
        uiSnapshotError,
        translations,
        refreshUserContext,
        refreshProfileInsights,
        refreshLifeEventPlan,
        refreshUiSnapshot,
        refreshSessionState,
        resetUserData,
        loadDemoPreset,
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
