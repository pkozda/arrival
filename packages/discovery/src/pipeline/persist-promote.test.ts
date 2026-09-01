import { describe, expect, it } from 'vitest';
import {
  canPromote,
  createDefaultDiscoveryRegistry,
  createFakeVerificationAdapter,
  createInMemoryProfileStore,
  createInMemoryResultStore,
  emptyCriteria,
  executeDiscoveryPipeline,
  presentationFromCandidate,
  ResultWriterError,
  toStrategyDescriptor,
  jobDiscoveryStrategyV1,
  type DiscoveryProfile,
  type DiscoveryResult,
} from '../index.js';

function jobProfile(overrides: Partial<DiscoveryProfile> = {}): DiscoveryProfile {
  return {
    id: 'profile-job',
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

function hit(url: string, title = 'Frontend Engineer', company = 'Acme') {
  return {
    discoveredUrl: url,
    title,
    source: { trust: 'AGGREGATOR' as const, url },
    data: { company, location: 'Berlin' },
  };
}

function onceSearch(results: ReturnType<typeof hit>[]) {
  return {
    async search() {
      return results.map((r) => ({
        ...r,
        data: r.data ? { ...r.data } : undefined,
      }));
    },
  };
}

async function runPromote(opts: {
  store?: ReturnType<typeof createInMemoryResultStore>;
  writer?: ReturnType<typeof createInMemoryResultStore> | { create: Function; update: Function };
  hits?: ReturnType<typeof hit>[];
  verifyOutcome?: 'PASS' | 'FAIL' | 'UNKNOWN';
  runId?: string;
}) {
  const mem = opts.store ?? createInMemoryResultStore([]);
  return executeDiscoveryPipeline({
    profileId: 'profile-job',
    registry: createDefaultDiscoveryRegistry(),
    profileStore: createInMemoryProfileStore([jobProfile()]),
    resultStore: mem,
    resultWriter: (opts.writer as typeof mem) ?? mem,
    adapters: {
      search: onceSearch(opts.hits ?? [hit('https://employer.example/jobs/1')]),
      verify: createFakeVerificationAdapter({
        defaultOutcome: opts.verifyOutcome ?? 'PASS',
      }),
    },
    now: () => '2026-08-30T14:00:00.000Z',
    runId: opts.runId ?? 'run-persist',
  });
}

describe('E2.7 Persist + Promote', () => {
  it('valid PASS candidate creates Result with ACTIVE/NEW and audit linkage', async () => {
    const store = createInMemoryResultStore([]);
    const frozenCandHits = [hit('https://employer.example/jobs/1')];
    const hitsClone = structuredClone(frozenCandHits);

    const result = await runPromote({ store, hits: frozenCandHits, runId: 'run-create' });
    expect(frozenCandHits).toEqual(hitsClone);

    const cand = result.batch.active[0]!;
    expect(cand.stage).toBe('PROMOTED');
    expect(cand.persistOutcome).toBe('CREATED');
    expect(cand.promotedResult).toBeDefined();
    const persisted = cand.promotedResult!;
    expect(persisted.lifecycle).toBe('ACTIVE');
    expect(persisted.userState).toBe('NEW');
    expect(persisted.firstSeenAt).toBe('2026-08-30T14:00:00.000Z');
    expect(persisted.lastVerifiedAt).toBe(cand.verification!.verifiedAt);
    expect(persisted.promotedFromCandidateId).toBe(cand.id);
    expect(persisted.promotedFromRunId).toBe('run-create');
    expect(store.size()).toBe(1);
    expect(result.run.stats.resultsCreated).toBe(1);
  });

  it('verification FAIL / UNKNOWN → no promotion', async () => {
    const fail = await runPromote({
      verifyOutcome: 'FAIL',
      runId: 'run-fail',
    });
    expect(fail.batch.active).toHaveLength(0);
    expect(fail.batch.rejected[0]?.candidate.promotedResult).toBeUndefined();

    const unk = await runPromote({
      verifyOutcome: 'UNKNOWN',
      runId: 'run-unk',
    });
    expect(unk.batch.active).toHaveLength(0);
  });

  it('unchanged candidate does not create duplicate or churn timestamps', async () => {
    const first = await runPromote({ runId: 'run-first' });
    const created = first.batch.active[0]!.promotedResult!;
    const store = createInMemoryResultStore([created]);
    const before = store.snapshot();

    const second = await runPromote({ store, runId: 'run-second' });
    const cand = second.batch.active[0]!;
    expect(cand.persistOutcome).toBe('UNCHANGED');
    expect(cand.promotedResult!.id).toBe(created.id);
    expect(cand.promotedResult!.firstSeenAt).toBe(created.firstSeenAt);
    expect(cand.promotedResult!.lastChangedAt).toBe(created.lastChangedAt);
    expect(store.size()).toBe(1);
    expect(store.snapshot()[0]!.lastChangedAt).toBe(before[0]!.lastChangedAt);
  });

  it('meaningful update persists UPDATED and preserves DISMISSED userState', async () => {
    const probe = await runPromote({ runId: 'run-probe' });
    const scoredLike = probe.batch.active[0]!;
    const existing: DiscoveryResult = {
      ...structuredClone(scoredLike.promotedResult!),
      canonicalPresentation: {
        title: 'Frontend Engineer — OLD',
        primaryUrl: scoredLike.identity.canonicalUrl,
      },
      userState: 'DISMISSED',
      lifecycle: 'ACTIVE',
      firstSeenAt: '2026-07-01T00:00:00.000Z',
      lastChangedAt: '2026-07-01T00:00:00.000Z',
    };
    // Keep identity/score/verification aligned so novelty is UPDATED via presentation
    const store = createInMemoryResultStore([existing]);

    const result = await runPromote({ store, runId: 'run-upd' });
    const cand = result.batch.active[0]!;
    expect(cand.noveltyDecision?.novelty).toBe('UPDATED');
    expect(cand.persistOutcome).toBe('UPDATED');
    expect(cand.promotedResult!.lifecycle).toBe('UPDATED');
    expect(cand.promotedResult!.userState).toBe('DISMISSED');
    expect(cand.promotedResult!.firstSeenAt).toBe('2026-07-01T00:00:00.000Z');
    expect(cand.promotedResult!.lastChangedAt).toBe('2026-08-30T14:00:00.000Z');
    expect(cand.promotedResult!.evidence.length).toBeGreaterThanOrEqual(1);
  });

  it('EXPIRED is not resurrected via persistence', async () => {
    const probe = await runPromote({ runId: 'run-exp-probe' });
    const base = probe.batch.active[0]!.promotedResult!;
    const existing: DiscoveryResult = {
      ...structuredClone(base),
      lifecycle: 'EXPIRED',
      userState: 'EXPIRED',
    };
    const store = createInMemoryResultStore([existing]);
    const result = await runPromote({ store, runId: 'run-exp' });
    const cand = result.batch.active[0]!;
    expect(cand.noveltyDecision?.reason).toBe('EXPIRED_OR_REMOVED_NOT_RESURRECTED');
    // UNCHANGED skip — no write that resurrects
    expect(cand.persistOutcome).toBe('UNCHANGED');
    expect(cand.promotedResult!.lifecycle).toBe('EXPIRED');
    expect(cand.promotedResult!.userState).toBe('EXPIRED');
    expect(store.snapshot()[0]!.userState).toBe('EXPIRED');
  });

  it('writer failure produces diagnostic; no fake Result; siblings can succeed', async () => {
    const mem = createInMemoryResultStore([]);
    let createCount = 0;
    const flaky = {
      async create(result: DiscoveryResult) {
        createCount += 1;
        if (createCount === 1) {
          throw new ResultWriterError('disk full');
        }
        return mem.create(result);
      },
      async update(result: DiscoveryResult) {
        return mem.update(result);
      },
    };

    const result = await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      resultStore: mem,
      resultWriter: flaky,
      adapters: {
        search: onceSearch([
          hit('https://employer.example/jobs/a', 'Frontend Engineer', 'Acme'),
          hit('https://employer.example/jobs/b', 'Frontend Engineer', 'Beta'),
        ]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
      },
      now: () => '2026-08-30T14:00:00.000Z',
      runId: 'run-partial-persist',
    });

    expect(result.run.status).toBe('PARTIAL_SUCCESS');
    expect(
      result.batch.active.some((c) => c.persistOutcome === 'PERSIST_FAILED')
    ).toBe(true);
    expect(
      result.batch.active.some((c) => c.persistOutcome === 'CREATED')
    ).toBe(true);
    expect(
      result.stageDiagnostics.some((d) => d.reasonCode === 'PERSIST_FAILED')
    ).toBe(true);
  });

  it('canPromote forPersistence denies missing novelty / invalid evidence', () => {
    const strategy = toStrategyDescriptor(jobDiscoveryStrategyV1);
    const base = {
      candidate: {
        id: 'c1',
        runId: 'r1',
        identity: {
          externalIds: {},
          fingerprintMaterial: { title: 'x', company: 'y' },
        },
        source: { trust: 'AGGREGATOR' as const },
        discoveredAt: 't',
        raw: { ref: 'r' },
        extracted: { fields: {} },
        stage: 'SCORED' as const,
        deterministicFilterPassed: true,
        verification: {
          status: 'PASS' as const,
          sourceTrust: 'OFFICIAL' as const,
          freshness: 'CURRENT' as const,
          checks: [
            { id: 'official_source', outcome: 'TRUE' as const, required: true },
          ],
          verifiedAt: 't',
          evidenceIds: ['e1'],
        },
        score: {
          matchScore: 80,
          confidenceScore: 90,
          breakdown: {
            dimensions: strategy.scoringPolicy.dimensions.map((d) => ({
              id: d.id,
              labelKey: d.labelKey,
              value: 80,
              weight: d.weight,
            })),
          },
          scoredAt: 't',
          strategyVersion: '1',
        },
      },
      verification: undefined as never,
      score: undefined as never,
      strategy,
      forPersistence: true as const,
    };
    base.verification = base.candidate.verification;
    base.score = base.candidate.score;

    const missingNovelty = canPromote({
      ...base,
      noveltyDecision: null,
    });
    expect(missingNovelty.eligible).toBe(false);
    if (!missingNovelty.eligible) {
      expect(missingNovelty.reasons).toContain('MISSING_NOVELTY');
    }

    const missingEv = canPromote({
      ...base,
      noveltyDecision: {
        novelty: 'NEW',
        lifecycle: 'ACTIVE',
        userState: 'NEW',
        shouldNotify: true,
        reason: 'NEW_OPPORTUNITY',
        changedFields: [],
      },
      candidate: { ...base.candidate, evidence: [] },
    });
    expect(missingEv.eligible).toBe(false);
    if (!missingEv.eligible) {
      expect(missingEv.reasons).toContain('MISSING_EVIDENCE');
    }
  });

  it('Score → Novelty → Persist order; denied candidates stay without Result', async () => {
    const result = await runPromote({ runId: 'run-order' });
    const stages = result.stageDiagnostics.map((d) => d.stage);
    expect(stages.indexOf('novelty_state')).toBeLessThan(
      stages.indexOf('persist_promote')
    );
    expect(stages.indexOf('persist_promote')).toBeLessThan(stages.indexOf('digest'));
    expect(result.batch.active[0]?.promotedResult).toBeDefined();
    // presentation helper still used by novelty
    expect(presentationFromCandidate(result.batch.active[0]!).title).toBeTruthy();
  });
});
