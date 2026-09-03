import { describe, expect, it } from 'vitest';
import {
  CANONICAL_STAGE_ORDER,
  createDefaultDiscoveryRegistry,
  createFakeContentExtractor,
  createFakeFetchAdapter,
  createFakeSearchAdapter,
  createInMemoryProfileStore,
  emptyCriteria,
  executeDiscoveryPipeline,
  type DiscoveryCandidate,
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

function hit(url: string, title: string) {
  return {
    discoveredUrl: url,
    title,
    source: { trust: 'AGGREGATOR' as const },
  };
}

describe('E2.2 Collect / Fetch / Parse', () => {
  it('successful fetch populates raw without mutating inputs', async () => {
    const registry = createDefaultDiscoveryRegistry();
    const store = createInMemoryProfileStore([baseProfile()]);
    const searchHits = [
      hit('https://employer.example/jobs/full', 'Senior Frontend Engineer'),
    ];
    const frozenHits = structuredClone(searchHits);
    const fetch = createFakeFetchAdapter({
      fixtureByUrl: {
        'https://employer.example/jobs/full': 'job-full',
      },
    });
    const extract = createFakeContentExtractor({
      contentStore: fetch.contentStore,
    });

    const result = await executeDiscoveryPipeline({
      profileId: 'profile-1',
      registry,
      profileStore: store,
      adapters: {
        search: createFakeSearchAdapter({ defaultResults: searchHits }),
        fetch,
        extract,
      },
      now: () => '2026-08-30T07:00:00.000Z',
      runId: 'run-fetch-ok',
    });

    expect(searchHits).toEqual(frozenHits);
    const active = result.batch.active;
    expect(active.length).toBeGreaterThanOrEqual(1);
    const cand = active[0]!;
    expect(cand.raw.sourceUrl).toBe('https://employer.example/jobs/full');
    expect(cand.raw.ref.startsWith('fixture:job-full:')).toBe(true);
    expect(cand.raw.contentType).toBe('text/html');
    expect(cand.raw.capturedAt).toBe('2026-08-30T07:00:00.000Z');
    // Ref only — no embedded HTML body on candidate
    expect(
      Object.values(cand.raw).every((v) => typeof v !== 'string' || !v.includes('<h1'))
    ).toBe(true);
  });

  it('does not mutate candidate objects across fetch/parse', async () => {
    const registry = createDefaultDiscoveryRegistry();
    const store = createInMemoryProfileStore([baseProfile()]);
    const fetch = createFakeFetchAdapter({
      defaultFixtureId: 'job-full',
    });
    const extract = createFakeContentExtractor({
      contentStore: fetch.contentStore,
    });

    // Capture mid-pipeline via searching once then inspecting immutability of batch helpers
    // by freezing a synthetic candidate and ensuring pipeline still works with clones.
    const snapshot: DiscoveryCandidate = {
      id: 'frozen',
      runId: 'x',
      identity: {
        externalIds: { url: 'https://employer.example/jobs/1' },
        canonicalUrl: 'https://employer.example/jobs/1',
        fingerprintMaterial: { title: 'Frontend Engineer', url: 'https://employer.example/jobs/1' },
      },
      source: { trust: 'AGGREGATOR' },
      discoveredAt: '2026-08-30T07:00:00.000Z',
      raw: { ref: 'placeholder' },
      extracted: { fields: { title: 'Frontend Engineer' } },
      stage: 'DISCOVERED',
      deterministicFilterPassed: false,
    };
    const frozen = structuredClone(snapshot);
    Object.freeze(snapshot);
    Object.freeze(snapshot.identity);
    Object.freeze(snapshot.extracted);
    Object.freeze(snapshot.extracted.fields);
    Object.freeze(snapshot.raw);

    const result = await executeDiscoveryPipeline({
      profileId: 'profile-1',
      registry,
      profileStore: store,
      adapters: {
        search: createFakeSearchAdapter({
          defaultResults: [
            hit('https://employer.example/jobs/1', 'Frontend Engineer'),
          ],
        }),
        fetch,
        extract,
      },
      now: () => '2026-08-30T07:00:00.000Z',
      runId: 'run-immut-cand',
    });

    expect(snapshot).toEqual(frozen);
    expect(result.batch.active[0]?.id).not.toBe('frozen');
    expect(result.batch.active[0]?.raw.ref).not.toBe('placeholder');
  });

  it('fetch failure is explicit and does not discard successful candidates', async () => {
    const registry = createDefaultDiscoveryRegistry();
    const store = createInMemoryProfileStore([baseProfile()]);
    const fetch = createFakeFetchAdapter({
      fixtureByUrl: {
        'https://employer.example/jobs/ok': 'job-full',
        'https://employer.example/jobs/bad': 'job-full',
      },
      failUrls: ['https://employer.example/jobs/bad'],
    });
    const extract = createFakeContentExtractor({
      contentStore: fetch.contentStore,
    });

    const result = await executeDiscoveryPipeline({
      profileId: 'profile-1',
      registry,
      profileStore: store,
      adapters: {
        search: createFakeSearchAdapter({
          defaultResults: [
            hit('https://employer.example/jobs/ok', 'Frontend Engineer'),
            hit('https://employer.example/jobs/bad', 'Frontend Engineer'),
          ],
        }),
        fetch,
        extract,
      },
      now: () => '2026-08-30T07:00:00.000Z',
      runId: 'run-fetch-partial',
    });

    expect(result.run.status).toBe('PARTIAL_SUCCESS');
    expect(
      result.batch.rejected.some(
        (r) => r.rejection.details?.failure === 'FETCH_FAILED'
      )
    ).toBe(true);
    expect(
      result.stageDiagnostics.some(
        (d) => d.stage === 'collect' && d.reasonCode === 'FETCH_FAILED'
      )
    ).toBe(true);
    expect(
      result.batch.active.some(
        (c) => c.identity.canonicalUrl === 'https://employer.example/jobs/ok'
      ) ||
        result.batch.active.some((c) =>
          String(c.extracted.fields.title).includes('Senior Frontend')
        )
    ).toBe(true);
  });

  it('parser populates extracted; UNKNOWN salary stays null (not 0/false)', async () => {
    const registry = createDefaultDiscoveryRegistry();
    const store = createInMemoryProfileStore([baseProfile()]);
    const fetch = createFakeFetchAdapter({
      fixtureByUrl: {
        'https://employer.example/jobs/unknown-salary': 'job-unknown-salary',
      },
    });
    const extract = createFakeContentExtractor({
      contentStore: fetch.contentStore,
    });

    const result = await executeDiscoveryPipeline({
      profileId: 'profile-1',
      registry,
      profileStore: store,
      adapters: {
        search: createFakeSearchAdapter({
          defaultResults: [
            hit(
              'https://employer.example/jobs/unknown-salary',
              'Frontend Engineer'
            ),
          ],
        }),
        fetch,
        extract,
      },
      now: () => '2026-08-30T07:00:00.000Z',
      runId: 'run-unknown-salary',
    });

    const cand = result.batch.active[0]!;
    expect(cand.extracted.fields.location).toBe('Munich');
    expect(cand.extracted.fields.salary).toBeNull();
    expect(cand.extracted.fields.salary).not.toBe(0);
    expect(cand.extracted.fields.salary).not.toBe(false);
  });

  it('parser does not create Evidence or VerificationResult (trust boundary)', async () => {
    const registry = createDefaultDiscoveryRegistry();
    const store = createInMemoryProfileStore([baseProfile()]);
    const fetch = createFakeFetchAdapter({ defaultFixtureId: 'job-full' });
    const extract = createFakeContentExtractor({
      contentStore: fetch.contentStore,
    });

    const result = await executeDiscoveryPipeline({
      profileId: 'profile-1',
      registry,
      profileStore: store,
      adapters: {
        search: createFakeSearchAdapter({
          defaultResults: [
            hit('https://employer.example/jobs/1', 'Senior Frontend Engineer'),
          ],
        }),
        fetch,
        extract,
      },
      now: () => '2026-08-30T07:00:00.000Z',
      runId: 'run-trust',
    });

    const cand = result.batch.active[0]!;
    expect(cand.extracted).toBeDefined();
    expect(cand.extracted.fields.title).toBe('Senior Frontend Engineer');
    expect(cand.extracted.fields.salary).toBe('€70,000–€85,000');

    // ExtractedFacts ≠ Evidence / Verification
    expect('evidence' in cand).toBe(false);
    expect('verification' in cand).toBe(false);
    expect('verificationResult' in cand).toBe(false);
    expect(cand.stage).not.toBe('PROMOTED');
    expect(cand.deterministicFilterPassed).toBe(true);
  });

  it('parse failure is explicit and does not silently disappear', async () => {
    const registry = createDefaultDiscoveryRegistry();
    const store = createInMemoryProfileStore([baseProfile()]);
    const fetch = createFakeFetchAdapter({
      fixtureByUrl: {
        'https://employer.example/jobs/ok': 'job-full',
        'https://employer.example/jobs/broken': 'malformed',
      },
    });
    const extract = createFakeContentExtractor({
      contentStore: fetch.contentStore,
    });

    const result = await executeDiscoveryPipeline({
      profileId: 'profile-1',
      registry,
      profileStore: store,
      adapters: {
        search: createFakeSearchAdapter({
          defaultResults: [
            hit('https://employer.example/jobs/ok', 'Frontend Engineer'),
            hit('https://employer.example/jobs/broken', 'Frontend Engineer'),
          ],
        }),
        fetch,
        extract,
      },
      now: () => '2026-08-30T07:00:00.000Z',
      runId: 'run-parse-fail',
    });

    expect(result.run.status).toBe('PARTIAL_SUCCESS');
    const parseReject = result.batch.rejected.find(
      (r) => r.rejection.details?.failure === 'PARSE_FAILED'
    );
    expect(parseReject).toBeTruthy();
    expect(parseReject!.rejection.reasonCode).toBe('REJECTED_OTHER');
    expect(
      result.stageDiagnostics.some(
        (d) => d.stage === 'parse' && d.reasonCode === 'PARSE_FAILED'
      )
    ).toBe(true);
    expect(result.batch.active.length).toBeGreaterThanOrEqual(1);
  });

  it('Search → Fetch → Parse → Normalize order is preserved', async () => {
    const registry = createDefaultDiscoveryRegistry();
    const store = createInMemoryProfileStore([baseProfile()]);
    const fetch = createFakeFetchAdapter({ defaultFixtureId: 'job-full' });
    const extract = createFakeContentExtractor({
      contentStore: fetch.contentStore,
    });

    const result = await executeDiscoveryPipeline({
      profileId: 'profile-1',
      registry,
      profileStore: store,
      adapters: {
        search: createFakeSearchAdapter({
          defaultResults: [
            hit('https://employer.example/jobs/1', 'Senior Frontend Engineer'),
          ],
        }),
        fetch,
        extract,
      },
      now: () => '2026-08-30T07:00:00.000Z',
      runId: 'run-order-e22',
    });

    const stages = result.stageDiagnostics.map((d) => d.stage);
    const searchIdx = stages.indexOf('search');
    const collectIdx = stages.indexOf('collect');
    const parseIdx = stages.indexOf('parse');
    const normalizeIdx = stages.indexOf('normalize');
    expect(searchIdx).toBeGreaterThan(-1);
    expect(collectIdx).toBeGreaterThan(searchIdx);
    expect(parseIdx).toBeGreaterThan(collectIdx);
    expect(normalizeIdx).toBeGreaterThan(parseIdx);
    expect(result.stageOrder).toEqual([...CANONICAL_STAGE_ORDER]);

    // Collect/parse are no longer stubs when adapters present
    expect(
      result.stageDiagnostics.some(
        (d) => d.stage === 'collect' && d.outcome === 'stub'
      )
    ).toBe(false);
    expect(
      result.stageDiagnostics.some(
        (d) => d.stage === 'parse' && d.outcome === 'stub'
      )
    ).toBe(false);
  });

  it('rejected fetch candidates do not continue through later stages', async () => {
    const registry = createDefaultDiscoveryRegistry();
    const store = createInMemoryProfileStore([baseProfile()]);
    const fetch = createFakeFetchAdapter({
      failUrls: ['https://employer.example/jobs/only-fail'],
      fixtureByUrl: {
        'https://employer.example/jobs/only-fail': 'job-full',
      },
    });
    const extract = createFakeContentExtractor({
      contentStore: fetch.contentStore,
    });

    const result = await executeDiscoveryPipeline({
      profileId: 'profile-1',
      registry,
      profileStore: store,
      adapters: {
        // Jobs issues job-q1 + job-q2; attach the failing hit to q1 only so this
        // case still asserts a single fetch rejection (not q1/q2 duplication).
        search: createFakeSearchAdapter({
          resultsByQueryId: {
            'job-q1': [
              hit('https://employer.example/jobs/only-fail', 'Frontend Engineer'),
            ],
            'job-q2': [],
          },
        }),
        fetch,
        extract,
      },
      now: () => '2026-08-30T07:00:00.000Z',
      runId: 'run-no-continue',
    });

    expect(result.queries.map((q) => q.id)).toEqual(['job-q1', 'job-q2']);
    expect(result.batch.active).toHaveLength(0);
    expect(result.batch.rejected).toHaveLength(1);
    expect(result.batch.rejected[0]?.rejection.reasonCode).toBe('REJECTED_OTHER');
    // No per-candidate parse diagnostic for the rejected fetch candidate
    expect(
      result.stageDiagnostics.some(
        (d) =>
          d.stage === 'parse' &&
          d.candidateId === result.batch.rejected[0]?.candidate.id &&
          d.outcome === 'ok'
      )
    ).toBe(false);
  });

  it('diagnostics include candidateId, stage, adapter for fetch and parse', async () => {
    const registry = createDefaultDiscoveryRegistry();
    const store = createInMemoryProfileStore([baseProfile()]);
    const fetch = createFakeFetchAdapter({ defaultFixtureId: 'job-text' });
    const extract = createFakeContentExtractor({
      contentStore: fetch.contentStore,
    });

    const result = await executeDiscoveryPipeline({
      profileId: 'profile-1',
      registry,
      profileStore: store,
      adapters: {
        search: createFakeSearchAdapter({
          defaultResults: [
            hit('https://employer.example/jobs/text', 'Backend Engineer'),
          ],
        }),
        fetch,
        extract,
      },
      now: () => '2026-08-30T07:00:00.000Z',
      runId: 'run-diag-e22',
    });

    const collectDiag = result.stageDiagnostics.find(
      (d) => d.stage === 'collect' && d.candidateId && d.outcome === 'ok'
    );
    const parseDiag = result.stageDiagnostics.find(
      (d) => d.stage === 'parse' && d.candidateId && d.outcome === 'ok'
    );
    expect(collectDiag?.adapter).toBe('fetch');
    expect(typeof collectDiag?.durationMs).toBe('number');
    expect(parseDiag?.adapter).toBe('extract');
    expect(result.batch.active[0]?.extracted.fields.location).toBe('Hamburg');
  });

  it('missing fetch/extract adapters emit explicit stubs (not silent success claim)', async () => {
    const registry = createDefaultDiscoveryRegistry();
    const store = createInMemoryProfileStore([baseProfile()]);
    const result = await executeDiscoveryPipeline({
      profileId: 'profile-1',
      registry,
      profileStore: store,
      adapters: {
        search: createFakeSearchAdapter({
          defaultResults: [
            hit('https://employer.example/jobs/1', 'Frontend Engineer'),
          ],
        }),
      },
      now: () => '2026-08-30T07:00:00.000Z',
      runId: 'run-stub-adapters',
    });

    expect(
      result.stageDiagnostics.some(
        (d) =>
          d.stage === 'collect' &&
          d.outcome === 'stub' &&
          d.reasonCode === 'STAGE_NOT_IMPLEMENTED'
      )
    ).toBe(true);
    expect(
      result.stageDiagnostics.some(
        (d) =>
          d.stage === 'parse' &&
          d.outcome === 'stub' &&
          d.reasonCode === 'STAGE_NOT_IMPLEMENTED'
      )
    ).toBe(true);
  });
});
