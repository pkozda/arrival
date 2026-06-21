import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { renderToString } from 'react-dom/server';
import { fetchUiSnapshot } from '@/lib/api';
import { fetchEconomicPlan } from '@/lib/economic-reality/client';
import { fetchLifeEventPlan } from '@/lib/life-event-plan';
import { fetchUserContext } from '@/lib/mutations';
import { fetchProfileInsights } from '@/lib/profile-insights';
import { emit, subscribe } from '@/lib/runtime/runtimeReactionBus';
import { Header } from '@/components/Header';
import {
  createRuntimeTestHarness,
  FIXTURE_USER_CONTEXT,
  SESSION_ID,
  buildFixtureEconomicPlanResponse,
} from '../runtime/test-harness';

const LANGUAGE_DRAWER_LABEL = 'Language';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

vi.mock('@/app-shell/navigation/EconomicRealityNavLink', () => ({
  EconomicRealityNavLink: () => null,
}));

vi.mock('@/lib/dev-tools/reset-user-data', () => ({
  isDevToolsUiEnabled: () => false,
}));

vi.mock('@/components/AppProvider', () => ({
  useApp: vi.fn(),
}));

vi.mock('@/lib/mutations', () => ({
  fetchUserContext: vi.fn(),
}));

vi.mock('@/lib/profile-insights', () => ({
  fetchProfileInsights: vi.fn(),
}));

vi.mock('@/lib/life-event-plan', () => ({
  fetchLifeEventPlan: vi.fn(),
}));

vi.mock('@/lib/economic-reality/client', () => ({
  fetchEconomicPlan: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  fetchUiSnapshot: vi.fn(),
}));

import { useApp } from '@/components/AppProvider';

function mockAppRu() {
  return {
    language: 'ru' as const,
    changeLanguage: vi.fn(),
    theme: 'light' as const,
    toggleTheme: vi.fn(),
    t: (key: string) => (key === 'common.language' ? 'Язык' : key),
    modules: [],
    resetUserData: vi.fn(),
    loadDemoPreset: vi.fn(),
  };
}

function renderHeaderFirstPaint(): { container: HTMLDivElement; root: Root } {
  const container = document.createElement('div');
  const root = createRoot(container);
  flushSync(() => {
    root.render(<Header />);
  });
  return { container, root };
}

describe('Golden runtime flow regression', () => {
  let harness: ReturnType<typeof createRuntimeTestHarness>;
  let headerRoot: Root | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useApp).mockReturnValue(mockAppRu() as ReturnType<typeof useApp>);

    harness = createRuntimeTestHarness();
    vi.mocked(fetchUserContext).mockResolvedValue(FIXTURE_USER_CONTEXT);
    vi.mocked(fetchProfileInsights).mockResolvedValue(null);
    vi.mocked(fetchLifeEventPlan).mockResolvedValue(null);
    vi.mocked(fetchEconomicPlan).mockResolvedValue(buildFixtureEconomicPlanResponse());
    vi.mocked(fetchUiSnapshot).mockResolvedValue({
      schemaVersion: '1.0.0',
      snapshotVersion: 3,
      generatedAt: '2026-06-20T12:00:00.000Z',
      session: { language: 'ru', theme: 'light' },
      profileSummary: null,
      moduleRecommendations: [],
      economicReality: null,
      lifeEvent: null,
    });
  });

  afterEach(() => {
    headerRoot?.unmount();
    headerRoot = null;
    harness.teardown();
  });

  it('SSR → hydration → profile mutation → economic action → full sync without plan 400s', async () => {
    const ssrMarkup = renderToString(<Header />);
    const { container, root } = renderHeaderFirstPaint();
    headerRoot = root;

    expect(ssrMarkup).toContain(LANGUAGE_DRAWER_LABEL);
    expect(ssrMarkup).not.toContain('Язык');
    expect(container.textContent).toContain(LANGUAGE_DRAWER_LABEL);
    expect(container.textContent).not.toContain('Язык');

    harness.model.setBootstrapReady(true);
    harness.model.setSessionId(SESSION_ID);

    await harness.model.ingest({
      type: 'PROFILE_MUTATED',
      revision: 2,
      userContext: FIXTURE_USER_CONTEXT,
    });

    const hash = buildFixtureEconomicPlanResponse().meta.deterministicHash;

    await harness.model.ingest({
      type: 'ECONOMIC_ACTION_EXECUTED',
      actionId: 'golden-intent',
      previousDeterministicHash: hash,
      deterministicHash: hash,
      planChanged: false,
    });

    await harness.model.ingest({ type: 'SESSION_SYNC_REQUESTED', scope: 'FULL' });

    expect(fetchLifeEventPlan.mock.calls.every(([sessionId]) => Boolean(sessionId))).toBe(true);
    expect(fetchEconomicPlan.mock.calls.every(([sessionId]) => Boolean(sessionId))).toBe(true);
    expect(harness.syncStarted).toHaveLength(3);
    expect(harness.syncCompleted).toEqual([true, true, true]);

    const satisfiedCommits = harness.commits.filter(
      (commit) => commit.consistencyPolicy === 'satisfied'
    );
    expect(satisfiedCommits.length).toBeGreaterThanOrEqual(3);

    const lastCommit = satisfiedCommits.at(-1)!;
    expect(lastCommit.domains.PROFILE?.userContext).toBeDefined();
    expect(lastCommit.domains.ECONOMIC?.economicPlan).toBeDefined();
    expect(lastCommit.domains.SNAPSHOT?.uiSnapshot).toBeDefined();

    act(() => {
      flushSync(() => {
        root.render(<Header />);
      });
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Язык');
  });

  it('routes bus events through ingest and completes one sync per emitted action', async () => {
    harness.model.setBootstrapReady(true);
    harness.model.setSessionId(SESSION_ID);
    harness.seedCachedProfile();

    const syncDone = new Promise<void>((resolve) => {
      const unsubscribe = subscribe('SYNC_COMPLETED', () => {
        unsubscribe();
        resolve();
      });
    });

    emit({
      type: 'ECONOMIC_ACTION_EXECUTED',
      actionId: 'bus-action',
      previousDeterministicHash: 'hash-a',
      deterministicHash: 'hash-b',
      planChanged: true,
    });

    await syncDone;

    expect(fetchEconomicPlan).toHaveBeenCalledTimes(1);
    expect(harness.syncCompleted).toEqual([true]);
  });
});
