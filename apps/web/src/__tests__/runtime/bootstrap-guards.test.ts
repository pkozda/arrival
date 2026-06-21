import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchUiSnapshot } from '@/lib/api';
import { fetchEconomicPlan } from '@/lib/economic-reality/client';
import { fetchLifeEventPlan } from '@/lib/life-event-plan';
import { fetchUserContext } from '@/lib/mutations';
import { fetchProfileInsights } from '@/lib/profile-insights';
import { buildSyncPlan } from '@/lib/runtime/domainSyncGraph';
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

describe('Bootstrap safety invariants', () => {
  let harness: ReturnType<typeof createRuntimeTestHarness>;

  beforeEach(() => {
    vi.clearAllMocks();
    harness = createRuntimeTestHarness();

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
    vi.mocked(fetchUserContext).mockResolvedValue(FIXTURE_USER_CONTEXT);
  });

  afterEach(() => {
    harness.teardown();
  });

  it('does not call network fetchers before bootstrap is complete', async () => {
    harness.model.setSessionId(SESSION_ID);

    await harness.model.ingest({
      type: 'PROFILE_MUTATED',
      revision: 1,
      userContext: FIXTURE_USER_CONTEXT,
    });

    expect(fetchUserContext).not.toHaveBeenCalled();
    expect(fetchProfileInsights).not.toHaveBeenCalled();
    expect(fetchLifeEventPlan).not.toHaveBeenCalled();
    expect(fetchEconomicPlan).not.toHaveBeenCalled();
    expect(fetchUiSnapshot).not.toHaveBeenCalled();
    expect(harness.commits).toHaveLength(0);
    expect(harness.syncStarted).toHaveLength(0);
  });

  it('runs full PROFILE cascade only after bootstrap and session are ready', async () => {
    harness.model.setBootstrapReady(true);
    harness.model.setSessionId(SESSION_ID);

    await harness.model.ingest({
      type: 'PROFILE_MUTATED',
      revision: 1,
      userContext: FIXTURE_USER_CONTEXT,
    });

    expect(buildSyncPlan({
      type: 'PROFILE_MUTATED',
      revision: 1,
      userContext: FIXTURE_USER_CONTEXT,
    })).toEqual(['PROFILE', 'LIFE_EVENT', 'ECONOMIC', 'SNAPSHOT']);

    expect(fetchProfileInsights).toHaveBeenCalledTimes(1);
    expect(fetchLifeEventPlan).toHaveBeenCalledTimes(1);
    expect(fetchEconomicPlan).toHaveBeenCalledTimes(1);
    expect(fetchUiSnapshot).toHaveBeenCalledTimes(1);
    expect(harness.syncStarted).toHaveLength(1);
    expect(harness.syncCompleted).toEqual([true]);
  });

  it('never calls plan fetchers without sessionId or user profile', async () => {
    harness.model.setBootstrapReady(true);

    await harness.model.ingest({ type: 'SESSION_SYNC_REQUESTED', scope: 'FULL' });
    expect(fetchLifeEventPlan).not.toHaveBeenCalled();
    expect(fetchEconomicPlan).not.toHaveBeenCalled();

    vi.clearAllMocks();
    harness.model.setSessionId(SESSION_ID);
    vi.mocked(fetchUserContext).mockResolvedValue({
      schemaVersion: '1.0.0',
      profile: null,
    } as unknown as typeof FIXTURE_USER_CONTEXT);

    await harness.model.ingest({
      type: 'SESSION_SYNC_REQUESTED',
      scope: 'FULL',
    });

    expect(fetchLifeEventPlan).not.toHaveBeenCalled();
    expect(fetchEconomicPlan).not.toHaveBeenCalled();
    expect(fetchProfileInsights).toHaveBeenCalled();
    expect(fetchUiSnapshot).toHaveBeenCalled();
  });
});
