import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupportedLanguage } from '@/lib/product-contract';
import {
  DISPLAY_LANGUAGE_STORAGE_KEY,
  toDocumentLanguageTag,
} from '@/lib/i18n/display-language';

const localeState = vi.hoisted(() => ({
  derived: 'en' as SupportedLanguage,
}));

const {
  ensureSessionMock,
  updateSessionLanguageMock,
  submitMutationMock,
} = vi.hoisted(() => ({
  ensureSessionMock: vi.fn(),
  updateSessionLanguageMock: vi.fn(),
  submitMutationMock: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  clearLegacyThemeStorage: vi.fn(),
  ensureSession: ensureSessionMock,
  fetchModuleCatalog: vi.fn().mockResolvedValue([]),
  fetchTranslations: vi.fn().mockResolvedValue({}),
  updateSessionLanguage: updateSessionLanguageMock,
  updateSessionTheme: vi.fn(),
}));

vi.mock('@/lib/journey-guide/storage', () => ({
  clearJourneyGuideState: vi.fn(),
}));

vi.mock('@/components/BootstrapGate', () => ({
  BootstrapGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ProfileLoadErrorBanner', () => ({
  ProfileLoadErrorBanner: () => null,
}));

vi.mock('@/components/SessionRecreatedNotice', () => ({
  SessionRecreatedNotice: () => null,
}));

