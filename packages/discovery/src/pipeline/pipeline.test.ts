import { describe, expect, it } from 'vitest';
import {
  CANONICAL_STAGE_ORDER,
  createCompositeSearchAdapter,
  createDefaultDiscoveryRegistry,
  createFakeSearchAdapter,
  createInMemoryProfileStore,
  emptyCriteria,
  executeDiscoveryPipeline,
  jobDiscoveryStrategyV1,
  type DiscoveryProfile,
} from '../index.js';

function baseProfile(overrides: Partial<DiscoveryProfile> = {}): DiscoveryProfile {
  return {
    id: 'profile-1',
    userId: 'user-1',
    name: 'Jobs',
    strategyId: 'job-discovery',
    strategyVersion: '1',
    criteria: {
      ...emptyCriteria(),
      required: [{ key: 'country', value: 'DE' }],
      preferred: [{ key: 'role', value: 'Frontend Engineer' }],
      excluded: [{ key: 'role', value: 'Team Lead' }],
    },
    schedule: { cadence: 'manual' },
    notification: { emailEnabled: true, skipEmptyDigest: true },
    enabled: true,
    createdAt: '2026-08-30T00:00:00.000Z',
    updatedAt: '2026-08-30T00:00:00.000Z',
    ...overrides,
  };
}

