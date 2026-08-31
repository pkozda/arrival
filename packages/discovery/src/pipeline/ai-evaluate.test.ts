import { describe, expect, it } from 'vitest';
import {
  canPromote,
  createDefaultDiscoveryRegistry,
  createFakeAiAdapter,
  createFakeVerificationAdapter,
  createInMemoryProfileStore,
  DEFAULT_ENGINE_POLICY,
  deriveVerificationStatus,
  emptyCriteria,
  evaluateAiGate,
  executeDiscoveryPipeline,
  isVerificationGateOpen,
  jobDiscoveryStrategyV1,
  purchaseRejectTask,
  toStrategyDescriptor,
  validateAiEvaluation,
  type DiscoveryCandidate,
  type DiscoveryProfile,
  type Score,
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

function giveawayProfile(
  overrides: Partial<DiscoveryProfile> = {}
): DiscoveryProfile {
  return {
    id: 'profile-give',
    userId: 'user-1',
    name: 'Giveaways',
    strategyId: 'giveaway-discovery',
    strategyVersion: '1',
    criteria: {
      ...emptyCriteria(),
      required: [
        { key: 'country', value: 'DE' },
        { key: 'freeParticipation', value: true },
      ],
      preferred: [{ key: 'prizeCategory', value: 'tech' }],
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
  };
}

function onceSearch(results: ReturnType<typeof hit>[]) {
  return {
    async search() {
      return results.map((r) => ({ ...r }));
    },
  };
}

function goodScore(): Score {
  return {
    matchScore: 80,
    confidenceScore: 90,
    breakdown: { dimensions: [] },
    scoredAt: '2026-08-30T00:00:00.000Z',
    strategyVersion: '1',
  };
}

describe('E2.4 AI Evaluation', () => {
  it('verified PASS candidate may reach AI; evaluation attached immutably', async () => {
    const ai = createFakeAiAdapter();
    const hits = [hit('https://employer.example/jobs/1')];
    const frozen = structuredClone(hits);

    const result = await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      adapters: {
        search: onceSearch(hits),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
        ai,
      },
      now: () => '2026-08-30T09:00:00.000Z',
      runId: 'run-ai-pass',
    });

    expect(hits).toEqual(frozen);
    expect(ai.callCount).toBe(1);
    const cand = result.batch.active[0]!;
    expect(cand.verification?.status).toBe('PASS');
    expect(cand.aiEvaluation?.tasks.length).toBeGreaterThan(0);
    expect(cand.stage).toBe('SCORED');
    expect(cand.aiEvaluation?.modelLabel).toBe('fake-ai-v1');
    // Only strategy-enabled tasks (job: SENIORITY, RELEVANCE, CLASSIFY)
    expect(
      cand.aiEvaluation!.tasks.every((t) =>
        ['SENIORITY', 'RELEVANCE', 'CLASSIFY'].includes(t.task)
      )
    ).toBe(true);
    expect(
      cand.aiEvaluation!.tasks.some((t) => t.task === 'PURCHASE_REQUIREMENT')
    ).toBe(false);
  });

  it('verification FAIL / UNKNOWN block AI; filtered candidates never reach AI', async () => {
    const aiFail = createFakeAiAdapter();
    await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      adapters: {
        search: onceSearch([hit('https://employer.example/jobs/fail')]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'FAIL' }),
        ai: aiFail,
      },
      now: () => '2026-08-30T09:00:00.000Z',
      runId: 'run-ai-block-fail',
    });
    expect(aiFail.callCount).toBe(0);

    const aiUnk = createFakeAiAdapter();
    await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      adapters: {
        search: onceSearch([hit('https://employer.example/jobs/unk')]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'UNKNOWN' }),
        ai: aiUnk,
      },
      now: () => '2026-08-30T09:00:00.000Z',
      runId: 'run-ai-block-unk',
    });
    expect(aiUnk.callCount).toBe(0);

    const aiFilter = createFakeAiAdapter();
    const filtered = await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      adapters: {
        search: onceSearch([
          hit('https://employer.example/jobs/lead', 'Team Lead Frontend'),
        ]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
        ai: aiFilter,
      },
      now: () => '2026-08-30T09:00:00.000Z',
      runId: 'run-ai-block-filter',
    });
    expect(aiFilter.callCount).toBe(0);
    expect(
      filtered.batch.rejected.some(
        (r) => r.rejection.reasonCode === 'REJECTED_EXCLUDED_ROLE'
      )
    ).toBe(true);
  });

  it('AI disabled (strategy) means adapter is not called; candidate continues', async () => {
    const registry = createDefaultDiscoveryRegistry();
    // Clone job strategy with AI disabled via a one-off registry entry is heavy;
    // use engine policy kill switch + strategy enabled path separately.
    const ai = createFakeAiAdapter();
    const result = await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry,
      profileStore: createInMemoryProfileStore([jobProfile()]),
      adapters: {
        search: onceSearch([hit('https://employer.example/jobs/1')]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
        ai,
      },
      enginePolicy: { ...DEFAULT_ENGINE_POLICY, aiEnabled: false },
      now: () => '2026-08-30T09:00:00.000Z',
      runId: 'run-ai-engine-off',
    });
    expect(ai.callCount).toBe(0);
    expect(result.batch.active).toHaveLength(1);
    expect(result.batch.active[0]?.aiEvaluation).toBeUndefined();
    expect(
      result.stageDiagnostics.some(
        (d) => d.stage === 'ai_evaluate' && d.reasonCode === 'AI_DISABLED_ENGINE'
      )
    ).toBe(true);
  });

  it('cost/budget gate blocks AI when exhausted', async () => {
    const ai = createFakeAiAdapter();
    const result = await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      adapters: {
        search: onceSearch([
          hit('https://employer.example/jobs/a'),
          hit('https://employer.example/jobs/b'),
        ]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
        ai,
      },
      enginePolicy: { ...DEFAULT_ENGINE_POLICY, maxAiEvaluationsPerRun: 0 },
      now: () => '2026-08-30T09:00:00.000Z',
      runId: 'run-ai-budget',
    });
    expect(ai.callCount).toBe(0);
    expect(
      result.stageDiagnostics.some((d) => d.reasonCode === 'AI_BUDGET_EXHAUSTED')
    ).toBe(true);
    expect(result.batch.active).toHaveLength(2);
  });

  it('confidence range validated; invalid AI output does not attach', async () => {
    const valid = validateAiEvaluation({
      evaluation: {
        tasks: [
          {
            task: 'RELEVANCE',
            outcome: 'INTERPRETED',
            interpretationConfidence: 0.5,
          },
        ],
        evaluatedAt: 't',
      },
      allowedTasks: ['RELEVANCE'],
      rejectOn: [],
      knownEvidenceIds: new Set(),
    });
    expect(valid.ok).toBe(true);

    const badConf = validateAiEvaluation({
      evaluation: {
        tasks: [
          {
            task: 'RELEVANCE',
            outcome: 'INTERPRETED',
            interpretationConfidence: 1.5,
          },
        ],
        evaluatedAt: 't',
      },
      allowedTasks: ['RELEVANCE'],
      rejectOn: [],
      knownEvidenceIds: new Set(),
    });
    expect(badConf.ok).toBe(false);

    const ai = createFakeAiAdapter({
      taskResults: [
        {
          task: 'RELEVANCE',
          outcome: 'INTERPRETED',
          interpretationConfidence: 2,
        },
      ],
    });
    const result = await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      adapters: {
        search: onceSearch([hit('https://employer.example/jobs/1')]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
        ai,
      },
      now: () => '2026-08-30T09:00:00.000Z',
      runId: 'run-ai-bad-conf',
    });
    expect(result.batch.active[0]?.aiEvaluation).toBeUndefined();
    expect(
      result.stageDiagnostics.some((d) => d.reasonCode === 'AI_OUTPUT_INVALID')
    ).toBe(true);
    expect(result.run.status).toBe('PARTIAL_SUCCESS');
  });

  it('AI cannot create Evidence; may only reference existing Evidence IDs', async () => {
    const badRef = validateAiEvaluation({
      evaluation: {
        tasks: [
          {
            task: 'RELEVANCE',
            outcome: 'INTERPRETED',
            evidenceIds: ['ghost'],
          },
        ],
        evaluatedAt: 't',
      },
      allowedTasks: ['RELEVANCE'],
      rejectOn: [],
      knownEvidenceIds: new Set(['real']),
    });
    expect(badRef.ok).toBe(false);

    const urlClaim = validateAiEvaluation({
      evaluation: {
        tasks: [
          {
            task: 'EXTRACT',
            outcome: 'INTERPRETED',
            details: { sourceUrl: 'https://invented.example/x' },
          },
        ],
        evaluatedAt: 't',
      },
      allowedTasks: ['EXTRACT'],
      rejectOn: [],
      knownEvidenceIds: new Set(),
    });
    expect(urlClaim.ok).toBe(false);

    const ai = createFakeAiAdapter({
      taskResults: [
        {
          task: 'RELEVANCE',
          outcome: 'INTERPRETED',
          interpretationConfidence: 0.7,
          evidenceIds: ['ev:run-ai-ev:cand:0:official'],
        },
      ],
    });
    const result = await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      adapters: {
        search: onceSearch([hit('https://employer.example/jobs/1')]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
        ai,
      },
      now: () => '2026-08-30T09:00:00.000Z',
      runId: 'run-ai-ev',
    });
    const cand = result.batch.active[0]!;
    expect(cand.evidence?.length).toBeGreaterThan(0);
    expect(cand.aiEvaluation?.tasks[0]?.evidenceIds?.[0]).toBe(
      cand.evidence![0]!.id
    );
    // AI did not append Evidence
    expect(cand.evidence!.every((e) => e.id.startsWith('ev:'))).toBe(true);
  });

  it('AI cannot change VerificationResult or open promotion without PASS', async () => {
    const ai = createFakeAiAdapter();
    const result = await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      adapters: {
        search: onceSearch([hit('https://employer.example/jobs/1')]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
        ai,
      },
      now: () => '2026-08-30T09:00:00.000Z',
      runId: 'run-ai-vr',
    });
    const cand = result.batch.active[0]!;
    const beforeStatus = cand.verification!.status;
    expect(beforeStatus).toBe('PASS');
    expect(cand.verification?.checks.find((c) => c.id === 'official_source')?.outcome).toBe(
      'TRUE'
    );

    // UNKNOWN cannot be "fixed" by AI — gate blocks
    expect(
      isVerificationGateOpen({
        deterministicFilterPassed: true,
        verification: {
          status: 'UNKNOWN',
          sourceTrust: 'UNKNOWN',
          freshness: 'UNKNOWN',
          checks: [],
          verifiedAt: 't',
          evidenceIds: [],
        },
      })
    ).toBe(false);

    // AI evaluation alone does not make promotion eligible without score
    const decision = canPromote({
      candidate: cand,
      verification: cand.verification!,
      score: null,
      strategy: toStrategyDescriptor(jobDiscoveryStrategyV1),
    });
    expect(decision.eligible).toBe(false);
  });

  it('configured rejectOn can reject; non-configured rejection is invalid', async () => {
    // Giveaway allows REJECTED_PURCHASE_REQUIRED
    const aiOk = createFakeAiAdapter({
      taskResults: [purchaseRejectTask()],
    });
    const rejected = await executeDiscoveryPipeline({
      profileId: 'profile-give',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([giveawayProfile()]),
      adapters: {
        search: onceSearch([
          {
            discoveredUrl: 'https://brand.example/giveaway/1',
            title: 'Free gadget',
            source: { trust: 'AGGREGATOR', url: 'https://brand.example/giveaway/1' },
            data: { purchaseRequired: null },
          },
        ]),
        verify: createFakeVerificationAdapter({
          defaultOutcome: 'PASS',
          // giveaway does not require official — still PASS
        }),
        ai: aiOk,
      },
      now: () => '2026-08-30T09:00:00.000Z',
      runId: 'run-ai-purchase',
    });
    expect(
      rejected.batch.rejected.some(
        (r) => r.rejection.reasonCode === 'REJECTED_PURCHASE_REQUIRED'
      )
    ).toBe(true);
    expect(rejected.batch.rejected[0]?.candidate.verification?.status).toBe('PASS');

    // Job strategy rejectOn does not include PURCHASE — invalid
    const forbidden = validateAiEvaluation({
      evaluation: {
        tasks: [purchaseRejectTask()],
        evaluatedAt: 't',
      },
      allowedTasks: ['PURCHASE_REQUIREMENT'],
      rejectOn: ['REJECTED_EXCLUDED_ROLE'],
      knownEvidenceIds: new Set(),
    });
    expect(forbidden.ok).toBe(false);
  });

  it('adapter failure is explicit; does not claim success; preserves order', async () => {
    const ai = createFakeAiAdapter({
      failCandidateIds: ['run-ai-partial:cand:1'],
    });
    const result = await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      adapters: {
        search: onceSearch([
          hit('https://employer.example/jobs/a'),
          hit('https://employer.example/jobs/b'),
        ]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
        ai,
      },
      now: () => '2026-08-30T09:00:00.000Z',
      runId: 'run-ai-partial',
    });

    expect(result.run.status).toBe('PARTIAL_SUCCESS');
    expect(
      result.stageDiagnostics.some((d) => d.reasonCode === 'AI_ADAPTER_FAILED')
    ).toBe(true);
    expect(result.batch.active).toHaveLength(2);
    expect(result.batch.active[0]?.identity.canonicalUrl).toBe(
      'https://employer.example/jobs/a'
    );
    expect(result.batch.active[0]?.aiEvaluation).toBeDefined();
    expect(result.batch.active[1]?.aiEvaluation).toBeUndefined();
  });

  it('evaluateAiGate unit: PASS allows; FAIL/disabled/budget block', () => {
    const base = {
      deterministicFilterPassed: true,
      verification: { status: 'PASS' },
    };
    expect(
      evaluateAiGate({
        candidate: base,
        strategyPolicy: {
          enabled: true,
          tasks: ['RELEVANCE'],
          rejectOn: [],
        },
        enginePolicy: DEFAULT_ENGINE_POLICY,
        aiEvaluationsUsed: 0,
        hasAdapter: true,
      }).allow
    ).toBe(true);

    expect(
      evaluateAiGate({
        candidate: { ...base, verification: { status: 'FAIL' } },
        strategyPolicy: {
          enabled: true,
          tasks: ['RELEVANCE'],
          rejectOn: [],
        },
        enginePolicy: DEFAULT_ENGINE_POLICY,
        aiEvaluationsUsed: 0,
        hasAdapter: true,
      })
    ).toEqual({ allow: false, reason: 'VERIFICATION_NOT_PASS' });

    expect(
      evaluateAiGate({
        candidate: base,
        strategyPolicy: {
          enabled: false,
          tasks: ['RELEVANCE'],
          rejectOn: [],
        },
        enginePolicy: DEFAULT_ENGINE_POLICY,
        aiEvaluationsUsed: 0,
        hasAdapter: true,
      })
    ).toEqual({ allow: false, reason: 'AI_DISABLED_STRATEGY' });
  });

  it('AI cannot turn UNKNOWN/FAIL into PASS via validation forbidden keys', () => {
    const spoof = validateAiEvaluation({
      evaluation: {
        tasks: [
          {
            task: 'CLASSIFY',
            outcome: 'INTERPRETED',
            details: { verificationStatus: 'PASS' },
          },
        ],
        evaluatedAt: 't',
      },
      allowedTasks: ['CLASSIFY'],
      rejectOn: [],
      knownEvidenceIds: new Set(),
    });
    expect(spoof.ok).toBe(false);

    const checks = [
      { id: 'official_source', outcome: 'UNKNOWN' as const, required: true },
    ];
    expect(deriveVerificationStatus(checks)).toBe('UNKNOWN');
    // Score still required for promotion — AI alone insufficient
    const cand: DiscoveryCandidate = {
      id: 'c',
      runId: 'r',
      identity: { externalIds: {}, fingerprintMaterial: {} },
      source: { trust: 'UNKNOWN' },
      discoveredAt: 't',
      raw: { ref: 'r' },
      extracted: { fields: {} },
      stage: 'AI_EVALUATING',
      deterministicFilterPassed: true,
      verification: {
        status: 'UNKNOWN',
        sourceTrust: 'UNKNOWN',
        freshness: 'UNKNOWN',
        checks,
        verifiedAt: 't',
        evidenceIds: [],
      },
      aiEvaluation: {
        tasks: [{ task: 'CLASSIFY', outcome: 'INTERPRETED' }],
        evaluatedAt: 't',
      },
    };
    expect(
      canPromote({
        candidate: cand,
        verification: cand.verification!,
        score: goodScore(),
        strategy: toStrategyDescriptor(jobDiscoveryStrategyV1),
      }).eligible
    ).toBe(false);
  });

  it('Verify → AI order preserved in diagnostics', async () => {
    const result = await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      adapters: {
        search: onceSearch([hit('https://employer.example/jobs/1')]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
        ai: createFakeAiAdapter(),
      },
      now: () => '2026-08-30T09:00:00.000Z',
      runId: 'run-ai-order',
    });
    const stages = result.stageDiagnostics.map((d) => d.stage);
    expect(stages.indexOf('verify')).toBeLessThan(stages.indexOf('ai_evaluate'));
    expect(stages.indexOf('ai_evaluate')).toBeLessThan(stages.indexOf('score'));
  });
});
