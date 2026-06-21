import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildEconomicRealityPlan } from '@arrival-atlas/modules/economic-reality';
import { ECONOMIC_FIXTURES } from '@arrival-atlas/modules/economic-reality';
import { fetchUiSnapshot } from '@/lib/api';
import { reconcileEconomicPlanState, hydrateEconomicPlan } from '@/lib/economic-reality';
import { fetchEconomicPlan } from '@/lib/economic-reality/client';
import { fetchLifeEventPlan } from '@/lib/life-event-plan';
import { fetchUserContext } from '@/lib/mutations';
import { fetchProfileInsights } from '@/lib/profile-insights';
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

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

describe('Forbidden runtime behaviors', () => {
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

  it('forbids sync execution before bootstrap completes', async () => {
    harness.model.setSessionId(SESSION_ID);

    await harness.model.ingest({
      type: 'SESSION_SYNC_REQUESTED',
      scope: 'FULL',
    });

    expect(harness.syncStarted).toHaveLength(0);
    expect(fetchEconomicPlan).not.toHaveBeenCalled();
    expect(fetchLifeEventPlan).not.toHaveBeenCalled();
  });

  it('forbids plan fetch without sessionId', async () => {
    const { fetchLifeEventPlan: fetchLifeEventPlanClient } = await vi.importActual<
      typeof import('@/lib/life-event-plan/client')
    >('@/lib/life-event-plan/client');
    const { fetchEconomicPlan: fetchEconomicPlanClient } = await vi.importActual<
      typeof import('@/lib/economic-reality/client')
    >('@/lib/economic-reality/client');

    await expect(fetchLifeEventPlanClient(undefined)).resolves.toBeNull();
    await expect(fetchEconomicPlanClient(undefined)).resolves.toBeNull();
    expect(vi.mocked(fetchLifeEventPlan)).not.toHaveBeenCalled();
    expect(vi.mocked(fetchEconomicPlan)).not.toHaveBeenCalled();
  });

  it('forbids render-time locale branching in Header', () => {
    const headerSource = readSource('src/components/Header.tsx');

    expect(headerSource).not.toMatch(/typeof window/);
    expect(headerSource).not.toMatch(/localStorage/);
    expect(headerSource).not.toMatch(/navigator\.language/);
    expect(headerSource).toContain('mounted ? t(');
    expect(headerSource).toContain('LANGUAGE_DRAWER_LABEL');
  });

  it('forbids deterministicHash reconcile returning the same object reference', () => {
    const fixture = ECONOMIC_FIXTURES[0]!;
    const response = buildEconomicRealityPlan(fixture.userContext, {
      requestId: 'req_forbidden',
      generatedAt: '2026-06-20T12:00:00.000Z',
    });
    const state = hydrateEconomicPlan(response);
    const reconciled = reconcileEconomicPlanState(state, response);

    expect(reconciled).not.toBe(state);
  });

  it('forbids skipping UI commit after ingest when bootstrap and session are ready', async () => {
    harness.model.setBootstrapReady(true);
    harness.model.setSessionId(SESSION_ID);

    await harness.model.ingest({
      type: 'PROFILE_MUTATED',
      revision: 1,
      userContext: FIXTURE_USER_CONTEXT,
    });

    expect(harness.commits.length).toBeGreaterThan(0);
    expect(harness.syncCompleted).toEqual([true]);
  });

  it('enforces bootstrap guard in RuntimeConsistencyProvider source', () => {
    const providerSource = readSource('src/lib/runtime/RuntimeConsistencyProvider.tsx');
    expect(providerSource).toContain('bootstrapCompleteRef');
    expect(providerSource).toContain('setBootstrapReady(true)');
    expect(providerSource).toMatch(/if \(!bootstrapCompleteRef\.current\)/);
  });

  it('enforces runSync bootstrap guard in runtimeConsistencyModel source', () => {
    const modelSource = readSource('src/lib/runtime/runtimeConsistencyModel.ts');
    expect(modelSource).toMatch(/if \(!this\.bootstrapReady/);
    expect(modelSource).toContain('profile_not_ready');
  });
});
