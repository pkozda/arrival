import { describe, expect, it } from 'vitest';
import {
  createDefaultDiscoveryRegistry,
  createFakeAiAdapter,
  createFakeVerificationAdapter,
  createInMemoryProfileStore,
  createStrategyRegistry,
  emptyCriteria,
  executeDiscoveryPipeline,
  jobDiscoveryStrategyV1,
  validateScore,
  type DiscoveryProfile,
  type DiscoveryStrategyModule,
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

function hit(url: string, title = 'Frontend Engineer') {
  return {
    discoveredUrl: url,
    title,
    source: { trust: 'AGGREGATOR' as const, url },
    data: { location: 'Berlin' },
  };
}

function onceSearch(results: ReturnType<typeof hit>[]) {
  return {
    async search() {
      return results.map((r) => ({ ...r, data: r.data ? { ...r.data } : undefined }));
    },
  };
}

describe('E2.5 Score', () => {
  it('successful scoring attaches Score immutably with bounds and breakdown', async () => {
    const hits = [hit('https://employer.example/jobs/1')];
    const frozen = structuredClone(hits);

    const result = await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      adapters: {
        search: onceSearch(hits),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
      },
      now: () => '2026-08-30T10:00:00.000Z',
      runId: 'run-score-ok',
    });

    expect(hits).toEqual(frozen);
    const cand = result.batch.active[0]!;
    expect(cand.stage).toBe('SCORED');
    expect(cand.score).toBeDefined();
    expect(cand.score!.matchScore).toBeGreaterThanOrEqual(0);
    expect(cand.score!.matchScore).toBeLessThanOrEqual(100);
    expect(cand.score!.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(cand.score!.confidenceScore).toBeLessThanOrEqual(100);
    expect(cand.score!.strategyVersion).toBe('1');
    expect(cand.score!.scoredAt).toBe('2026-08-30T10:00:00.000Z');
    expect(cand.score!.breakdown.dimensions.map((d) => d.id)).toEqual([
      'role',
      'location',
      'freshness',
      'source',
    ]);
    expect(typeof cand.rankValue).toBe('number');
    // Job rank is strategy-owned: match*0.6 + conf*0.4 — not a global product
    expect(cand.rankValue).toBe(
      cand.score!.matchScore * 0.6 + cand.score!.confidenceScore * 0.4
    );
    expect(cand.verification?.status).toBe('PASS');
  });

  it('scoring works without AI; AI may influence strategy dimensions only', async () => {
    const withoutAi = await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      adapters: {
        search: onceSearch([hit('https://employer.example/jobs/no-ai')]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
      },
      now: () => '2026-08-30T10:00:00.000Z',
      runId: 'run-score-no-ai',
    });
    expect(withoutAi.batch.active[0]?.aiEvaluation).toBeUndefined();
    expect(withoutAi.batch.active[0]?.score).toBeDefined();
    const baseMatch = withoutAi.batch.active[0]!.score!.matchScore;

    const withAi = await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      adapters: {
        search: onceSearch([hit('https://employer.example/jobs/with-ai')]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
        ai: createFakeAiAdapter({
          taskResults: [
            {
              task: 'RELEVANCE',
              outcome: 'INTERPRETED',
              interpretationConfidence: 1,
            },
            {
              task: 'SENIORITY',
              outcome: 'INTERPRETED',
              interpretationConfidence: 0.5,
            },
            {
              task: 'CLASSIFY',
              outcome: 'INTERPRETED',
              interpretationConfidence: 0.5,
            },
          ],
        }),
      },
      now: () => '2026-08-30T10:00:00.000Z',
      runId: 'run-score-with-ai',
    });
    const aiCand = withAi.batch.active[0]!;
    expect(aiCand.aiEvaluation).toBeDefined();
    expect(aiCand.score!.matchScore).toBeGreaterThanOrEqual(baseMatch);
    // confidence must not equal AI interpretationConfidence (0–1 scale)
    expect(aiCand.score!.confidenceScore).not.toBe(1);
    expect(aiCand.score!.confidenceScore).toBeGreaterThan(1);
    // verification unchanged by AI/score
    expect(aiCand.verification?.status).toBe('PASS');
  });

  it('rank() is delegated to strategy; engine has no global Match×Confidence product', async () => {
    const result = await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      adapters: {
        search: onceSearch([hit('https://employer.example/jobs/rank')]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
      },
      now: () => '2026-08-30T10:00:00.000Z',
      runId: 'run-score-rank',
    });
    const cand = result.batch.active[0]!;
    const strategyRank = jobDiscoveryStrategyV1.scoringPolicy.rank(cand.score!, {});
    expect(cand.rankValue).toBe(strategyRank);
    // Explicitly not match * confidence
    expect(cand.rankValue).not.toBe(cand.score!.matchScore * cand.score!.confidenceScore);
  });

  it('hard verification failure never reaches Score', async () => {
    const result = await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      adapters: {
        search: onceSearch([hit('https://employer.example/jobs/fail')]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'FAIL' }),
      },
      now: () => '2026-08-30T10:00:00.000Z',
      runId: 'run-score-no-fail',
    });
    expect(result.batch.active).toHaveLength(0);
    expect(result.batch.rejected[0]?.candidate.score).toBeUndefined();
    expect(
      result.stageDiagnostics.some(
        (d) => d.stage === 'score' && d.candidateId && d.outcome === 'ok' && d.message?.includes('Scored')
      )
    ).toBe(false);
  });

  it('invalid strategy score is not silently accepted', async () => {
    const bad: DiscoveryStrategyModule = {
      ...jobDiscoveryStrategyV1,
      id: 'job-discovery',
      version: '1',
      scoringPolicy: {
        ...jobDiscoveryStrategyV1.scoringPolicy,
        score() {
          return {
            matchScore: 150,
            confidenceScore: 50,
            breakdown: {
              dimensions: jobDiscoveryStrategyV1.scoringPolicy.dimensions.map((d) => ({
                id: d.id,
                labelKey: d.labelKey,
                value: 50,
                weight: d.weight,
              })),
            },
            scoredAt: 't',
            strategyVersion: '1',
          };
        },
      },
    };
    const registry = createStrategyRegistry([bad]);
    const result = await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry,
      profileStore: createInMemoryProfileStore([jobProfile()]),
      adapters: {
        search: onceSearch([hit('https://employer.example/jobs/bad-score')]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
      },
      now: () => '2026-08-30T10:00:00.000Z',
      runId: 'run-score-invalid',
    });
    expect(result.batch.active[0]?.score).toBeUndefined();
    expect(result.batch.active[0]?.stage).not.toBe('SCORED');
    expect(
      result.stageDiagnostics.some((d) => d.reasonCode === 'SCORE_INVALID')
    ).toBe(true);
    expect(result.run.status).toBe('PARTIAL_SUCCESS');
  });

  it('scoring is deterministic for identical inputs', async () => {
    const run = () =>
      executeDiscoveryPipeline({
        profileId: 'profile-job',
        registry: createDefaultDiscoveryRegistry(),
        profileStore: createInMemoryProfileStore([jobProfile()]),
        adapters: {
          search: onceSearch([hit('https://employer.example/jobs/det')]),
          verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
        },
        now: () => '2026-08-30T10:00:00.000Z',
        runId: 'run-score-det',
      });
    const a = await run();
    const b = await run();
    expect(a.batch.active[0]?.score).toEqual(b.batch.active[0]?.score);
    expect(a.batch.active[0]?.rankValue).toBe(b.batch.active[0]?.rankValue);
  });

  it('validateScore rejects out-of-range and version mismatch', () => {
    const dims = jobDiscoveryStrategyV1.scoringPolicy.dimensions;
    const base = {
      matchScore: 80,
      confidenceScore: 90,
      breakdown: {
        dimensions: dims.map((d) => ({
          id: d.id,
          labelKey: d.labelKey,
          value: 80,
          weight: d.weight,
        })),
      },
      scoredAt: 't',
      strategyVersion: '1',
    };
    expect(
      validateScore({
        score: base,
        policyDimensions: dims,
        expectedStrategyVersion: '1',
      }).ok
    ).toBe(true);
    expect(
      validateScore({
        score: { ...base, matchScore: -1 },
        policyDimensions: dims,
        expectedStrategyVersion: '1',
      }).ok
    ).toBe(false);
    expect(
      validateScore({
        score: { ...base, strategyVersion: '99' },
        policyDimensions: dims,
        expectedStrategyVersion: '1',
      }).ok
    ).toBe(false);
  });

  it('AI → Score order; filtered candidates never scored', async () => {
    const result = await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      adapters: {
        search: onceSearch([
          hit('https://employer.example/jobs/lead', 'Team Lead Frontend'),
          hit('https://employer.example/jobs/fe', 'Frontend Engineer'),
        ]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
        ai: createFakeAiAdapter(),
      },
      now: () => '2026-08-30T10:00:00.000Z',
      runId: 'run-score-order',
    });
    const stages = result.stageDiagnostics.map((d) => d.stage);
    expect(stages.indexOf('ai_evaluate')).toBeLessThan(stages.indexOf('score'));
    expect(stages.indexOf('score')).toBeLessThan(stages.indexOf('novelty_state'));
    expect(result.batch.active.every((c) => c.stage === 'SCORED' && c.score)).toBe(
      true
    );
    expect(
      result.batch.rejected.some(
        (r) => r.rejection.reasonCode === 'REJECTED_EXCLUDED_ROLE'
      )
    ).toBe(true);
  });
});
