import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildEconomicRealityPlan } from '@arrival-atlas/modules/economic-reality';
import { ECONOMIC_FIXTURES } from '@arrival-atlas/modules/economic-reality';
import { commitStateTransaction } from '@/lib/runtime/RuntimeConsistencyProvider';
import { EMPTY_ECONOMIC_REALITY_CLIENT_STATE } from '@/lib/economic-reality/economic-reality-client-state';
import { reconcileEconomicPlanState, hydrateEconomicPlan } from '@/lib/economic-reality';
import { fetchEconomicPlan } from '@/lib/economic-reality/client';
import { fetchUiSnapshot } from '@/lib/api';
import { fetchLifeEventPlan } from '@/lib/life-event-plan';
import { fetchProfileInsights } from '@/lib/profile-insights';
import { subscribe } from '@/lib/runtime/runtimeReactionBus';
import {
  createRuntimeTestHarness,
  FIXTURE_USER_CONTEXT,
  SESSION_ID,
  buildFixtureEconomicPlanResponse,
} from './test-harness';

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

const FIXED_META = {
  requestId: 'req_reactivity',
  generatedAt: '2026-06-20T12:00:00.000Z',
};

describe('Runtime reactivity reference-safety invariants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('never reuses the previous state reference when deterministicHash is unchanged', () => {
    const response = buildFixtureEconomicPlanResponse();
    const initial = hydrateEconomicPlan(response);

    const reconciled = reconcileEconomicPlanState(initial, response);
    expect(reconciled).not.toBe(initial);
    expect(reconciled).toEqual(initial);
  });

  it('commits a fresh economic plan object after ECONOMIC_ACTION_EXECUTED even when hash is unchanged', async () => {
    const harness = createRuntimeTestHarness();
    const economicResponse = buildFixtureEconomicPlanResponse();

    vi.mocked(fetchProfileInsights).mockResolvedValue(null);
    vi.mocked(fetchLifeEventPlan).mockResolvedValue(null);
    vi.mocked(fetchEconomicPlan).mockResolvedValue(economicResponse);
    vi.mocked(fetchUiSnapshot).mockResolvedValue({
      schemaVersion: '1.0.0',
      snapshotVersion: 2,
      generatedAt: '2026-06-20T12:00:00.000Z',
      session: { language: 'en', theme: 'light' },
      profileSummary: null,
      moduleRecommendations: [],
      economicReality: null,
      lifeEvent: null,
    });

    harness.model.setBootstrapReady(true);
    harness.model.setSessionId(SESSION_ID);
    harness.seedCachedProfile();

    const hash = economicResponse.meta.deterministicHash;

    await harness.model.ingest({
      type: 'ECONOMIC_ACTION_EXECUTED',
      actionId: 'start-intent',
      previousDeterministicHash: hash,
      deterministicHash: hash,
      planChanged: false,
    });

    await harness.model.ingest({
      type: 'ECONOMIC_ACTION_EXECUTED',
      actionId: 'start-intent-repeat',
      previousDeterministicHash: hash,
      deterministicHash: hash,
      planChanged: false,
    });

    expect(fetchEconomicPlan).toHaveBeenCalledTimes(2);

    const economicPlans = harness.commits
      .map((commit) => commit.domains.ECONOMIC?.economicPlan)
      .filter((plan): plan is NonNullable<typeof plan> => plan !== undefined);

    expect(economicPlans.length).toBeGreaterThanOrEqual(2);
    expect(economicPlans[1]).not.toBe(economicPlans[0]);

    harness.teardown();
  });

  it('propagates bus events into scheduled sync execution', async () => {
    const harness = createRuntimeTestHarness();

    vi.mocked(fetchProfileInsights).mockResolvedValue(null);
    vi.mocked(fetchLifeEventPlan).mockResolvedValue(null);
    vi.mocked(fetchEconomicPlan).mockResolvedValue(buildFixtureEconomicPlanResponse());
    vi.mocked(fetchUiSnapshot).mockResolvedValue({
      schemaVersion: '1.0.0',
      snapshotVersion: 1,
      generatedAt: '2026-06-20T12:00:00.000Z',
      session: { language: 'en', theme: 'light' },
      profileSummary: null,
      moduleRecommendations: [],
      economicReality: null,
      lifeEvent: null,
    });

    harness.model.setBootstrapReady(true);
    harness.model.setSessionId(SESSION_ID);
    harness.seedCachedProfile();

    const { emit } = await import('@/lib/runtime/runtimeReactionBus');
    const syncDone = new Promise<void>((resolve) => {
      const unsubscribe = subscribe('SYNC_COMPLETED', () => {
        unsubscribe();
        resolve();
      });
    });

    emit({
      type: 'ECONOMIC_ACTION_EXECUTED',
      actionId: 'a1',
      previousDeterministicHash: 'hash-a',
      deterministicHash: 'hash-b',
      planChanged: true,
    });

    await syncDone;

    expect(fetchEconomicPlan).toHaveBeenCalledTimes(1);
    expect(harness.syncStarted).toHaveLength(1);
    expect(harness.syncCompleted).toEqual([true]);

    harness.teardown();
  });

  it('commitStateTransaction always applies domain payloads with new references', () => {
    const fixture = ECONOMIC_FIXTURES[0]!;
    const response = buildEconomicRealityPlan(fixture.userContext, FIXED_META);
    const hydrated = hydrateEconomicPlan(response);

    let committedUserContext: unknown;
    let committedEconomic: unknown;

    commitStateTransaction(
      {
        domains: {
          PROFILE: {
            userContext: FIXTURE_USER_CONTEXT,
            profileInsights: null,
          },
          ECONOMIC: {
            economicPlan: hydrated,
          },
        },
        loading: { PROFILE: false, ECONOMIC: false },
        consistencyPolicy: 'satisfied',
      },
      {
        setUserContext: (value) => {
          committedUserContext = value;
        },
        setProfileInsights: () => {},
        setLifeEventPlan: () => {},
        setUiSnapshot: () => {},
        setEconomicPlan: (value) => {
          committedEconomic = value;
        },
        setProfileHeadRevision: () => {},
        setLoading: (updater) => {
          updater({
            userContext: true,
            profileInsights: true,
            lifeEventPlan: true,
            uiSnapshot: true,
            economicPlan: true,
          });
        },
        setErrors: () => {},
      }
    );

    expect(committedUserContext).not.toBe(FIXTURE_USER_CONTEXT);
    expect(committedEconomic).not.toBe(hydrated);
    expect(committedEconomic).toEqual(hydrated);
  });
});

describe('useEconomicFeedbackTracker contract', () => {
  it('routes action feedback through runtimeConsistencyModel.ingest', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const source = readFileSync(
      join(process.cwd(), 'src/lib/economic-reality/useEconomicFeedbackTracker.ts'),
      'utf8'
    );

    expect(source).toContain('getRuntimeConsistencyModel().ingest');
    expect(source).toContain("type: 'ECONOMIC_ACTION_EXECUTED'");
    expect(source).not.toContain('invalidateEconomicPlanIfHashChanged');
  });
});
