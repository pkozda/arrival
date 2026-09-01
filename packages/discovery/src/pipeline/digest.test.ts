import { describe, expect, it } from 'vitest';
import {
  buildDiscoveryDigest,
  isDigestEligible,
  type DigestCandidateSource,
} from './digest-builder.js';
import {
  createDefaultDiscoveryRegistry,
  createFakeVerificationAdapter,
  createInMemoryProfileStore,
  createInMemoryResultStore,
  emptyCriteria,
  executeDiscoveryPipeline,
  type DiscoveryCandidate,
  type DiscoveryProfile,
  type DiscoveryResult,
  type NoveltyDecision,
  type Score,
} from '../index.js';

const SCORE: Score = {
  matchScore: 80,
  confidenceScore: 90,
  breakdown: {
    dimensions: [
      { id: 'role', labelKey: 'discovery.score.role', value: 80, weight: 0.3 },
      { id: 'location', labelKey: 'discovery.score.location', value: 80, weight: 0.2 },
      { id: 'freshness', labelKey: 'discovery.score.freshness', value: 80, weight: 0.2 },
      { id: 'source', labelKey: 'discovery.score.source', value: 80, weight: 0.3 },
    ],
  },
  scoredAt: '2026-08-30T14:00:00.000Z',
  strategyVersion: '1',
};

function baseResult(overrides: Partial<DiscoveryResult> = {}): DiscoveryResult {
  return {
    id: 'result-1',
    profileId: 'profile-job',
    strategyId: 'job-discovery',
    strategyVersion: '1',
    identity: {
      fingerprintMaterial: { company: 'Acme', title: 'Engineer' },
      externalIds: {},
    },
    canonicalPresentation: {
      title: 'Engineer',
      primaryUrl: 'https://employer.example/jobs/1',
    },
    source: { trust: 'OFFICIAL', url: 'https://employer.example/jobs/1' },
    verification: {
      status: 'PASS',
      sourceTrust: 'OFFICIAL',
      freshness: 'CURRENT',
      checks: [{ id: 'official_source', outcome: 'TRUE', required: true }],
      verifiedAt: '2026-08-30T14:00:00.000Z',
      evidenceIds: ['ev-1'],
    },
    evidence: [
      {
        id: 'ev-1',
        type: 'OFFICIAL_SOURCE',
        sourceUrl: 'https://employer.example/jobs/1',
        statement: 'Hiring',
        capturedAt: '2026-08-30T14:00:00.000Z',
      },
    ],
    score: {
      ...SCORE,
      breakdown: {
        dimensions: SCORE.breakdown.dimensions.map((d) => ({ ...d })),
      },
    },
    lifecycle: 'ACTIVE',
    userState: 'NEW',
    firstSeenAt: '2026-08-30T14:00:00.000Z',
    lastVerifiedAt: '2026-08-30T14:00:00.000Z',
    lastChangedAt: '2026-08-30T14:00:00.000Z',
    ...overrides,
  };
}

function baseCandidate(
  result: DiscoveryResult,
  novelty: NoveltyDecision,
  overrides: Partial<DiscoveryCandidate> = {}
): DiscoveryCandidate {
  return {
    id: 'cand-1',
    runId: 'run-1',
    identity: result.identity,
    source: result.source,
    discoveredAt: '2026-08-30T14:00:00.000Z',
    raw: { ref: 'r1' },
    extracted: { fields: {} },
    stage: 'PROMOTED',
    deterministicFilterPassed: true,
    verification: result.verification,
    evidence: result.evidence,
    score: result.score,
    rankValue: 0.9,
    noveltyDecision: novelty,
    promotedResult: result,
    persistOutcome: 'CREATED',
    ...overrides,
  };
}

function source(
  resultOverrides: Partial<DiscoveryResult> = {},
  noveltyOverrides: Partial<NoveltyDecision> = {},
  candidateOverrides: Partial<DiscoveryCandidate> = {},
  rankValue = 0.9
): DigestCandidateSource {
  const novelty: NoveltyDecision = {
    novelty: 'NEW',
    lifecycle: 'ACTIVE',
    userState: 'NEW',
    shouldNotify: true,
    reason: 'NEW_OPPORTUNITY',
    changedFields: [],
    ...noveltyOverrides,
  };
  const result = baseResult({
    userState: novelty.userState,
    lifecycle: novelty.lifecycle,
    ...resultOverrides,
  });
  const candidate = baseCandidate(result, novelty, {
    rankValue,
    ...candidateOverrides,
  });
  return {
    candidate,
    promotedResult: result,
    noveltyDecision: novelty,
    rankValue,
  };
}

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

