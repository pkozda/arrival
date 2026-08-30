import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  ensureSessionMock,
  clearJourneyGuideStateMock,
  markSessionRecreationNoticePendingMock,
  shouldOpenSessionRecreatedNoticeMock,
  writeAtlasDemoActiveMock,
} = vi.hoisted(() => ({
  ensureSessionMock: vi.fn(),
  clearJourneyGuideStateMock: vi.fn(),
  markSessionRecreationNoticePendingMock: vi.fn(),
  shouldOpenSessionRecreatedNoticeMock: vi.fn(),
  writeAtlasDemoActiveMock: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  clearLegacyThemeStorage: vi.fn(),
  ensureSession: ensureSessionMock,
  fetchModuleCatalog: vi.fn().mockResolvedValue([]),
  fetchTranslations: vi.fn().mockResolvedValue({}),
  updateSessionLanguage: vi.fn(),
  updateSessionTheme: vi.fn(),
}));

vi.mock('@/lib/journey-guide/storage', () => ({
  clearJourneyGuideState: clearJourneyGuideStateMock,
}));

vi.mock('@/lib/session-recreation-notice', () => ({
  acknowledgeSessionRecreatedNotice: vi.fn(),
  markSessionRecreationNoticePending: markSessionRecreationNoticePendingMock,
  shouldOpenSessionRecreatedNotice: shouldOpenSessionRecreatedNoticeMock,
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

vi.mock('@/lib/runtime/RuntimeConsistencyProvider', () => ({
  RuntimeConsistencyProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useRuntimeConsistency: () => ({
    userContext: null,
    userContextLoading: false,
    userContextError: null,
    profileInsights: null,
    profileInsightsLoading: false,
    profileInsightsError: null,
    lifeEventPlan: null,
    lifeEventPlanLoading: false,
    lifeEventPlanError: null,
    uiSnapshot: null,
    uiSnapshotLoading: false,
    uiSnapshotError: null,
    profileHeadRevision: 0,
    requestSync: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/lib/dev-tools/reset-user-data', () => ({
  resetDevUserData: vi.fn(),
  resetAtlasSession: vi.fn(),
}));

vi.mock('@/components/atlas-home/atlas-demo-state', () => ({
  ATLAS_DEMO_RESET_BROADCAST_KEY: 'arrival_atlas_demo_reset_at',
  broadcastAtlasDemoReset: vi.fn(),
  writeAtlasDemoActive: writeAtlasDemoActiveMock,
}));

vi.mock('@/lib/demo/load-demo-preset', () => ({
  loadDemoPreset: vi.fn(),
}));

vi.mock('@/lib/mutations', () => ({
  submitMutation: vi.fn(),
  buildHeaderLanguageMutation: vi.fn(),
  buildHeaderThemeMutation: vi.fn(),
}));

vi.mock('@/lib/user-context', () => ({
  selectAppDisplayLanguage: () => 'en',
}));

vi.mock('@/lib/i18n/display-language', () => ({
  readStoredDisplayLanguage: () => 'en',
  writeStoredDisplayLanguage: vi.fn(),
  syncDocumentLanguage: vi.fn(),
  toDocumentLanguageTag: (language: string) => (language === 'ua' ? 'uk' : language),
}));

vi.mock('@/lib/runtime/runtimeConsistencyModel', () => ({
  getRuntimeConsistencyModel: () => ({
    ingest: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/lib/snapshot', () => ({
  getSessionLanguage: () => 'en',
  getThemePreference: () => 'dark',
}));

vi.mock('@arrival-atlas/core', () => ({
  getTranslations: () => ({
    'app.sessionRecreated.title': 'A new Atlas session has started',
    'app.sessionRecreated.message': 'message',
    'app.sessionRecreated.continue': 'Continue',
  }),
}));

vi.mock('@/lib/economic-reality', () => ({
  EconomicRealityPlanProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { AppProvider } from '@/components/AppProvider';

describe('AppProvider bootstrap recreation', () => {
  let root: Root | null = null;

  beforeEach(() => {
    ensureSessionMock.mockReset();
    clearJourneyGuideStateMock.mockReset();
    markSessionRecreationNoticePendingMock.mockReset();
    shouldOpenSessionRecreatedNoticeMock.mockReset();
    writeAtlasDemoActiveMock.mockReset();
    shouldOpenSessionRecreatedNoticeMock.mockReturnValue(false);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
  });

  it('clears Journey Guide state when bootstrap recreates a session', async () => {
    ensureSessionMock.mockResolvedValue({
      sessionId: 'sess_new',
      outcome: 'recreated',
    });

    const container = document.createElement('div');
    root = createRoot(container);

    await act(async () => {
      root!.render(
        <AppProvider>
          <div>child</div>
        </AppProvider>
      );
      await Promise.resolve();
    });

    expect(clearJourneyGuideStateMock).toHaveBeenCalledTimes(1);
    expect(writeAtlasDemoActiveMock).toHaveBeenCalledWith(false);
    expect(markSessionRecreationNoticePendingMock).toHaveBeenCalledWith('sess_new');
  });

  it('does not clear demo state when bootstrap reuses an existing session', async () => {
    ensureSessionMock.mockResolvedValue({
      sessionId: 'sess_existing',
      outcome: 'existing',
    });

    const container = document.createElement('div');
    root = createRoot(container);

    await act(async () => {
      root!.render(
        <AppProvider>
          <div>child</div>
        </AppProvider>
      );
      await Promise.resolve();
    });

    expect(clearJourneyGuideStateMock).not.toHaveBeenCalled();
    expect(writeAtlasDemoActiveMock).not.toHaveBeenCalled();
  });

  it('does not clear Journey Guide state on first-launch bootstrap', async () => {
    ensureSessionMock.mockResolvedValue({
      sessionId: 'sess_first',
      outcome: 'created',
    });

    const container = document.createElement('div');
    root = createRoot(container);

    await act(async () => {
      root!.render(
        <AppProvider>
          <div>child</div>
        </AppProvider>
      );
      await Promise.resolve();
    });

    expect(clearJourneyGuideStateMock).not.toHaveBeenCalled();
    expect(writeAtlasDemoActiveMock).not.toHaveBeenCalled();
  });
});
