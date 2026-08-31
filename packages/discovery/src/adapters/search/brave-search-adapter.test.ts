import { describe, expect, it } from 'vitest';
import {
  AdapterFailureError,
  PartialSearchError,
  buildBraveQueryText,
  createInMemoryRateLimiter,
  createMockHttpTransport,
  createProductionSearchAdapter,
  createDefaultDiscoveryRegistry,
  createInMemoryProfileStore,
  emptyCriteria,
  executeDiscoveryPipeline,
  type DiscoveryProfile,
  type DiscoveryQuery,
  type DiscoveryRun,
} from '../../index.js';

function runStub(): DiscoveryRun {
  return {
    id: 'run-search-1',
    profileId: 'profile-job',
    strategyId: 'job-discovery',
    strategyVersion: '1',
    criteriaSnapshot: emptyCriteria(),
    startedAt: '2026-08-30T14:00:00.000Z',
    status: 'RUNNING',
    stats: {
      candidatesFound: 0,
      candidatesRejected: 0,
      candidatesVerified: 0,
      resultsCreated: 0,
      resultsUpdated: 0,
    },
  };
}

function query(overrides: Partial<DiscoveryQuery> = {}): DiscoveryQuery {
  return {
    id: 'q1',
    intent: 'web_search',
    text: 'Frontend Engineer job DE',
    locale: 'en',
    geography: { countryCode: 'DE' },
    ...overrides,
  };
}

function braveOkBody(results: unknown[]) {
  return JSON.stringify({ web: { results } });
}

