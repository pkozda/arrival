import { describe, expect, it } from 'vitest';
import {
  createDefaultDiscoveryRegistry,
  createFakeVerificationAdapter,
  createInMemoryProfileStore,
  createInMemoryResultStore,
  decideNovelty,
  detectMaterialChange,
  emptyCriteria,
  executeDiscoveryPipeline,
  presentationFromCandidate,
  ResultStoreError,
  type DiscoveryCandidate,
  type DiscoveryProfile,
  type DiscoveryResult,
  type NoveltyPolicy,
} from '../index.js';
import { jobDiscoveryStrategyV1 } from '../strategies/job-discovery-v1.js';

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

function baseExisting(
  overrides: Partial<DiscoveryResult> = {}
): DiscoveryResult {
  return {
    id: 'result-1',
    profileId: 'profile-job',
    strategyId: 'job-discovery',
    strategyVersion: '1',
    identity: {
      externalIds: { url: 'https://employer.example/jobs/1' },
      canonicalUrl: 'https://employer.example/jobs/1',
      fingerprintMaterial: {
        title: 'Frontend Engineer',
        company: 'Acme',
        url: 'https://employer.example/jobs/1',
      },
    },
    canonicalPresentation: {
      title: 'Frontend Engineer',
      summary: undefined,
      primaryUrl: 'https://employer.example/jobs/1',
    },
    source: { trust: 'AGGREGATOR', url: 'https://employer.example/jobs/1' },
    verification: {
      status: 'PASS',
      sourceTrust: 'OFFICIAL',
      freshness: 'CURRENT',
      checks: [{ id: 'official_source', outcome: 'TRUE', required: true }],
      verifiedAt: '2026-08-01T00:00:00.000Z',
      evidenceIds: ['e1'],
    },
    evidence: [
      {
        id: 'e1',
        type: 'OFFICIAL_SOURCE',
        sourceUrl: 'https://employer.example/jobs/1',
        statement: 'ok',
        capturedAt: '2026-08-01T00:00:00.000Z',
      },
    ],
    score: {
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
      scoredAt: '2026-08-01T00:00:00.000Z',
      strategyVersion: '1',
    },
    lifecycle: 'ACTIVE',
    userState: 'SEEN',
    firstSeenAt: '2026-08-01T00:00:00.000Z',
    lastVerifiedAt: '2026-08-01T00:00:00.000Z',
    lastChangedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

const jobNoveltyPolicy: NoveltyPolicy = {
  identityFingerprintFields: ['title', 'company'],
  materialFingerprintFields: ['title', 'company'],
  comparePresentation: true,
  compareVerificationStatus: true,
  scoreDeltaThreshold: 5,
  notifyOnMeaningfulUpdate: true,
};

const jobPolicyWithSalary = jobDiscoveryStrategyV1.noveltyPolicy;

function scoredCandidate(
  overrides: Partial<DiscoveryCandidate> = {}
): DiscoveryCandidate {
  const existing = baseExisting();
  return {
    id: 'c1',
    runId: 'r1',
    identity: structuredClone(existing.identity),
    source: { trust: 'AGGREGATOR', url: 'https://employer.example/jobs/1' },
    discoveredAt: '2026-08-30T12:00:00.000Z',
    raw: { ref: 'r' },
    extracted: { fields: { title: 'Frontend Engineer' } },
    stage: 'SCORED',
    deterministicFilterPassed: true,
    verification: structuredClone(existing.verification),
    score: structuredClone(existing.score),
    ...overrides,
  };
}

describe('E2.6 Novelty / State', () => {
  it('no existing Result → NEW + ACTIVE + notify', async () => {
    const store = createInMemoryResultStore([]);
    const snapshotBefore = store.snapshot();

    const result = await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      resultStore: store,
      adapters: {
        search: onceSearch([hit('https://employer.example/jobs/1')]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
      },
      now: () => '2026-08-30T12:00:00.000Z',
      runId: 'run-nov-new',
    });

    expect(store.snapshot()).toEqual(snapshotBefore);
    const cand = result.batch.active[0]!;
    expect(cand.stage).toBe('SCORED');
    expect(cand.noveltyDecision).toEqual({
      novelty: 'NEW',
      lifecycle: 'ACTIVE',
      userState: 'NEW',
      shouldNotify: true,
      reason: 'NEW_OPPORTUNITY',
      changedFields: [],
    });
  });

  it('identical material fields → UNCHANGED; does not notify; preserves SAVED', async () => {
    // Align existing score/presentation with what pipeline will produce by running once first
    const probe = await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      adapters: {
        search: onceSearch([hit('https://employer.example/jobs/1')]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
      },
      now: () => '2026-08-30T12:00:00.000Z',
      runId: 'run-nov-probe',
    });
    const scored = probe.batch.active[0]!;
    const existing = baseExisting({
      identity: structuredClone(scored.identity),
      canonicalPresentation: presentationFromCandidate(scored),
      verification: structuredClone(scored.verification!),
      score: structuredClone(scored.score!),
      userState: 'SAVED',
      lifecycle: 'ACTIVE',
      lastVerifiedAt: '2026-07-01T00:00:00.000Z',
      lastChangedAt: '2026-07-01T00:00:00.000Z',
    });

    const store = createInMemoryResultStore([existing]);
    const frozenStore = store.snapshot();

    const result = await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      resultStore: store,
      adapters: {
        search: onceSearch([hit('https://employer.example/jobs/1')]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
      },
      now: () => '2026-08-30T12:00:00.000Z',
      runId: 'run-nov-unchanged',
    });

    expect(store.snapshot()).toEqual(frozenStore);
    const decision = result.batch.active[0]!.noveltyDecision!;
    expect(decision.novelty).toBe('UNCHANGED');
    expect(decision.userState).toBe('SAVED');
    expect(decision.lifecycle).toBe('ACTIVE');
    expect(decision.shouldNotify).toBe(false);
    expect(decision.reason).toBe('NO_MATERIAL_CHANGE');
    expect(decision.changedFields).toEqual([]);
  });

  it('source URL change alone does not create NEW when identity fingerprints match', async () => {
    const probe = await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      adapters: {
        search: onceSearch([hit('https://employer.example/jobs/old')]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
      },
      now: () => '2026-08-30T12:00:00.000Z',
      runId: 'run-nov-url-probe',
    });
    const scored = probe.batch.active[0]!;
    const existing = baseExisting({
      identity: {
        ...structuredClone(scored.identity),
        canonicalUrl: 'https://employer.example/jobs/old',
        fingerprintMaterial: {
          ...scored.identity.fingerprintMaterial,
          url: 'https://employer.example/jobs/old',
        },
      },
      canonicalPresentation: {
        ...presentationFromCandidate(scored),
        primaryUrl: 'https://employer.example/jobs/old',
      },
      verification: structuredClone(scored.verification!),
      score: structuredClone(scored.score!),
      userState: 'NOTIFIED',
    });
    // Disable presentation URL compare for this identity-stability case via decision unit —
    // pipeline uses comparePresentation:true so primaryUrl change → UPDATED.
    // Identity lookup must still find the Result (not NEW).
    const store = createInMemoryResultStore([existing]);
    const result = await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      resultStore: store,
      adapters: {
        search: onceSearch([hit('https://employer.example/jobs/new-url')]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
      },
      now: () => '2026-08-30T12:00:00.000Z',
      runId: 'run-nov-url',
    });
    const decision = result.batch.active[0]!.noveltyDecision!;
    expect(decision.novelty).not.toBe('NEW');
    expect(decision.existingResultId).toBe('result-1');
  });

  it('pipeline UPDATED when presentation title changes; SAVED preserved; may notify', async () => {
    const probe = await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      adapters: {
        search: onceSearch([hit('https://employer.example/jobs/1')]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
      },
      now: () => '2026-08-30T12:00:00.000Z',
      runId: 'run-nov-upd-probe',
    });
    const scored = probe.batch.active[0]!;
    const existing = baseExisting({
      identity: structuredClone(scored.identity),
      canonicalPresentation: {
        title: 'Frontend Engineer — OLD',
        primaryUrl: scored.identity.canonicalUrl,
      },
      verification: structuredClone(scored.verification!),
      score: structuredClone(scored.score!),
      userState: 'SAVED',
      lifecycle: 'ACTIVE',
    });
    const store = createInMemoryResultStore([existing]);

    const result = await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      resultStore: store,
      adapters: {
        search: onceSearch([hit('https://employer.example/jobs/1')]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
      },
      now: () => '2026-08-30T12:00:00.000Z',
      runId: 'run-nov-upd-saved',
    });

    const decision = result.batch.active[0]!.noveltyDecision!;
    expect(decision.novelty).toBe('UPDATED');
    expect(decision.userState).toBe('SAVED');
    expect(decision.lifecycle).toBe('UPDATED');
    expect(decision.shouldNotify).toBe(true);
  });

  it('UPDATED with same identity fingerprints; DISMISSED preserved; no notify', () => {
    const existing = baseExisting({ userState: 'DISMISSED', lifecycle: 'ACTIVE' });
    const candidate: DiscoveryCandidate = {
      id: 'c1',
      runId: 'r1',
      identity: {
        externalIds: {},
        canonicalUrl: 'https://employer.example/jobs/1',
        fingerprintMaterial: {
          title: 'Frontend Engineer',
          company: 'Acme',
        },
      },
      source: { trust: 'AGGREGATOR' },
      discoveredAt: 't',
      raw: { ref: 'r' },
      extracted: { fields: { title: 'Frontend Engineer (Senior)' } },
      stage: 'SCORED',
      deterministicFilterPassed: true,
      verification: structuredClone(existing.verification),
      score: structuredClone(existing.score),
    };
    const decision = decideNovelty({
      existing,
      candidate,
      presentation: {
        title: 'Frontend Engineer (Senior)',
        primaryUrl: 'https://employer.example/jobs/1',
      },
      policy: jobNoveltyPolicy,
      notification: { emailEnabled: true, skipEmptyDigest: true },
    });
    expect(decision.novelty).toBe('UPDATED');
    expect(decision.lifecycle).toBe('UPDATED');
    expect(decision.userState).toBe('DISMISSED');
    expect(decision.shouldNotify).toBe(false);
    expect(decision.reason).toContain('MATERIAL_UPDATE');
  });

  it('EXPIRED is not resurrected; no notify', () => {
    const existing = baseExisting({
      lifecycle: 'EXPIRED',
      userState: 'EXPIRED',
    });
    const candidate: DiscoveryCandidate = {
      id: 'c1',
      runId: 'r1',
      identity: structuredClone(existing.identity),
      source: { trust: 'AGGREGATOR' },
      discoveredAt: 't',
      raw: { ref: 'r' },
      extracted: { fields: { title: 'Frontend Engineer' } },
      stage: 'SCORED',
      deterministicFilterPassed: true,
      verification: structuredClone(existing.verification),
      score: {
        ...structuredClone(existing.score),
        matchScore: 99,
      },
    };
    const decision = decideNovelty({
      existing,
      candidate,
      presentation: presentationFromCandidate(candidate),
      policy: jobNoveltyPolicy,
      notification: { emailEnabled: true, skipEmptyDigest: true },
    });
    expect(decision.novelty).toBe('UNCHANGED');
    expect(decision.lifecycle).toBe('EXPIRED');
    expect(decision.userState).toBe('EXPIRED');
    expect(decision.shouldNotify).toBe(false);
    expect(decision.reason).toBe('EXPIRED_OR_REMOVED_NOT_RESURRECTED');
  });

  it('UPDATED notification follows strategy policy (notifyOnMeaningfulUpdate)', () => {
    const existing = baseExisting({ userState: 'SEEN' });
    const candidate: DiscoveryCandidate = {
      id: 'c1',
      runId: 'r1',
      identity: {
        externalIds: {},
        fingerprintMaterial: { title: 'Frontend Engineer', company: 'Acme' },
      },
      source: { trust: 'AGGREGATOR' },
      discoveredAt: 't',
      raw: { ref: 'r' },
      extracted: { fields: { title: 'Frontend Engineer II' } },
      stage: 'SCORED',
      deterministicFilterPassed: true,
      verification: structuredClone(existing.verification),
      score: structuredClone(existing.score),
    };
    const notify = decideNovelty({
      existing,
      candidate,
      presentation: { title: 'Frontend Engineer II' },
      policy: { ...jobNoveltyPolicy, notifyOnMeaningfulUpdate: true },
      notification: { emailEnabled: true, skipEmptyDigest: true },
    });
    expect(notify.shouldNotify).toBe(true);

    const quiet = decideNovelty({
      existing,
      candidate,
      presentation: { title: 'Frontend Engineer II' },
      policy: { ...jobNoveltyPolicy, notifyOnMeaningfulUpdate: false },
      notification: { emailEnabled: true, skipEmptyDigest: true },
    });
    expect(quiet.shouldNotify).toBe(false);
  });

  it('transient timestamps alone are not material', () => {
    const existing = baseExisting();
    const candidate: DiscoveryCandidate = {
      id: 'c-new-run',
      runId: 'run-other',
      identity: {
        externalIds: {},
        fingerprintMaterial: { title: 'Frontend Engineer', company: 'Acme' },
        canonicalUrl: 'https://employer.example/jobs/1',
      },
      source: { trust: 'AGGREGATOR' },
      discoveredAt: '2026-08-30T12:00:00.000Z',
      raw: { ref: 'raw-other' },
      extracted: { fields: { title: 'Frontend Engineer' } },
      stage: 'SCORED',
      deterministicFilterPassed: true,
      verification: {
        ...structuredClone(existing.verification),
        verifiedAt: '2026-08-30T12:00:00.000Z',
      },
      score: {
        ...structuredClone(existing.score),
        scoredAt: '2026-08-30T12:00:00.000Z',
      },
    };
    const decision = decideNovelty({
      existing,
      candidate,
      presentation: {
        title: 'Frontend Engineer',
        primaryUrl: 'https://employer.example/jobs/1',
      },
      policy: jobNoveltyPolicy,
      notification: { emailEnabled: true, skipEmptyDigest: true },
    });
    expect(decision.novelty).toBe('UNCHANGED');
  });

  it('ResultStore failure is not treated as NEW', async () => {
    const failingStore = {
      async findByIdentity() {
        throw new ResultStoreError('boom');
      },
      async getById() {
        throw new ResultStoreError('boom');
      },
      async listByProfile() {
        throw new ResultStoreError('boom');
      },
    };
    const result = await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      resultStore: failingStore,
      adapters: {
        search: onceSearch([hit('https://employer.example/jobs/1')]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
      },
      now: () => '2026-08-30T12:00:00.000Z',
      runId: 'run-nov-fail',
    });
    expect(result.run.status).toBe('PARTIAL_SUCCESS');
    expect(result.batch.active[0]?.noveltyDecision).toBeUndefined();
    expect(
      result.stageDiagnostics.some((d) => d.reasonCode === 'RESULT_STORE_FAILED')
    ).toBe(true);
  });

  it('different identity is NEW; Score → Novelty order preserved', async () => {
    const store = createInMemoryResultStore([
      baseExisting({
        identity: {
          externalIds: {},
          fingerprintMaterial: { title: 'Other Role', company: 'OtherCo' },
        },
      }),
    ]);
    const result = await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      resultStore: store,
      adapters: {
        search: onceSearch([hit('https://employer.example/jobs/1')]),
        verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
      },
      now: () => '2026-08-30T12:00:00.000Z',
      runId: 'run-nov-diff',
    });
    expect(result.batch.active[0]?.noveltyDecision?.novelty).toBe('NEW');
    const stages = result.stageDiagnostics.map((d) => d.stage);
    expect(stages.indexOf('score')).toBeLessThan(stages.indexOf('novelty_state'));
    expect(stages.indexOf('novelty_state')).toBeLessThan(
      stages.indexOf('persist_promote')
    );
  });
});