describe('E2.1 executeDiscoveryPipeline', () => {
  it('resolves exact strategy id@version', async () => {
    const registry = createDefaultDiscoveryRegistry();
    const store = createInMemoryProfileStore([baseProfile()]);
    const result = await executeDiscoveryPipeline({
      profileId: 'profile-1',
      registry,
      profileStore: store,
      adapters: {
        search: createFakeSearchAdapter({
          defaultResults: [
            {
              discoveredUrl: 'https://employer.example/jobs/1',
              title: 'Frontend Engineer',
              source: { trust: 'AGGREGATOR' },
            },
          ],
        }),
      },
      now: () => '2026-08-30T06:00:00.000Z',
      runId: 'run-1',
    });
    expect(result.run.strategyId).toBe('job-discovery');
    expect(result.run.strategyVersion).toBe('1');
    expect(result.run.status).toBe('SUCCESS');
  });

  it('fails when strategy version is missing (no latest fallback)', async () => {
    const registry = createDefaultDiscoveryRegistry();
    const store = createInMemoryProfileStore([
      baseProfile({ strategyVersion: '99' }),
    ]);
    const result = await executeDiscoveryPipeline({
      profileId: 'profile-1',
      registry,
      profileStore: store,
      now: () => '2026-08-30T06:00:00.000Z',
      runId: 'run-missing',
    });
    expect(result.run.status).toBe('FAILED');
    expect(result.batch.active).toHaveLength(0);
    expect(
      result.stageDiagnostics.some((d) => d.reasonCode === 'STRATEGY_NOT_FOUND')
    ).toBe(true);
  });

  it('snapshots criteria at run start; later profile mutation does not affect snapshot', async () => {
    const registry = createDefaultDiscoveryRegistry();
    const profile = baseProfile();
    const store = createInMemoryProfileStore([profile]);
    const result = await executeDiscoveryPipeline({
      profileId: 'profile-1',
      registry,
      profileStore: store,
      adapters: { search: createFakeSearchAdapter({ defaultResults: [] }) },
      now: () => '2026-08-30T06:00:00.000Z',
      runId: 'run-snap',
    });
    store.upsert({
      ...profile,
      criteria: {
        ...emptyCriteria(),
        required: [{ key: 'country', value: 'FR' }],
      },
    });
    expect(result.run.criteriaSnapshot.required[0]?.value).toBe('DE');
    expect((await store.get('profile-1'))?.criteria.required[0]?.value).toBe('FR');
  });

  it('executes stages in canonical order', async () => {
    const registry = createDefaultDiscoveryRegistry();
    const store = createInMemoryProfileStore([baseProfile()]);
    const result = await executeDiscoveryPipeline({
      profileId: 'profile-1',
      registry,
      profileStore: store,
      adapters: { search: createFakeSearchAdapter({ defaultResults: [] }) },
      now: () => '2026-08-30T06:00:00.000Z',
      runId: 'run-order',
    });
    const observed = result.stageDiagnostics.map((d) => d.stage);
    // Every canonical stage appears at least once, in order
    let lastIndex = -1;
    for (const stage of CANONICAL_STAGE_ORDER) {
      const idx = observed.indexOf(stage);
      expect(idx).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }
    expect(result.stageOrder).toEqual([...CANONICAL_STAGE_ORDER]);
  });

  it('does not mutate input fixture candidates/arrays and retains rejections', async () => {
    const registry = createDefaultDiscoveryRegistry();
    const store = createInMemoryProfileStore([baseProfile()]);
    const fixture = [
      {
        discoveredUrl: 'https://employer.example/jobs/lead',
        title: 'Team Lead Frontend',
        source: { trust: 'AGGREGATOR' as const },
      },
      {
        discoveredUrl: 'https://employer.example/jobs/fe',
        title: 'Frontend Engineer',
        source: { trust: 'AGGREGATOR' as const },
      },
    ];
    const frozen = structuredClone(fixture);
    // Jobs emits job-q1 + job-q2; defaultResults are returned for each query →
    // intentional q1/q2 overlap that dedupe rejects before filter.
    const result = await executeDiscoveryPipeline({
      profileId: 'profile-1',
      registry,
      profileStore: store,
      adapters: { search: createFakeSearchAdapter({ defaultResults: fixture }) },
      now: () => '2026-08-30T06:00:00.000Z',
      runId: 'run-immut',
    });
    expect(fixture).toEqual(frozen);
    expect(result.queries.map((q) => q.id)).toEqual(['job-q1', 'job-q2']);

    const duplicateLeads = result.batch.rejected.filter(
      (r) =>
        String(r.candidate.extracted.fields.title).includes('Team Lead') &&
        r.rejection.reasonCode === 'REJECTED_DUPLICATE'
    );
    expect(duplicateLeads).toHaveLength(1);
    expect(duplicateLeads[0]?.rejection.atStage).toBe('DEDUPLICATED');

    const excludedLead = result.batch.rejected.find(
      (r) =>
        String(r.candidate.extracted.fields.title).includes('Team Lead') &&
        r.rejection.reasonCode === 'REJECTED_EXCLUDED_ROLE'
    );
    expect(excludedLead).toBeDefined();
    expect(excludedLead?.rejection.atStage).toBe('FILTERED');
    expect(excludedLead?.rejection.at).toBeTruthy();
    expect(
      result.batch.active.some((c) =>
        String(c.extracted.fields.title).includes('Team Lead')
      )
    ).toBe(false);
  });

  it('preserves successful hits on partial search adapter failure', async () => {
    const registry = createDefaultDiscoveryRegistry();
    const store = createInMemoryProfileStore([baseProfile()]);
    const ok = createFakeSearchAdapter({
      defaultResults: [
        {
          discoveredUrl: 'https://employer.example/jobs/ok',
          title: 'Frontend Engineer',
          source: { trust: 'AGGREGATOR' },
        },
      ],
    });
    const bad = createFakeSearchAdapter({ failAll: true });
    const result = await executeDiscoveryPipeline({
      profileId: 'profile-1',
      registry,
      profileStore: store,
      adapters: { search: createCompositeSearchAdapter([ok, bad]) },
      now: () => '2026-08-30T06:00:00.000Z',
      runId: 'run-partial',
    });
    expect(result.run.status).toBe('PARTIAL_SUCCESS');
    expect(result.batch.active.length + result.batch.rejected.length).toBeGreaterThan(0);
    expect(result.stageDiagnostics.some((d) => d.outcome === 'partial')).toBe(true);
  });

  it('fails fatally when profile is missing', async () => {
    const registry = createDefaultDiscoveryRegistry();
    const store = createInMemoryProfileStore([]);
    const result = await executeDiscoveryPipeline({
      profileId: 'missing',
      registry,
      profileStore: store,
      now: () => '2026-08-30T06:00:00.000Z',
      runId: 'run-no-profile',
    });
    expect(result.run.status).toBe('FAILED');
    expect(result.batch.active).toHaveLength(0);
  });

  it('fails when criteria are invalid', async () => {
    const registry = createDefaultDiscoveryRegistry();
    const store = createInMemoryProfileStore([
      baseProfile({
        criteria: { ...emptyCriteria(), required: [] },
      }),
    ]);
    const result = await executeDiscoveryPipeline({
      profileId: 'profile-1',
      registry,
      profileStore: store,
      now: () => '2026-08-30T06:00:00.000Z',
      runId: 'run-bad-criteria',
    });
    expect(result.run.status).toBe('FAILED');
    expect(
      result.stageDiagnostics.some((d) => d.reasonCode === 'CRITERIA_INVALID')
    ).toBe(true);
  });

  it('emits structured stage diagnostics including stubs', async () => {
    const registry = createDefaultDiscoveryRegistry();
    const store = createInMemoryProfileStore([baseProfile()]);
    const result = await executeDiscoveryPipeline({
      profileId: 'profile-1',
      registry,
      profileStore: store,
      adapters: { search: createFakeSearchAdapter({ defaultResults: [] }) },
      now: () => '2026-08-30T06:00:00.000Z',
      runId: 'run-diag',
    });
    for (const d of result.stageDiagnostics) {
      expect(d.runId).toBe('run-diag');
      expect(typeof d.stage).toBe('string');
      expect(typeof d.durationMs).toBe('number');
      expect(['ok', 'reject', 'error', 'partial', 'stub']).toContain(d.outcome);
    }
    expect(result.stageDiagnostics.some((d) => d.outcome === 'stub')).toBe(true);
  });

  it('uses strategy buildQueries / normalize / filter from JobDiscoveryStrategyV1', async () => {
    expect(jobDiscoveryStrategyV1.id).toBe('job-discovery');
    const registry = createDefaultDiscoveryRegistry();
    const store = createInMemoryProfileStore([baseProfile()]);
    const result = await executeDiscoveryPipeline({
      profileId: 'profile-1',
      registry,
      profileStore: store,
      adapters: {
        search: createFakeSearchAdapter({
          defaultResults: [
            {
              discoveredUrl: 'https://employer.example/jobs/1',
              title: 'Frontend Engineer',
              data: { company: 'Acme' },
              source: { trust: 'AGGREGATOR' },
            },
          ],
        }),
      },
      now: () => '2026-08-30T06:00:00.000Z',
      runId: 'run-job',
    });
    expect(result.queries.length).toBeGreaterThan(0);
    expect(result.batch.active[0]?.stage).toBe('FILTERED');
    expect(result.batch.active[0]?.deterministicFilterPassed).toBe(true);
    expect(result.batch.active[0]?.normalized).toBeTruthy();
  });
});