describe('E2.8 Digest Builder — pure', () => {
  it('includes eligible NEW Result as digest entry with metadata', () => {
    const s = source({ id: 'result-new' });
    const digest = buildDiscoveryDigest({
      runId: 'run-a',
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      generatedAt: '2026-08-30T15:00:00.000Z',
      periodFrom: '2026-08-30T14:00:00.000Z',
      sources: [s],
    });

    expect(digest.id).toBe('digest:run-a');
    expect(digest.runId).toBe('run-a');
    expect(digest.profileId).toBe('profile-job');
    expect(digest.strategyId).toBe('job-discovery');
    expect(digest.strategyVersion).toBe('1');
    expect(digest.entries).toHaveLength(1);
    expect(digest.resultIds).toEqual(['result-new']);
    expect(digest.newResultIds).toEqual(['result-new']);
    expect(digest.entries[0]).toMatchObject({
      resultId: 'result-new',
      rank: 1,
      novelty: 'NEW',
      shouldNotify: true,
    });
    expect(digest.summary).toEqual({
      totalResults: 1,
      newResults: 1,
      updatedResults: 0,
      unchangedResults: 0,
      notifiedResults: 1,
    });
  });

  it('includes eligible UPDATED Result', () => {
    const s = source(
      { id: 'result-upd', userState: 'SEEN', lifecycle: 'UPDATED' },
      {
        novelty: 'UPDATED',
        lifecycle: 'UPDATED',
        userState: 'SEEN',
        shouldNotify: true,
        reason: 'MATERIAL_UPDATE:title',
      }
    );
    const digest = buildDiscoveryDigest({
      runId: 'run-b',
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      generatedAt: '2026-08-30T15:00:00.000Z',
      periodFrom: '2026-08-30T14:00:00.000Z',
      sources: [s],
    });
    expect(digest.entries[0]?.novelty).toBe('UPDATED');
    expect(digest.updatedResultIds).toEqual(['result-upd']);
    expect(digest.summary.updatedResults).toBe(1);
  });

  it('empty eligible set → valid empty Digest', () => {
    const digest = buildDiscoveryDigest({
      runId: 'run-empty',
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      generatedAt: '2026-08-30T15:00:00.000Z',
      periodFrom: '2026-08-30T14:00:00.000Z',
      sources: [],
    });
    expect(digest.entries).toEqual([]);
    expect(digest.resultIds).toEqual([]);
    expect(digest.summary).toEqual({
      totalResults: 0,
      newResults: 0,
      updatedResults: 0,
      unchangedResults: 0,
      notifiedResults: 0,
    });
  });

  it('excludes shouldNotify=false, DISMISSED, EXPIRED, REMOVED, UNCHANGED', () => {
    const cases: DigestCandidateSource[] = [
      source({ id: 'no-notify' }, { shouldNotify: false }),
      source(
        { id: 'dismissed', userState: 'DISMISSED' },
        {
          novelty: 'UPDATED',
          userState: 'DISMISSED',
          shouldNotify: true,
          reason: 'x',
        }
      ),
      source(
        { id: 'expired-user', userState: 'EXPIRED', lifecycle: 'EXPIRED' },
        {
          novelty: 'UNCHANGED',
          userState: 'EXPIRED',
          lifecycle: 'EXPIRED',
          shouldNotify: true,
          reason: 'x',
        }
      ),
      source(
        { id: 'removed', lifecycle: 'REMOVED', userState: 'SEEN' },
        {
          novelty: 'UPDATED',
          lifecycle: 'REMOVED',
          userState: 'SEEN',
          shouldNotify: true,
          reason: 'x',
        }
      ),
      source(
        { id: 'unchanged' },
        {
          novelty: 'UNCHANGED',
          shouldNotify: false,
          reason: 'NO_MATERIAL_CHANGE',
        },
        { persistOutcome: 'UNCHANGED' }
      ),
    ];

    for (const c of cases) {
      expect(isDigestEligible(c)).toBe(false);
    }

    const digest = buildDiscoveryDigest({
      runId: 'run-excl',
      profileId: 'p',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      generatedAt: '2026-08-30T15:00:00.000Z',
      periodFrom: '2026-08-30T14:00:00.000Z',
      sources: cases,
    });
    expect(digest.entries).toHaveLength(0);
    expect(digest.summary.unchangedResults).toBe(2);
  });

  it('excludes promotion-denied and persist-failed', () => {
    const denied = source(
      { id: 'denied' },
      { shouldNotify: true },
      { stage: 'SCORED', persistOutcome: 'DENIED', promotedResult: undefined }
    );
    // source() still puts promotedResult on the DigestCandidateSource object —
    // eligibility must also check candidate.persistOutcome / stage
    const deniedSrc: DigestCandidateSource = {
      ...denied,
      candidate: {
        ...denied.candidate,
        stage: 'SCORED',
        persistOutcome: 'DENIED',
        promotedResult: undefined,
      },
    };
    const failed = source(
      { id: 'failed' },
      { shouldNotify: true },
      { persistOutcome: 'PERSIST_FAILED', stage: 'SCORED', promotedResult: undefined }
    );
    const failedSrc: DigestCandidateSource = {
      ...failed,
      candidate: {
        ...failed.candidate,
        persistOutcome: 'PERSIST_FAILED',
        stage: 'SCORED',
        promotedResult: undefined,
      },
    };

    expect(isDigestEligible(deniedSrc)).toBe(false);
    expect(isDigestEligible(failedSrc)).toBe(false);
  });

  it('ranks by strategy rankValue then novelty then firstSeenAt then id', () => {
    const low = source(
      { id: 'r-low', firstSeenAt: '2026-08-29T00:00:00.000Z' },
      { novelty: 'NEW', shouldNotify: true },
      {},
      0.5
    );
    const highUpdated = source(
      {
        id: 'r-high-upd',
        firstSeenAt: '2026-08-28T00:00:00.000Z',
        userState: 'SEEN',
        lifecycle: 'UPDATED',
      },
      {
        novelty: 'UPDATED',
        userState: 'SEEN',
        lifecycle: 'UPDATED',
        shouldNotify: true,
        reason: 'x',
      },
      {},
      0.95
    );
    const highNewB = source(
      { id: 'r-high-b', firstSeenAt: '2026-08-27T00:00:00.000Z' },
      { novelty: 'NEW', shouldNotify: true },
      {},
      0.95
    );
    const highNewA = source(
      { id: 'r-high-a', firstSeenAt: '2026-08-27T00:00:00.000Z' },
      { novelty: 'NEW', shouldNotify: true },
      {},
      0.95
    );

    const digest = buildDiscoveryDigest({
      runId: 'run-rank',
      profileId: 'p',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      generatedAt: '2026-08-30T15:00:00.000Z',
      periodFrom: '2026-08-30T14:00:00.000Z',
      sources: [low, highUpdated, highNewB, highNewA],
    });

    expect(digest.resultIds).toEqual([
      'r-high-a',
      'r-high-b',
      'r-high-upd',
      'r-low',
    ]);
    expect(digest.entries.map((e) => e.rank)).toEqual([1, 2, 3, 4]);
    expect(digest.entries.map((e) => e.rankValue)).toEqual([0.95, 0.95, 0.95, 0.5]);
  });

  it('does not mutate inputs or recalculate Score', () => {
    const s = source({ id: 'immutable' }, { shouldNotify: true }, {}, 0.77);
    const frozenResult = structuredClone(s.promotedResult);
    const frozenNovelty = structuredClone(s.noveltyDecision);
    const frozenCand = structuredClone(s.candidate);
    const scoreBefore = structuredClone(s.promotedResult.score);

    const digest = buildDiscoveryDigest({
      runId: 'run-imm',
      profileId: 'p',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      generatedAt: '2026-08-30T15:00:00.000Z',
      periodFrom: '2026-08-30T14:00:00.000Z',
      sources: [s],
    });

    expect(s.promotedResult).toEqual(frozenResult);
    expect(s.noveltyDecision).toEqual(frozenNovelty);
    expect(s.candidate).toEqual(frozenCand);
    expect(s.promotedResult.score).toEqual(scoreBefore);
    expect(digest.entries[0]?.rankValue).toBe(0.77);
  });
});