describe('E7.5 changedFields', () => {
  it('NEW → changedFields is empty', () => {
    const decision = decideNovelty({
      existing: null,
      candidate: scoredCandidate(),
      presentation: { title: 'Frontend Engineer' },
      policy: jobPolicyWithSalary,
      notification: { emailEnabled: true, skipEmptyDigest: true },
    });
    expect(decision.changedFields).toEqual([]);
  });

  it('UNCHANGED → changedFields is empty', () => {
    const existing = baseExisting({
      materialFields: { salary: null },
    });
    const candidate = scoredCandidate({
      extracted: { fields: { title: 'Frontend Engineer', salary: null } },
    });
    const decision = decideNovelty({
      existing,
      candidate,
      presentation: presentationFromCandidate(candidate),
      policy: jobPolicyWithSalary,
      notification: { emailEnabled: true, skipEmptyDigest: true },
    });
    expect(decision.novelty).toBe('UNCHANGED');
    expect(decision.changedFields).toEqual([]);
  });

  it('material update → deterministic sorted changedFields', () => {
    const existing = baseExisting();
    const candidate = scoredCandidate({
      identity: {
        ...structuredClone(existing.identity),
        fingerprintMaterial: {
          title: 'Frontend Engineer II',
          company: 'Beta',
          url: 'https://employer.example/jobs/1',
        },
      },
      extracted: {
        fields: { title: 'Frontend Engineer II', company: 'Beta' },
      },
    });
    const material = detectMaterialChange({
      existing,
      candidate,
      presentation: {
        title: 'Frontend Engineer II',
        primaryUrl: 'https://employer.example/jobs/1',
      },
      policy: jobPolicyWithSalary,
    });
    expect(material.changed).toBe(true);
    expect(material.fields).toEqual([
      'fingerprint.company',
      'fingerprint.title',
      'presentation.title',
    ]);
    const decision = decideNovelty({
      existing,
      candidate,
      presentation: {
        title: 'Frontend Engineer II',
        primaryUrl: 'https://employer.example/jobs/1',
      },
      policy: jobPolicyWithSalary,
      notification: { emailEnabled: true, skipEmptyDigest: true },
    });
    expect(decision.changedFields).toEqual(material.fields);
    expect(decision.reason).toBe(
      `MATERIAL_UPDATE:${material.fields.join(',')}`
    );
  });
});

