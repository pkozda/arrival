'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  clearLegacyThemeStorage,
  ensureSession,
  fetchModuleCatalog,
  fetchTranslations,
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
  submitMutation as submitMutationRequest,
  buildHeaderLanguageMutation,
  buildHeaderThemeMutation,
} from '@/lib/mutations';
import { selectAppDisplayLanguage } from '@/lib/user-context';
import {
  readStoredDisplayLanguage,
  writeStoredDisplayLanguage,
} from '@/lib/i18n/display-language';
import { getRuntimeConsistencyModel } from '@/lib/runtime/runtimeConsistencyModel';
import {
  RuntimeConsistencyProvider,
  useRuntimeConsistency,
} from '@/lib/runtime/RuntimeConsistencyProvider';
import { EconomicRealityPlanProvider } from '@/lib/economic-reality';
import { BootstrapGate } from '@/components/BootstrapGate';
import { ProfileLoadErrorBanner } from '@/components/ProfileLoadErrorBanner';
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
  bootstrapLoading: boolean;
  bootstrapError: string | null;
  retryBootstrap: () => Promise<void>;
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

const AppContext = createContext<AppState | null>(null);

type ShellState = {
  sessionId: string | null;
  setSessionId: (sessionId: string) => void;
  modules: PublicModuleContract[];
  modulesLoading: boolean;
  modulesError: string | null;
  translations: Record<string, string>;
  setTranslations: (translations: Record<string, string>) => void;
  bootstrapLoading: boolean;
  bootstrapError: string | null;
  retryBootstrap: () => Promise<void>;
};

const ShellContext = createContext<ShellState | null>(null);

function useShell(): ShellState {
  const shell = useContext(ShellContext);
  if (!shell) {
    throw new Error('useShell must be used within AppProvider');
  }
  return shell;
}

