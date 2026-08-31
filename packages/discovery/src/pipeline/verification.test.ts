import { describe, expect, it } from 'vitest';
import {
  assertAttributableEvidence,
  canPromote,
  createDefaultDiscoveryRegistry,
  createFakeVerificationAdapter,
  createInMemoryProfileStore,
  deriveVerificationStatus,
  emptyCriteria,
  executeDiscoveryPipeline,
  isVerificationGateOpen,
  jobDiscoveryStrategyV1,
  toStrategyDescriptor,
  validateEvidenceList,
  type DiscoveryCandidate,
  type DiscoveryProfile,
  type Evidence,
  type Score,
  type VerificationResult,
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

function hit(url: string, title = 'Frontend Engineer') {
  return {
    discoveredUrl: url,
    title,
    source: { trust: 'AGGREGATOR' as const, url },
  };
}

/** One-shot search — avoids JobDiscovery multi-query multiplying fixtures. */
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

describe('E2.3 Verification', () => {
  it('all required checks TRUE → PASS', async () => {
    const result = await executeDiscoveryPipeline({
      profileId: 'profile-1',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([baseProfile()]),
      adapters: {
        search: onceSearch([hit('https://employer.example/jobs/1')]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
      },
      now: () => '2026-08-30T08:00:00.000Z',
      runId: 'run-pass',
    });

    expect(result.batch.active).toHaveLength(1);
    const cand = result.batch.active[0]!;
    expect(cand.verification?.status).toBe('PASS');
    expect(
      cand.verification?.checks.every((c) => !c.required || c.outcome === 'TRUE')
    ).toBe(true);
    expect(cand.stage).toBe('SCORED');
    expect(isVerificationGateOpen(cand)).toBe(true);
  });

  it('required FALSE → FAIL rejection', async () => {
    const result = await executeDiscoveryPipeline({
      profileId: 'profile-1',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([baseProfile()]),
      adapters: {
        search: onceSearch([hit('https://employer.example/jobs/fail')]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'FAIL' }),
      },
      now: () => '2026-08-30T08:00:00.000Z',
      runId: 'run-fail',
    });

    expect(result.batch.active).toHaveLength(0);
    const rejected = result.batch.rejected[0]!;
    expect(rejected.rejection.reasonCode).toBe('REJECTED_VERIFICATION_FAIL');
    expect(rejected.rejection.atStage).toBe('VERIFYING');
    expect(rejected.candidate.verification?.status).toBe('FAIL');
    expect(isVerificationGateOpen(rejected.candidate)).toBe(false);
  });

  it('required UNKNOWN → REJECTED_VERIFICATION_UNKNOWN', async () => {
    const result = await executeDiscoveryPipeline({
      profileId: 'profile-1',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([baseProfile()]),
      adapters: {
        search: onceSearch([hit('https://employer.example/jobs/unk')]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'UNKNOWN' }),
      },
      now: () => '2026-08-30T08:00:00.000Z',
      runId: 'run-unk',
    });

    const rejected = result.batch.rejected[0]!;
    expect(rejected.rejection.reasonCode).toBe('REJECTED_VERIFICATION_UNKNOWN');
    expect(rejected.candidate.verification?.status).toBe('UNKNOWN');
    expect(isVerificationGateOpen(rejected.candidate)).toBe(false);
  });

  it('PASS can proceed toward promotion; FAIL/UNKNOWN cannot', () => {
    const strategy = toStrategyDescriptor(jobDiscoveryStrategyV1);
    const base: DiscoveryCandidate = {
      id: 'c1',
      runId: 'r1',
      identity: {
        externalIds: {},
        canonicalUrl: 'https://employer.example/jobs/1',
        fingerprintMaterial: {},
      },
      source: { trust: 'AGGREGATOR' },
      discoveredAt: 't',
      raw: { ref: 'r' },
      extracted: { fields: {} },
      stage: 'VERIFYING',
      deterministicFilterPassed: true,
    };

    const passChecks = [
      { id: 'official_source', outcome: 'TRUE' as const, required: true },
    ];
    const passVr: VerificationResult = {
      status: deriveVerificationStatus(passChecks),
      sourceTrust: 'OFFICIAL',
      freshness: 'CURRENT',
      checks: passChecks,
      verifiedAt: 't',
      evidenceIds: ['e1'],
    };
    expect(
      canPromote({
        candidate: base,
        verification: passVr,
        score: goodScore(),
        strategy,
      }).eligible
    ).toBe(true);

    const failChecks = [
      { id: 'official_source', outcome: 'FALSE' as const, required: true },
    ];
    expect(
      canPromote({
        candidate: base,
        verification: {
          status: deriveVerificationStatus(failChecks),
          sourceTrust: 'AGGREGATOR',
          freshness: 'UNKNOWN',
          checks: failChecks,
          verifiedAt: 't',
          evidenceIds: [],
        },
        score: goodScore(),
        strategy,
      }).eligible
    ).toBe(false);

    const unkChecks = [
      { id: 'official_source', outcome: 'UNKNOWN' as const, required: true },
    ];
    expect(
      canPromote({
        candidate: base,
        verification: {
          status: deriveVerificationStatus(unkChecks),
          sourceTrust: 'UNKNOWN',
          freshness: 'UNKNOWN',
          checks: unkChecks,
          verifiedAt: 't',
          evidenceIds: [],
        },
        score: goodScore(),
        strategy,
      }).eligible
    ).toBe(false);
  });

  it('official source TRUE satisfies requireOfficialSource; aggregator alone does not', async () => {
    const registry = createDefaultDiscoveryRegistry();
    const store = createInMemoryProfileStore([baseProfile()]);

    const pass = await executeDiscoveryPipeline({
      profileId: 'profile-1',
      registry,
      profileStore: store,
      adapters: {
        search: onceSearch([hit('https://employer.example/jobs/official')]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
      },
      now: () => '2026-08-30T08:00:00.000Z',
      runId: 'run-official-ok',
    });
    expect(pass.batch.active[0]?.verification?.sourceTrust).toBe('OFFICIAL');
    expect(
      pass.batch.active[0]?.verification?.checks.find((c) => c.id === 'official_source')
        ?.outcome
    ).toBe('TRUE');

    const aggOnly = await executeDiscoveryPipeline({
      profileId: 'profile-1',
      registry,
      profileStore: store,
      adapters: {
        search: onceSearch([hit('https://board.example/jobs/agg-only')]),
        verify: {
          async verify(req) {
            return {
              ok: true as const,
              result: {
                sourceTrust: 'AGGREGATOR' as const,
                freshness: 'CURRENT' as const,
                checks: [
                  {
                    id: 'official_source',
                    outcome: 'TRUE' as const,
                    required: true,
                    detail: 'Spoofed — aggregator claiming official',
                  },
                ],
                verifiedAt: req.now(),
                evidenceIds: ['e-agg'],
              },
              evidence: [
                {
                  id: 'e-agg',
                  type: 'OFFICIAL_SOURCE' as const,
                  sourceUrl: 'https://board.example/jobs/agg-only',
                  statement: 'From aggregator',
                  capturedAt: req.now(),
                },
              ],
            };
          },
        },
      },
      now: () => '2026-08-30T08:00:00.000Z',
      runId: 'run-agg-spoof',
    });

    expect(aggOnly.batch.active).toHaveLength(0);
    expect(aggOnly.batch.rejected[0]?.rejection.reasonCode).toBe(
      'REJECTED_VERIFICATION_FAIL'
    );
    expect(aggOnly.batch.rejected[0]?.candidate.verification?.status).toBe('FAIL');
  });

  it('official source UNKNOWN / FALSE do not pass', async () => {
    const registry = createDefaultDiscoveryRegistry();
    const store = createInMemoryProfileStore([baseProfile()]);

    const unk = await executeDiscoveryPipeline({
      profileId: 'profile-1',
      registry,
      profileStore: store,
      adapters: {
        search: onceSearch([hit('https://employer.example/jobs/off-unk')]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'UNKNOWN' }),
      },
      now: () => '2026-08-30T08:00:00.000Z',
      runId: 'run-off-unk',
    });
    expect(unk.batch.rejected[0]?.rejection.reasonCode).toBe(
      'REJECTED_VERIFICATION_UNKNOWN'
    );

    const falsy = await executeDiscoveryPipeline({
      profileId: 'profile-1',
      registry,
      profileStore: store,
      adapters: {
        search: onceSearch([hit('https://employer.example/jobs/off-false')]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'FAIL' }),
      },
      now: () => '2026-08-30T08:00:00.000Z',
      runId: 'run-off-false',
    });
    expect(falsy.batch.rejected[0]?.rejection.reasonCode).toBe(
      'REJECTED_VERIFICATION_FAIL'
    );
  });

  it('valid Evidence retained; fabricated/missing URL rejected by validation', () => {
    const good: Evidence = {
      id: 'e1',
      type: 'OFFICIAL_SOURCE',
      sourceUrl: 'https://employer.example/jobs/1',
      statement: 'Listing present',
      capturedAt: 't',
    };
    expect(assertAttributableEvidence(good)).toEqual({ ok: true });
    expect(validateEvidenceList([good]).ok).toBe(true);

    expect(assertAttributableEvidence({ ...good, sourceUrl: '' }).ok).toBe(false);
    expect(
      assertAttributableEvidence({ ...good, sourceUrl: 'AI generated' }).ok
    ).toBe(false);
    expect(
      assertAttributableEvidence({ ...good, sourceUrl: 'ai-generated://x' }).ok
    ).toBe(false);
  });

  it('pipeline rejects invalid / unsupported Evidence claims', async () => {
    const registry = createDefaultDiscoveryRegistry();
    const store = createInMemoryProfileStore([baseProfile()]);

    const invalid = await executeDiscoveryPipeline({
      profileId: 'profile-1',
      registry,
      profileStore: store,
      adapters: {
        search: onceSearch([hit('https://employer.example/jobs/bad-ev')]),
        verify: createFakeVerificationAdapter({
          defaultOutcome: 'PASS',
          invalidEvidenceCandidateIds: ['run-bad-ev:cand:0'],
        }),
      },
      now: () => '2026-08-30T08:00:00.000Z',
      runId: 'run-bad-ev',
    });
    expect(invalid.batch.active).toHaveLength(0);
    expect(
      invalid.batch.rejected.some(
        (r) => r.rejection.details?.failure === 'INVALID_EVIDENCE'
      )
    ).toBe(true);

    const unsupported = await executeDiscoveryPipeline({
      profileId: 'profile-1',
      registry,
      profileStore: store,
      adapters: {
        search: onceSearch([hit('https://employer.example/jobs/ghost-ev')]),
        verify: createFakeVerificationAdapter({
          defaultOutcome: 'PASS',
          unsupportedEvidenceIdsByCandidateId: {
            'run-ghost-ev:cand:0': ['ghost-id'],
          },
        }),
      },
      now: () => '2026-08-30T08:00:00.000Z',
      runId: 'run-ghost-ev',
    });
    expect(unsupported.batch.active).toHaveLength(0);
    expect(
      unsupported.stageDiagnostics.some((d) => d.reasonCode === 'INVALID_EVIDENCE')
    ).toBe(true);
  });

  it('PASS attaches evidenceIds; does not mutate inputs; preserves order', async () => {
    const hits = [
      hit('https://employer.example/jobs/a', 'Frontend Engineer'),
      hit('https://employer.example/jobs/b', 'Frontend Engineer'),
    ];
    const frozen = structuredClone(hits);

    const result = await executeDiscoveryPipeline({
      profileId: 'profile-1',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([baseProfile()]),
      adapters: {
        search: onceSearch(hits),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
      },
      now: () => '2026-08-30T08:00:00.000Z',
      runId: 'run-order-v',
    });

    expect(hits).toEqual(frozen);
    expect(result.batch.active).toHaveLength(2);
    expect(result.batch.active[0]?.identity.canonicalUrl).toBe(
      'https://employer.example/jobs/a'
    );
    expect(result.batch.active[1]?.identity.canonicalUrl).toBe(
      'https://employer.example/jobs/b'
    );
    for (const cand of result.batch.active) {
      expect(cand.verification?.evidenceIds.length).toBeGreaterThan(0);
      expect(cand.evidence?.length).toBeGreaterThan(0);
      expect(cand.verification!.evidenceIds[0]).toBe(cand.evidence![0]!.id);
    }
  });

  it('one VERIFY failure does not discard PASS siblings; adapter failure explicit', async () => {
    const result = await executeDiscoveryPipeline({
      profileId: 'profile-1',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([baseProfile()]),
      adapters: {
        search: onceSearch([
          hit('https://employer.example/jobs/ok'),
          hit('https://employer.example/jobs/boom'),
        ]),
        verify: createFakeVerificationAdapter({
          defaultOutcome: 'PASS',
          failCandidateIds: ['run-partial-v:cand:1'],
        }),
      },
      now: () => '2026-08-30T08:00:00.000Z',
      runId: 'run-partial-v',
    });

    expect(result.run.status).toBe('PARTIAL_SUCCESS');
    expect(result.batch.active.some((c) => c.verification?.status === 'PASS')).toBe(
      true
    );
    expect(
      result.batch.rejected.some(
        (r) => r.rejection.details?.failure === 'VERIFY_ADAPTER_FAILED'
      )
    ).toBe(true);
    expect(
      result.stageDiagnostics.some((d) => d.reasonCode === 'VERIFY_ADAPTER_FAILED')
    ).toBe(true);
  });

  it('Filter → Verify order; rejected filter candidates never verify', async () => {
    const result = await executeDiscoveryPipeline({
      profileId: 'profile-1',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([baseProfile()]),
      adapters: {
        search: onceSearch([
          hit('https://employer.example/jobs/lead', 'Team Lead Frontend'),
          hit('https://employer.example/jobs/fe', 'Frontend Engineer'),
        ]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
      },
      now: () => '2026-08-30T08:00:00.000Z',
      runId: 'run-filter-gate',
    });

    const stages = result.stageDiagnostics.map((d) => d.stage);
    expect(stages.indexOf('filter')).toBeLessThan(stages.indexOf('verify'));
    expect(
      result.batch.rejected.some(
        (r) => r.rejection.reasonCode === 'REJECTED_EXCLUDED_ROLE'
      )
    ).toBe(true);
    const leadId = result.batch.rejected.find(
      (r) => r.rejection.reasonCode === 'REJECTED_EXCLUDED_ROLE'
    )?.candidate.id;
    expect(
      result.stageDiagnostics.some(
        (d) => d.stage === 'verify' && d.candidateId === leadId && d.outcome === 'ok'
      )
    ).toBe(false);
    expect(result.batch.active.every((c) => c.verification?.status === 'PASS')).toBe(
      true
    );
  });
});