describe('E7.6 salary material change (Job strategy)', () => {
  it('salary change → UPDATED with extracted.salary in changedFields', () => {
    const existing = baseExisting({
      materialFields: { salary: '€60,000' },
    });
    const candidate = scoredCandidate({
      extracted: { fields: { title: 'Frontend Engineer', salary: '€65,000' } },
    });
    const decision = decideNovelty({
      existing,
      candidate,
      presentation: presentationFromCandidate(candidate),
      policy: jobPolicyWithSalary,
      notification: { emailEnabled: true, skipEmptyDigest: true },
    });
    expect(decision.novelty).toBe('UPDATED');
    expect(decision.changedFields).toEqual(['extracted.salary']);
    expect(decision.shouldNotify).toBe(true);
    expect(decision.existingResultId).toBe(existing.id);
  });

  it('salary absent → present → UPDATED', () => {
    const existing = baseExisting({ materialFields: { salary: null } });
    const candidate = scoredCandidate({
      extracted: { fields: { title: 'Frontend Engineer', salary: '€60,000' } },
    });
    const decision = decideNovelty({
      existing,
      candidate,
      presentation: presentationFromCandidate(candidate),
      policy: jobPolicyWithSalary,
      notification: { emailEnabled: true, skipEmptyDigest: true },
    });
    expect(decision.novelty).toBe('UPDATED');
    expect(decision.changedFields).toContain('extracted.salary');
  });

  it('unchanged salary → UNCHANGED', () => {
    const existing = baseExisting({
      materialFields: { salary: '€60,000' },
    });
    const candidate = scoredCandidate({
      extracted: { fields: { title: 'Frontend Engineer', salary: '€60,000' } },
    });
    const decision = decideNovelty({
      existing,
      candidate,
      presentation: presentationFromCandidate(candidate),
      policy: jobPolicyWithSalary,
      notification: { emailEnabled: true, skipEmptyDigest: true },
    });
    expect(decision.novelty).toBe('UNCHANGED');
    expect(decision.changedFields).toEqual([]);
  });

  it('salary change does not alter result identity fingerprints', () => {
    const existing = baseExisting({
      materialFields: { salary: '€60,000' },
    });
    const candidate = scoredCandidate({
      extracted: { fields: { title: 'Frontend Engineer', salary: '€65,000' } },
    });
    expect(candidate.identity.fingerprintMaterial.title).toBe(
      existing.identity.fingerprintMaterial.title
    );
    expect(candidate.identity.fingerprintMaterial.company).toBe(
      existing.identity.fingerprintMaterial.company
    );
  });
});