function AppProviderSessionLayer({ children }: { children: ReactNode }) {
  const shell = useShell();
  const consistency = useRuntimeConsistency();

  const themePreference = useMemo(
    () => getThemePreference(consistency.uiSnapshot),
    [consistency.uiSnapshot]
  );
  const sessionLanguage = useMemo(
    () => getSessionLanguage(consistency.uiSnapshot),
    [consistency.uiSnapshot]
  );
  const derivedLanguage = useMemo(
    () => selectAppDisplayLanguage(consistency.userContext, sessionLanguage),
    [consistency.userContext, sessionLanguage]
  );
  const languageRef = useRef<SupportedLanguage>('en');
  const [clientLocaleReady, setClientLocaleReady] = useState(false);
  const language = useMemo(() => {
    const bootstrapping =
      !clientLocaleReady ||
      (consistency.userContext === null &&
        consistency.uiSnapshot === null &&
        (consistency.userContextLoading || consistency.uiSnapshotLoading));

    if (!bootstrapping) {
      languageRef.current = derivedLanguage;
      writeStoredDisplayLanguage(derivedLanguage);
    }

    return languageRef.current;
  }, [
    derivedLanguage,
    clientLocaleReady,
    consistency.userContext,
    consistency.uiSnapshot,
    consistency.userContextLoading,
    consistency.uiSnapshotLoading,
  ]);

  useEffect(() => {
    const stored = readStoredDisplayLanguage();
    if (stored) {
      languageRef.current = stored;
    }
    setClientLocaleReady(true);
  }, []);
  const theme: ResolvedTheme = 'dark';

  useEffect(() => {
    document.documentElement.dataset.theme = 'dark';
  }, []);

  useEffect(() => {
    const bundled = getTranslations(language);
    fetchTranslations(language)
      .then((fetched) => shell.setTranslations({ ...bundled, ...fetched }))
      .catch(() => shell.setTranslations(bundled));
  }, [language, shell.setTranslations]);

  const refreshSessionState = useCallback(
    () => consistency.requestSync('FULL'),
    [consistency]
  );

  const refreshProfileScope = useCallback(
    () => consistency.requestSync('PROFILE'),
    [consistency]
  );

  const resetUserData = useCallback(
    async (scope: DevResetScope = 'session') => {
      const newSessionId = await resetDevUserData({
        scope,
        sessionId: shell.sessionId,
        language,
        theme: themePreference,
      });
      shell.setSessionId(newSessionId);
    },
    [shell, language, themePreference]
  );

  const loadDemoPreset = useCallback(
    async (presetId: DemoPersonaId) => {
      if (!shell.sessionId) {
        throw new Error('Session not ready');
      }
      await loadDemoPresetRequest(shell.sessionId, presetId);
      await consistency.requestSync('FULL');
    },
    [shell.sessionId, consistency]
  );

  const submitMutation = useCallback(
    async (request: MutationRequest): Promise<{ userContext: UserContextV1; revision: number }> => {
      if (!shell.sessionId) {
        throw new Error('Session is not ready');
      }

      const result = await submitMutationRequest(request, shell.sessionId);
      await getRuntimeConsistencyModel().ingest({
        type: 'PROFILE_MUTATED',
        revision: result.revision,
        userContext: result.userContext,
      });
      return result;
    },
    [shell.sessionId]
  );

  const changeLanguage = useCallback(
    async (lang: SupportedLanguage) => {
      if (!shell.sessionId) return;
      languageRef.current = lang;
      writeStoredDisplayLanguage(lang);
      await submitMutation(buildHeaderLanguageMutation(lang));
      await updateSessionLanguage(shell.sessionId, lang);
      await consistency.requestSync('FULL');
    },
    [shell.sessionId, submitMutation, consistency]
  );

  const changeTheme = useCallback(
    async (next: ThemePreference) => {
      if (!shell.sessionId) return;
      await submitMutation(buildHeaderThemeMutation(next));
      await updateSessionTheme(shell.sessionId, next);
      await consistency.requestSync('PROFILE');
    },
    [shell.sessionId, submitMutation, consistency]
  );

  const toggleTheme = useCallback(async () => {
    /* Platform uses a single atlas dark theme. */
  }, []);

  const t = useCallback(
    (key: string) => shell.translations[key] ?? getTranslations(language)[key] ?? key,
    [shell.translations, language]
  );

  const contextValue = useMemo(
    () => ({
      language,
      theme,
      themePreference,
      sessionId: shell.sessionId,
      modules: shell.modules,
      modulesLoading: shell.modulesLoading,
      modulesError: shell.modulesError,
      bootstrapLoading: shell.bootstrapLoading,
      bootstrapError: shell.bootstrapError,
      retryBootstrap: shell.retryBootstrap,
      userContext: consistency.userContext,
      userContextLoading: consistency.userContextLoading,
      userContextError: consistency.userContextError,
      profileInsights: consistency.profileInsights,
      profileInsightsLoading: consistency.profileInsightsLoading,
      profileInsightsError: consistency.profileInsightsError,
      lifeEventPlan: consistency.lifeEventPlan,
      lifeEventPlanLoading: consistency.lifeEventPlanLoading,
      lifeEventPlanError: consistency.lifeEventPlanError,
      uiSnapshot: consistency.uiSnapshot,
      uiSnapshotLoading: consistency.uiSnapshotLoading,
      uiSnapshotError: consistency.uiSnapshotError,
      translations: shell.translations,
      refreshUserContext: refreshProfileScope,
      refreshProfileInsights: refreshProfileScope,
      refreshLifeEventPlan: refreshProfileScope,
      refreshUiSnapshot: refreshProfileScope,
      refreshSessionState,
      resetUserData,
      loadDemoPreset,
      submitMutation,
      profileHeadRevision: consistency.profileHeadRevision,
      changeLanguage,
      changeTheme,
      toggleTheme,
      t,
    }),
    [
      language,
      theme,
      themePreference,
      shell.sessionId,
      shell.modules,
      shell.modulesLoading,
      shell.modulesError,
      shell.bootstrapLoading,
      shell.bootstrapError,
      shell.retryBootstrap,
      shell.translations,
      consistency.userContext,
      consistency.userContextLoading,
      consistency.userContextError,
      consistency.profileInsights,
      consistency.profileInsightsLoading,
      consistency.profileInsightsError,
      consistency.lifeEventPlan,
      consistency.lifeEventPlanLoading,
      consistency.lifeEventPlanError,
      consistency.uiSnapshot,
      consistency.uiSnapshotLoading,
      consistency.uiSnapshotError,
      consistency.profileHeadRevision,
      refreshProfileScope,
      refreshSessionState,
      resetUserData,
      loadDemoPreset,
      submitMutation,
      changeLanguage,
      changeTheme,
      toggleTheme,
      t,
    ]
  );

  return (
    <AppContext.Provider value={contextValue}>
      <EconomicRealityPlanProvider>{children}</EconomicRealityPlanProvider>
    </AppContext.Provider>
  );
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [modules, setModules] = useState<PublicModuleContract[]>([]);
  const [modulesLoading, setModulesLoading] = useState(true);
  const [modulesError, setModulesError] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  const retryBootstrap = useCallback(async () => {
    setBootstrapLoading(true);
    setBootstrapError(null);

    try {
      const id = await ensureSession({
        userProfile: {
          language: readStoredDisplayLanguage() ?? 'en',
          uiPreferences: { theme: 'dark' },
        },
      });
      setSessionId(id);
    } catch (error) {
      setBootstrapError(error instanceof Error ? error.message : 'Failed to start session');
    } finally {
      setBootstrapLoading(false);
    }
  }, []);

  useEffect(() => {
    clearLegacyThemeStorage();
  }, []);

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
    void retryBootstrap();
  }, [retryBootstrap]);

  const shellValue = useMemo<ShellState>(
    () => ({
      sessionId,
      setSessionId,
      modules,
      modulesLoading,
      modulesError,
      translations,
      setTranslations,
      bootstrapLoading,
      bootstrapError,
      retryBootstrap,
    }),
    [
      sessionId,
      modules,
      modulesLoading,
      modulesError,
      translations,
      bootstrapLoading,
      bootstrapError,
      retryBootstrap,
    ]
  );

  return (
    <ShellContext.Provider value={shellValue}>
      <RuntimeConsistencyProvider sessionId={sessionId}>
        <BootstrapGate
          bootstrapLoading={bootstrapLoading}
          bootstrapError={bootstrapError}
          retryBootstrap={retryBootstrap}
        >
          <AppProviderSessionLayer>
            <ProfileLoadErrorBanner />
            {children}
          </AppProviderSessionLayer>
        </BootstrapGate>
      </RuntimeConsistencyProvider>
    </ShellContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