vi.mock('@/components/arrival/ArrivalWelcomeGate', () => ({
  ArrivalWelcomeGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/runtime/RuntimeConsistencyProvider', () => ({
  RuntimeConsistencyProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useRuntimeConsistency: () => ({
    userContext: { profile: { preferences: {} } },
    userContextLoading: false,
    userContextError: null,
    profileInsights: null,
    profileInsightsLoading: false,
    profileInsightsError: null,
    lifeEventPlan: null,
    lifeEventPlanLoading: false,
    lifeEventPlanError: null,
    uiSnapshot: { session: { language: localeState.derived } },
    uiSnapshotLoading: false,
    uiSnapshotError: null,
    profileHeadRevision: 0,
    requestSync: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/lib/dev-tools/reset-user-data', () => ({
  resetDevUserData: vi.fn(),
  resetAtlasSession: vi.fn(),
  adoptAtlasSessionAfterDemoReset: vi.fn((id: string) => id),
  adoptRecreatedSessionId: vi.fn((id: string) => id),
}));

vi.mock('@/components/atlas-home/atlas-demo-state', () => ({
  ATLAS_DEMO_RESET_BROADCAST_KEY: 'arrival_atlas_demo_reset_at',
  broadcastAtlasDemoReset: vi.fn(),
  writeAtlasDemoActive: vi.fn(),
  attemptAcquireResetOwnership: vi.fn().mockReturnValue(false),
  clearResetOwnershipLock: vi.fn(),
  getDemoResetTabId: vi.fn().mockReturnValue('tab-1'),
  readResetOwnershipLock: vi.fn().mockReturnValue(null),
  waitForDemoResetBroadcastCompletion: vi.fn(),
  parseAtlasDemoResetBroadcast: vi.fn().mockReturnValue(null),
}));

vi.mock('@/lib/demo/load-demo-preset', () => ({
  loadDemoPreset: vi.fn(),
}));

vi.mock('@/lib/mutations', () => ({
  submitMutation: submitMutationMock,
  buildHeaderLanguageMutation: vi.fn().mockReturnValue({}),
  buildHeaderThemeMutation: vi.fn(),
}));

vi.mock('@/lib/user-context', () => ({
  selectAppDisplayLanguage: () => localeState.derived,
}));

vi.mock('@/lib/runtime/runtimeConsistencyModel', () => ({
  getRuntimeConsistencyModel: () => ({
    ingest: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/lib/snapshot', () => ({
  getSessionLanguage: () => localeState.derived,
  getThemePreference: () => 'dark',
}));

vi.mock('@arrival-atlas/core', () => ({
  getTranslations: () => ({
    'app.sessionRecreated.title': 'title',
    'app.sessionRecreated.message': 'message',
    'app.sessionRecreated.continue': 'Continue',
  }),
}));

vi.mock('@/lib/economic-reality', () => ({
  EconomicRealityPlanProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/session-recreation-notice', () => ({
  acknowledgeSessionRecreatedNotice: vi.fn(),
  markSessionRecreationNoticePending: vi.fn(),
  shouldOpenSessionRecreatedNotice: vi.fn().mockReturnValue(false),
  broadcastSessionRecreated: vi.fn(),
  parseSessionRecreatedBroadcast: vi.fn().mockReturnValue(null),
  resolveSessionRecreatedBroadcastFollow: vi.fn(),
  SESSION_RECREATED_BROADCAST_KEY: 'arrival_atlas_session_recreated',
}));

import { AppProvider, useApp } from '@/components/AppProvider';

function Probe() {
  const { language, changeLanguage } = useApp();
  return (
    <div
      data-testid="probe"
      data-language={language}
      onClick={() => {
        void changeLanguage('de');
      }}
    />
  );
}

function UaProbe() {
  const { changeLanguage } = useApp();
  return (
    <button
      type="button"
      data-testid="set-ua"
      onClick={() => {
        void changeLanguage('ua');
      }}
    >
      ua
    </button>
  );
}

describe('AppProvider document.documentElement.lang sync', () => {
  let root: Root | null = null;
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    localeState.derived = 'en';
    document.documentElement.lang = 'en';
    ensureSessionMock.mockResolvedValue({ sessionId: 'session-1', outcome: 'existing' });
    updateSessionLanguageMock.mockResolvedValue(undefined);
    submitMutationMock.mockResolvedValue({ revision: 1, userContext: null });

    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    });
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    document.body.innerHTML = '';
    document.documentElement.lang = 'en';
    vi.unstubAllGlobals();
  });

  async function renderApp(child: React.ReactNode) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(<AppProvider>{child}</AppProvider>);
      await Promise.resolve();
      await Promise.resolve();
    });
    return container;
  }

  it('restores html lang from stored display language without Welcome (returning user)', async () => {
    storage.set(DISPLAY_LANGUAGE_STORAGE_KEY, 'ua');
    localeState.derived = 'ua';
    document.documentElement.lang = 'en'; // simulate SSR layout

    await renderApp(<Probe />);

    expect(document.documentElement.lang).toBe('uk');
    expect(document.querySelector('[data-testid="probe"]')?.getAttribute('data-language')).toBe(
      'ua'
    );
  });

  it('restores html lang for German returning users', async () => {
    storage.set(DISPLAY_LANGUAGE_STORAGE_KEY, 'de');
    localeState.derived = 'de';
    document.documentElement.lang = 'en';

    await renderApp(<Probe />);

    expect(document.documentElement.lang).toBe('de');
  });

  it('updates html lang when changeLanguage is called', async () => {
    storage.set(DISPLAY_LANGUAGE_STORAGE_KEY, 'en');
    localeState.derived = 'en';
    document.documentElement.lang = 'en';

    const container = await renderApp(
      <>
        <Probe />
        <UaProbe />
      </>
    );

    expect(document.documentElement.lang).toBe('en');

    await act(async () => {
      localeState.derived = 'de';
      container.querySelector('[data-testid="probe"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(document.documentElement.lang).toBe('de');
    expect(toDocumentLanguageTag('de')).toBe('de');

    await act(async () => {
      localeState.derived = 'ua';
      container.querySelector('[data-testid="set-ua"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true })
      );
      await Promise.resolve();
    });

    expect(document.documentElement.lang).toBe('uk');
  });

  it('re-syncs html lang after a simulated full navigation remount (SSR lang=en)', async () => {
    storage.set(DISPLAY_LANGUAGE_STORAGE_KEY, 'ru');
    localeState.derived = 'ru';

    await renderApp(<Probe />);
    expect(document.documentElement.lang).toBe('ru');

    // Simulate Next.js full navigation: SSR html resets to en, AppProvider remounts.
    document.documentElement.lang = 'en';
    await act(async () => {
      root?.unmount();
      root = null;
      await Promise.resolve();
    });

    await renderApp(<Probe />);
    expect(document.documentElement.lang).toBe('ru');
  });
});