describe('E2.8 Digest — pipeline integration', () => {
  it('E2.7 promoted Result reaches Digest', async () => {
    const store = createInMemoryResultStore([]);
    const result = await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      resultStore: store,
      resultWriter: store,
      adapters: {
        search: onceSearch([hit('https://employer.example/jobs/1')]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
      },
      now: () => '2026-08-30T14:00:00.000Z',
      runId: 'run-digest-new',
    });

    expect(result.digest).toBeDefined();
    expect(result.digest!.entries).toHaveLength(1);
    expect(result.digest!.resultIds[0]).toBe(
      result.batch.active[0]!.promotedResult!.id
    );
    expect(result.digest!.entries[0]?.novelty).toBe('NEW');
    expect(result.digest!.summary.newResults).toBe(1);
    expect(
      result.stageDiagnostics.some(
        (d) => d.stage === 'digest' && d.outcome === 'ok'
      )
    ).toBe(true);
  });

  it('multiple persisted Results produce deterministic ordered Digest', async () => {
    const store = createInMemoryResultStore([]);
    const result = await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      resultStore: store,
      resultWriter: store,
      adapters: {
        search: onceSearch([
          hit('https://employer.example/jobs/a', 'Frontend Engineer', 'Acme'),
          hit('https://employer.example/jobs/b', 'Frontend Engineer', 'Beta'),
        ]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
      },
      now: () => '2026-08-30T14:00:00.000Z',
      runId: 'run-digest-multi',
    });

    expect(result.digest!.entries.length).toBeGreaterThanOrEqual(2);
    const ranks = result.digest!.entries.map((e) => e.rankValue);
    for (let i = 1; i < ranks.length; i += 1) {
      expect(ranks[i]! <= ranks[i - 1]!).toBe(true);
    }
    const again = await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      resultStore: createInMemoryResultStore([]),
      resultWriter: createInMemoryResultStore([]),
      adapters: {
        search: onceSearch([
          hit('https://employer.example/jobs/a', 'Frontend Engineer', 'Acme'),
          hit('https://employer.example/jobs/b', 'Frontend Engineer', 'Beta'),
        ]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
      },
      now: () => '2026-08-30T14:00:00.000Z',
      runId: 'run-digest-multi-2',
    });
    // Same inputs → same relative ordering of titles/companies via rank + id
    expect(again.digest!.entries.map((e) => e.rankValue)).toEqual(
      result.digest!.entries.map((e) => e.rankValue)
    );
  });

  it('partial persistence produces Digest only from successful Results', async () => {
    const store = createInMemoryResultStore([]);
    let creates = 0;
    const writer = {
      create: async (r: DiscoveryResult) => {
        creates += 1;
        if (creates === 2) {
          throw new Error('boom');
        }
        return store.create(r);
      },
      update: (r: DiscoveryResult) => store.update(r),
    };

    const result = await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      resultStore: store,
      resultWriter: writer,
      adapters: {
        search: onceSearch([
          hit('https://employer.example/jobs/1', 'Frontend Engineer', 'Acme'),
          hit('https://employer.example/jobs/2', 'Frontend Engineer', 'Beta'),
        ]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
      },
      now: () => '2026-08-30T14:00:00.000Z',
      runId: 'run-digest-partial',
    });

    expect(result.run.status).toBe('PARTIAL_SUCCESS');
    const failed = result.batch.active.filter(
      (c) => c.persistOutcome === 'PERSIST_FAILED'
    );
    const created = result.batch.active.filter(
      (c) => c.persistOutcome === 'CREATED'
    );
    expect(failed.length).toBeGreaterThanOrEqual(1);
    expect(created.length).toBeGreaterThanOrEqual(1);
    expect(result.digest!.entries.length).toBe(created.length);
    for (const entry of result.digest!.entries) {
      expect(created.some((c) => c.promotedResult?.id === entry.resultId)).toBe(
        true
      );
    }
  });

  it('UNCHANGED second run excludes from Digest entries', async () => {
    const store = createInMemoryResultStore([]);
    const first = await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      resultStore: store,
      resultWriter: store,
      adapters: {
        search: onceSearch([hit('https://employer.example/jobs/1')]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
      },
      now: () => '2026-08-30T14:00:00.000Z',
      runId: 'run-1',
    });
    expect(first.digest!.entries).toHaveLength(1);

    const second = await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      resultStore: store,
      resultWriter: store,
      adapters: {
        search: onceSearch([hit('https://employer.example/jobs/1')]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
      },
      now: () => '2026-08-30T15:00:00.000Z',
      runId: 'run-2',
    });
    expect(second.batch.active[0]?.persistOutcome).toBe('UNCHANGED');
    expect(second.digest!.entries).toHaveLength(0);
    expect(second.digest!.summary.unchangedResults).toBe(1);
    expect(second.digest!.summary.totalResults).toBe(0);
  });
});