describe('E3.2 Production SearchAdapter (Brave)', () => {
  it('translates query and maps valid results with source attribution', async () => {
    const transport = createMockHttpTransport(async () => ({
      status: 200,
      bodyText: braveOkBody([
        {
          title: 'Frontend Engineer',
          url: 'https://employer.example/jobs/1',
          description: 'Berlin role',
        },
      ]),
    }));

    const adapter = createProductionSearchAdapter({
      apiKey: 'test-key-not-a-secret-for-ci',
      transport,
      maxResults: 5,
    });

    const results = await adapter.search([query()], {
      run: runStub(),
      now: () => '2026-08-30T14:00:00.000Z',
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.discoveredUrl).toBe('https://employer.example/jobs/1');
    expect(results[0]?.title).toBe('Frontend Engineer');
    expect(results[0]?.source?.trust).toBe('AGGREGATOR');
    expect(results[0]?.source?.url).toBe('https://employer.example/jobs/1');
    expect(results[0]?.data?.provider).toBe('brave');
    expect(results[0]?.data?.queryId).toBe('q1');

    const req = transport.requests[0]!;
    expect(req.url).toContain('q=Frontend');
    expect(req.url).toContain('count=5');
    expect(req.url).toContain('country=DE');
    expect(req.headers?.['X-Subscription-Token']).toBe('test-key-not-a-secret-for-ci');
    expect(JSON.stringify(results)).not.toContain('test-key-not-a-secret-for-ci');
  });

  it('maps multiple results without claiming Arrival Atlas ranking', async () => {
    const transport = createMockHttpTransport(async () => ({
      status: 200,
      bodyText: braveOkBody([
        { title: 'A', url: 'https://a.example/1' },
        { title: 'B', url: 'https://b.example/2' },
      ]),
    }));
    const adapter = createProductionSearchAdapter({
      apiKey: 'k',
      transport,
    });
    const results = await adapter.search([query()], {
      run: runStub(),
      now: () => '2026-08-30T14:00:00.000Z',
    });
    expect(results.map((r) => r.discoveredUrl)).toEqual([
      'https://a.example/1',
      'https://b.example/2',
    ]);
    expect(results.every((r) => r.source?.trust === 'AGGREGATOR')).toBe(true);
  });

  it('skips missing URL / malformed entries; does not fabricate', async () => {
    const transport = createMockHttpTransport(async () => ({
      status: 200,
      bodyText: braveOkBody([
        { title: 'No URL' },
        { title: 'Bad', url: 'javascript:alert(1)' },
        { title: 'Good', url: 'https://ok.example/job' },
        null,
      ]),
    }));
    const adapter = createProductionSearchAdapter({ apiKey: 'k', transport });
    await expect(
      adapter.search([query()], {
        run: runStub(),
        now: () => '2026-08-30T14:00:00.000Z',
      })
    ).rejects.toBeInstanceOf(PartialSearchError);

    try {
      await adapter.search([query()], {
        run: runStub(),
        now: () => '2026-08-30T14:00:00.000Z',
      });
    } catch (err) {
      expect(err).toBeInstanceOf(PartialSearchError);
      const partial = err as InstanceType<typeof PartialSearchError>;
      expect(partial.results).toHaveLength(1);
      expect(partial.results[0]?.discoveredUrl).toBe('https://ok.example/job');
      expect(partial.failures.some((f) => f.includes('SKIP'))).toBe(true);
    }
  });

  it('AUTH_REQUIRED on missing key and 401', async () => {
    await expect(
      createProductionSearchAdapter({ apiKey: '', transport: createMockHttpTransport(async () => ({ status: 200, bodyText: '{}' })) }).search(
        [query()],
        { run: runStub(), now: () => 't' }
      )
    ).rejects.toMatchObject({ failure: { code: 'AUTH_REQUIRED' } });

    const transport = createMockHttpTransport(async () => ({
      status: 401,
      bodyText: 'unauthorized',
    }));
    await expect(
      createProductionSearchAdapter({ apiKey: 'k', transport }).search([query()], {
        run: runStub(),
        now: () => 't',
      })
    ).rejects.toSatisfy((e: unknown) =>
      AdapterFailureError.isAdapterFailure(e) && e.failure.code === 'AUTH_REQUIRED'
    );
  });

  it('maps 429 → RATE_LIMITED, 5xx → UNAVAILABLE, network → NETWORK_ERROR', async () => {
    await expect(
      createProductionSearchAdapter({
        apiKey: 'k',
        transport: createMockHttpTransport(async () => ({ status: 429, bodyText: '' })),
      }).search([query()], { run: runStub(), now: () => 't' })
    ).rejects.toMatchObject({ failure: { code: 'RATE_LIMITED' } });

    await expect(
      createProductionSearchAdapter({
        apiKey: 'k',
        transport: createMockHttpTransport(async () => ({ status: 503, bodyText: '' })),
      }).search([query()], { run: runStub(), now: () => 't' })
    ).rejects.toMatchObject({ failure: { code: 'UNAVAILABLE' } });

    await expect(
      createProductionSearchAdapter({
        apiKey: 'k',
        transport: createMockHttpTransport(async () => {
          throw new Error('ECONNRESET');
        }),
      }).search([query()], { run: runStub(), now: () => 't' })
    ).rejects.toMatchObject({ failure: { code: 'NETWORK_ERROR' } });
  });

  it('TIMEOUT and CANCELLED', async () => {
    await expect(
      createProductionSearchAdapter({
        apiKey: 'k',
        timeoutMs: 20,
        transport: createMockHttpTransport(
          () =>
            new Promise((resolve) => {
              setTimeout(
                () => resolve({ status: 200, bodyText: braveOkBody([]) }),
                200
              );
            })
        ),
      }).search([query()], { run: runStub(), now: () => 't' })
    ).rejects.toSatisfy((e: unknown) => AdapterFailureError.isTimeout(e));

    const controller = new AbortController();
    controller.abort();
    await expect(
      createProductionSearchAdapter({
        apiKey: 'k',
        transport: createMockHttpTransport(async () => ({
          status: 200,
          bodyText: braveOkBody([]),
        })),
      }).search([query()], {
        run: runStub(),
        now: () => 't',
        signal: controller.signal,
      })
    ).rejects.toSatisfy((e: unknown) => AdapterFailureError.isCancelled(e));
  });

  it('INVALID_RESPONSE for malformed JSON / shape', async () => {
    await expect(
      createProductionSearchAdapter({
        apiKey: 'k',
        transport: createMockHttpTransport(async () => ({
          status: 200,
          bodyText: 'not-json',
        })),
      }).search([query()], { run: runStub(), now: () => 't' })
    ).rejects.toMatchObject({ failure: { code: 'INVALID_RESPONSE' } });

    await expect(
      createProductionSearchAdapter({
        apiKey: 'k',
        transport: createMockHttpTransport(async () => ({
          status: 200,
          bodyText: JSON.stringify({ web: { results: 'nope' } }),
        })),
      }).search([query()], { run: runStub(), now: () => 't' })
    ).rejects.toMatchObject({ failure: { code: 'INVALID_RESPONSE' } });
  });

  it('valid zero results ≠ provider failure', async () => {
    const results = await createProductionSearchAdapter({
      apiKey: 'k',
      transport: createMockHttpTransport(async () => ({
        status: 200,
        bodyText: braveOkBody([]),
      })),
    }).search([query()], { run: runStub(), now: () => 't' });
    expect(results).toEqual([]);
  });

  it('partial query failure preserves successful query results', async () => {
    let calls = 0;
    const transport = createMockHttpTransport(async (req) => {
      calls += 1;
      if (req.url.includes('q=good')) {
        return {
          status: 200,
          bodyText: braveOkBody([
            { title: 'Good', url: 'https://good.example/1' },
          ]),
        };
      }
      return { status: 503, bodyText: 'down' };
    });

    const adapter = createProductionSearchAdapter({ apiKey: 'k', transport });
    await expect(
      adapter.search(
        [
          query({ id: 'qa', text: 'good' }),
          query({ id: 'qb', text: 'bad' }),
        ],
        { run: runStub(), now: () => 't' }
      )
    ).rejects.toBeInstanceOf(PartialSearchError);

    try {
      await adapter.search(
        [
          query({ id: 'qa', text: 'good' }),
          query({ id: 'qb', text: 'bad' }),
        ],
        { run: runStub(), now: () => 't' }
      );
    } catch (err) {
      const partial = err as InstanceType<typeof PartialSearchError>;
      expect(partial.results).toHaveLength(1);
      expect(partial.results[0]?.discoveredUrl).toBe('https://good.example/1');
      expect(partial.failures.some((f) => f.includes('qb') && f.includes('UNAVAILABLE'))).toBe(
        true
      );
    }
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  it('uses rate limiter key search:brave', async () => {
    const limiter = createInMemoryRateLimiter();
    await createProductionSearchAdapter({
      apiKey: 'k',
      rateLimiter: limiter,
      transport: createMockHttpTransport(async () => ({
        status: 200,
        bodyText: braveOkBody([]),
      })),
    }).search([query()], { run: runStub(), now: () => 't' });
    expect(limiter.acquireCount('search:brave')).toBe(1);
  });

  it('buildBraveQueryText adds site: for site_search without domain pollution', () => {
    expect(
      buildBraveQueryText(
        query({
          intent: 'site_search',
          text: 'engineer',
          constraints: { site: 'careers.example.com' },
        })
      )
    ).toBe('engineer site:careers.example.com');
  });

  it('credentials never appear in failure messages returned to callers', async () => {
    const secret = 'super-secret-api-key-value-xyz';
    try {
      await createProductionSearchAdapter({
        apiKey: secret,
        transport: createMockHttpTransport(async () => ({
          status: 401,
          bodyText: `denied for ${secret}`,
        })),
      }).search([query()], { run: runStub(), now: () => 't' });
      expect.fail('expected throw');
    } catch (err) {
      expect(AdapterFailureError.isAdapterFailure(err)).toBe(true);
      expect(String(err)).not.toContain(secret);
      if (AdapterFailureError.isAdapterFailure(err)) {
        expect(err.message).not.toContain(secret);
      }
    }
  });
});

describe('E3.2 pipeline integration with production SearchAdapter', () => {
  function jobProfile(): DiscoveryProfile {
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
      },
      schedule: { cadence: 'manual' },
      notification: { emailEnabled: true, skipEmptyDigest: true },
      enabled: true,
      createdAt: '2026-08-30T00:00:00.000Z',
      updatedAt: '2026-08-30T00:00:00.000Z',
    };
  }

  it('plugs into BuildQueries → Search → Normalize/Dedupe/Filter without changing semantics', async () => {
    const transport = createMockHttpTransport(async () => ({
      status: 200,
      bodyText: braveOkBody([
        {
          title: 'Frontend Engineer',
          url: 'https://employer.example/jobs/fe-1',
          description: 'React role',
        },
        {
          title: 'Team Lead',
          url: 'https://employer.example/jobs/tl-1',
          description: 'excluded later',
        },
      ]),
    }));

    const result = await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      adapters: {
        search: createProductionSearchAdapter({
          apiKey: 'integration-key',
          transport,
        }),
      },
      now: () => '2026-08-30T14:00:00.000Z',
      runId: 'run-e32-integration',
    });

    expect(transport.requests.length).toBeGreaterThanOrEqual(1);
    expect(result.batch.active.length + result.batch.rejected.length).toBeGreaterThan(0);
    // Excluded role rejected by strategy filter (existing semantics)
    const rejectedLead = result.batch.rejected.some((r) =>
      String(r.candidate.extracted.fields.title ?? '')
        .toLowerCase()
        .includes('team lead')
    );
    const activeFe = result.batch.active.some((c) =>
      String(c.extracted.fields.title ?? '')
        .toLowerCase()
        .includes('frontend')
    );
    expect(rejectedLead || activeFe).toBe(true);
    // Search hits remain AGGREGATOR — not auto-promoted to OFFICIAL
    const anyOfficialFromSearch = [...result.batch.active, ...result.batch.rejected.map((r) => r.candidate)].some(
      (c) => c.source.trust === 'OFFICIAL' && c.source.label === 'brave-search'
    );
    expect(anyOfficialFromSearch).toBe(false);
    expect(JSON.stringify(result.stageDiagnostics)).not.toContain('integration-key');
  });
});
