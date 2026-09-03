import { describe, expect, it, vi } from 'vitest';
import {
  AdapterFailureError,
  buildTavilySearchRequestBody,
  createInMemoryRateLimiter,
  createMockHttpTransport,
  createProductionDiscoveryAdapters,
  createTavilySearchAdapter,
  emptyCriteria,
  loadDiscoveryProductionConfig,
  PartialSearchError,
  resolveDiscoverySearchProvider,
  TAVILY_SEARCH_PROVIDER_ID,
  type DiscoveryQuery,
  type DiscoveryRun,
  type HttpRequest,
} from '../../index.js';

function runStub(): DiscoveryRun {
  return {
    id: 'run-tavily-1',
    profileId: 'profile-job',
    strategyId: 'job-discovery',
    strategyVersion: '1',
    criteriaSnapshot: emptyCriteria(),
    startedAt: '2026-09-02T12:00:00.000Z',
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
    text: 'Frontend Engineer job DE Bremen',
    locale: 'en',
    geography: { countryCode: 'DE' },
    ...overrides,
  };
}

function tavilyOkBody(results: unknown[]) {
  return JSON.stringify({ results });
}

describe('E12.3a Tavily SearchAdapter', () => {
  it('constructs POST request with Bearer auth and maps results', async () => {
    const seen: HttpRequest[] = [];
    const transport = createMockHttpTransport(async (req) => {
      seen.push(req);
      return {
        status: 200,
        bodyText: tavilyOkBody([
          {
            title: 'Frontend Engineer',
            url: 'https://employer.example/jobs/1',
            content: 'Berlin / Bremen role',
          },
        ]),
      };
    });

    const adapter = createTavilySearchAdapter({
      apiKey: 'tvly-test-key-not-for-production',
      transport,
      maxResults: 5,
    });

    const results = await adapter.search([query()], {
      run: runStub(),
      now: () => '2026-09-02T12:00:00.000Z',
    });

    expect(seen).toHaveLength(1);
    expect(seen[0]?.method).toBe('POST');
    expect(seen[0]?.url).toBe('https://api.tavily.com/search');
    expect(seen[0]?.headers?.Authorization).toBe(
      'Bearer tvly-test-key-not-for-production'
    );
    expect(seen[0]?.headers?.['Content-Type']).toBe('application/json');
    const body = JSON.parse(seen[0]!.body!);
    expect(body.query).toBe('Frontend Engineer job DE Bremen');
    expect(body.max_results).toBe(5);
    expect(body.include_answer).toBe(false);
    expect(body.include_raw_content).toBe(false);
    expect(body.include_images).toBe(false);
    // E12.20 — Jobs + DE geography
    expect(body.country).toBe('germany');
    expect(body.search_depth).toBe('advanced');

    expect(results).toHaveLength(1);
    expect(results[0]?.discoveredUrl).toBe('https://employer.example/jobs/1');
    expect(results[0]?.title).toBe('Frontend Engineer');
    expect(results[0]?.snippet).toBe('Berlin / Bremen role');
    expect(results[0]?.source?.trust).toBe('AGGREGATOR');
    expect(results[0]?.source?.label).toBe('tavily-search');
    expect(results[0]?.data?.provider).toBe(TAVILY_SEARCH_PROVIDER_ID);
  });

  it('returns empty array for empty results', async () => {
    const adapter = createTavilySearchAdapter({
      apiKey: 'tvly-test-key',
      transport: createMockHttpTransport(async () => ({
        status: 200,
        bodyText: tavilyOkBody([]),
      })),
    });
    const results = await adapter.search([query()], {
      run: runStub(),
      now: () => '2026-09-02T12:00:00.000Z',
    });
    expect(results).toEqual([]);
  });

  it('fails closed on HTTP auth errors', async () => {
    const adapter = createTavilySearchAdapter({
      apiKey: 'tvly-test-key',
      transport: createMockHttpTransport(async () => ({
        status: 401,
        bodyText: '{"error":"unauthorized"}',
      })),
    });
    await expect(
      adapter.search([query()], {
        run: runStub(),
        now: () => '2026-09-02T12:00:00.000Z',
      })
    ).rejects.toSatisfy((err: unknown) => {
      expect(AdapterFailureError.isAdapterFailure(err)).toBe(true);
      if (AdapterFailureError.isAdapterFailure(err)) {
        expect(err.failure.code).toBe('AUTH_REQUIRED');
        expect(err.failure.operation).toBe('tavily_web_search');
      }
      return true;
    });
  });

  it('fails closed on malformed response', async () => {
    const adapter = createTavilySearchAdapter({
      apiKey: 'tvly-test-key',
      transport: createMockHttpTransport(async () => ({
        status: 200,
        bodyText: 'not-json',
      })),
    });
    await expect(
      adapter.search([query()], {
        run: runStub(),
        now: () => '2026-09-02T12:00:00.000Z',
      })
    ).rejects.toSatisfy((err: unknown) => {
      expect(AdapterFailureError.isAdapterFailure(err)).toBe(true);
      if (AdapterFailureError.isAdapterFailure(err)) {
        expect(err.failure.code).toBe('INVALID_RESPONSE');
      }
      return true;
    });
  });

  it('fails clearly when API key is missing', async () => {
    const adapter = createTavilySearchAdapter({
      apiKey: '   ',
      transport: createMockHttpTransport(async () => {
        throw new Error('should not call transport');
      }),
    });
    await expect(
      adapter.search([query()], {
        run: runStub(),
        now: () => '2026-09-02T12:00:00.000Z',
      })
    ).rejects.toSatisfy((err: unknown) => {
      expect(AdapterFailureError.isAdapterFailure(err)).toBe(true);
      if (AdapterFailureError.isAdapterFailure(err)) {
        expect(err.failure.code).toBe('AUTH_REQUIRED');
      }
      return true;
    });
  });

  it('skips invalid entries without inventing URLs', async () => {
    const adapter = createTavilySearchAdapter({
      apiKey: 'tvly-test-key',
      transport: createMockHttpTransport(async () => ({
        status: 200,
        bodyText: tavilyOkBody([
          { title: 'bad', url: 'javascript:alert(1)', content: 'x' },
          { title: 'missing', url: '', content: 'y' },
          {
            title: 'ok',
            url: 'https://employer.example/jobs/2',
            content: 'ok',
          },
        ]),
      })),
    });
    try {
      await adapter.search([query()], {
        run: runStub(),
        now: () => '2026-09-02T12:00:00.000Z',
      });
      throw new Error('expected PartialSearchError');
    } catch (err) {
      expect(err).toBeInstanceOf(PartialSearchError);
      const partial = err as InstanceType<typeof PartialSearchError>;
      expect(partial.results).toHaveLength(1);
      expect(partial.results[0]?.discoveredUrl).toBe(
        'https://employer.example/jobs/2'
      );
      expect(partial.failures.some((f) => f.includes('SKIP'))).toBe(true);
    }
  });
});

describe('E12.20 Tavily Germany Jobs retrieval tuning', () => {
  it('Jobs + DE sends country=germany and search_depth=advanced with unchanged base fields', async () => {
    const seen: HttpRequest[] = [];
    const adapter = createTavilySearchAdapter({
      apiKey: 'tvly-test-key',
      transport: createMockHttpTransport(async (req) => {
        seen.push(req);
        return { status: 200, bodyText: tavilyOkBody([]) };
      }),
      maxResults: 10,
    });

    const q = query({
      text: 'Senior Frontend Engineer hiring vacancy Stellenangebot DE -template -"job description" -resources',
      geography: { countryCode: 'DE' },
    });

    await adapter.search([q], {
      run: runStub(),
      now: () => '2026-09-02T12:00:00.000Z',
    });

    const body = JSON.parse(seen[0]!.body!);
    expect(body).toEqual({
      query: q.text,
      max_results: 10,
      include_answer: false,
      include_raw_content: false,
      include_images: false,
      country: 'germany',
      search_depth: 'advanced',
    });
  });

  it('passes query text through unchanged for Jobs DE', () => {
    const text =
      'Senior Frontend Engineer Stellenanzeige Bewerbung vacancy Germany -template -"job description" -site:linkedin.com';
    const body = buildTavilySearchRequestBody({
      query: query({ text, geography: { countryCode: 'DE' } }),
      strategyId: 'job-discovery',
      maxResults: 10,
    });
    expect(body.query).toBe(text);
    expect(body.country).toBe('germany');
    expect(body.search_depth).toBe('advanced');
  });

  it('does not add Germany tuning for giveaway-discovery (shared adapter)', () => {
    const body = buildTavilySearchRequestBody({
      query: query({
        text: 'giveaway free DE',
        geography: { countryCode: 'DE' },
        metadata: { strategy: 'giveaway-discovery', version: '1' },
      }),
      strategyId: 'giveaway-discovery',
      maxResults: 10,
    });
    expect(body).toEqual({
      query: 'giveaway free DE',
      max_results: 10,
      include_answer: false,
      include_raw_content: false,
      include_images: false,
    });
    expect(body).not.toHaveProperty('country');
    expect(body).not.toHaveProperty('search_depth');
  });

  it('does not add Germany tuning for Jobs with non-DE geography', () => {
    const body = buildTavilySearchRequestBody({
      query: query({
        text: 'Frontend Engineer vacancy NL',
        geography: { countryCode: 'NL' },
      }),
      strategyId: 'job-discovery',
      maxResults: 8,
    });
    expect(body.max_results).toBe(8);
    expect(body).not.toHaveProperty('country');
    expect(body).not.toHaveProperty('search_depth');
  });

  it('giveaway run via adapter omits country and search_depth on the wire', async () => {
    const seen: HttpRequest[] = [];
    const adapter = createTavilySearchAdapter({
      apiKey: 'tvly-test-key',
      transport: createMockHttpTransport(async (req) => {
        seen.push(req);
        return { status: 200, bodyText: tavilyOkBody([]) };
      }),
    });

    await adapter.search(
      [
        query({
          text: 'giveaway free gadgets DE',
          geography: { countryCode: 'DE' },
        }),
      ],
      {
        run: { ...runStub(), strategyId: 'giveaway-discovery', profileId: 'profile-gw' },
        now: () => '2026-09-02T12:00:00.000Z',
      }
    );

    const body = JSON.parse(seen[0]!.body!);
    expect(body.query).toBe('giveaway free gadgets DE');
    expect(body.country).toBeUndefined();
    expect(body.search_depth).toBeUndefined();
    expect(body.include_answer).toBe(false);
    expect(body.include_raw_content).toBe(false);
    expect(body.include_images).toBe(false);
  });
});

describe('E12.3a search provider selection', () => {
  it('resolves default / brave / tavily explicitly', () => {
    expect(resolveDiscoverySearchProvider(undefined)).toBe('brave');
    expect(resolveDiscoverySearchProvider('')).toBe('brave');
    expect(resolveDiscoverySearchProvider('brave')).toBe('brave');
    expect(resolveDiscoverySearchProvider('TAVILY')).toBe('tavily');
    expect(() => resolveDiscoverySearchProvider('serpapi')).toThrow(
      /Invalid DISCOVERY_SEARCH_PROVIDER/
    );
  });

  it('loadDiscoveryProductionConfig defaults to Brave and requires Brave key', () => {
    expect(() =>
      loadDiscoveryProductionConfig({
        OPENAI_API_KEY: 'sk-test',
      })
    ).toThrow(/BRAVE_SEARCH_API_KEY/);

    const loaded = loadDiscoveryProductionConfig({
      BRAVE_SEARCH_API_KEY: 'brave-key',
      OPENAI_API_KEY: 'sk-test',
    });
    expect(loaded.searchProvider).toBe('brave');
    expect(loaded.brave.apiKey).toBe('brave-key');
  });

  it('loadDiscoveryProductionConfig selects Tavily and requires TAVILY_API_KEY', () => {
    expect(() =>
      loadDiscoveryProductionConfig({
        DISCOVERY_SEARCH_PROVIDER: 'tavily',
        OPENAI_API_KEY: 'sk-test',
      })
    ).toThrow(/TAVILY_API_KEY/);

    const loaded = loadDiscoveryProductionConfig({
      DISCOVERY_SEARCH_PROVIDER: 'tavily',
      TAVILY_API_KEY: 'tvly-key',
      OPENAI_API_KEY: 'sk-test',
    });
    expect(loaded.searchProvider).toBe('tavily');
    expect(loaded.tavily?.apiKey).toBe('tvly-key');
  });

  it('composition uses Tavily adapter when selected — no Brave call', async () => {
    const requests: HttpRequest[] = [];
    const transport = createMockHttpTransport(async (req) => {
      requests.push(req);
      if (req.url.includes('api.search.brave.com')) {
        throw new Error('Brave must not be called when Tavily is selected');
      }
      if (req.url.includes('api.tavily.com')) {
        return {
          status: 200,
          bodyText: tavilyOkBody([
            {
              title: 'Role',
              url: 'https://employer.example/jobs/t',
              content: 'snippet',
            },
          ]),
        };
      }
      throw new Error(`UNEXPECTED ${req.url}`);
    });

    const adapters = createProductionDiscoveryAdapters({
      searchProvider: 'tavily',
      brave: { apiKey: 'unused-brave' },
      tavily: { apiKey: 'tvly-composition-key' },
      openai: { apiKey: 'sk-test', model: 'gpt-4o-mini' },
      transport,
      rateLimiter: createInMemoryRateLimiter(),
    });

    const results = await adapters.search.search([query()], {
      run: runStub(),
      now: () => '2026-09-02T12:00:00.000Z',
    });

    expect(results).toHaveLength(1);
    expect(requests.every((r) => r.url.includes('api.tavily.com'))).toBe(true);
    expect(requests.some((r) => r.url.includes('brave'))).toBe(false);
  });

  it('Tavily search failure does not fall back to Brave', async () => {
    const braveSpy = vi.fn();
    const transport = createMockHttpTransport(async (req) => {
      if (req.url.includes('brave')) {
        braveSpy();
        return {
          status: 200,
          bodyText: JSON.stringify({
            web: {
              results: [
                {
                  title: 'should-not-use',
                  url: 'https://employer.example/brave',
                  description: 'x',
                },
              ],
            },
          }),
        };
      }
      return { status: 503, bodyText: 'unavailable' };
    });

    const adapters = createProductionDiscoveryAdapters({
      searchProvider: 'tavily',
      brave: { apiKey: 'brave-key' },
      tavily: { apiKey: 'tvly-key' },
      openai: { apiKey: 'sk-test' },
      transport,
      rateLimiter: createInMemoryRateLimiter(),
    });

    await expect(
      adapters.search.search([query()], {
        run: runStub(),
        now: () => '2026-09-02T12:00:00.000Z',
      })
    ).rejects.toSatisfy((err: unknown) => {
      expect(AdapterFailureError.isAdapterFailure(err)).toBe(true);
      if (AdapterFailureError.isAdapterFailure(err)) {
        expect(err.failure.code).toBe('UNAVAILABLE');
        expect(err.failure.operation).toBe('tavily_web_search');
      }
      return true;
    });
    expect(braveSpy).not.toHaveBeenCalled();
  });

  it('default composition still uses Brave', async () => {
    const transport = createMockHttpTransport(async (req) => {
      expect(req.url).toContain('api.search.brave.com');
      expect(req.method ?? 'GET').toBe('GET');
      return {
        status: 200,
        bodyText: JSON.stringify({
          web: {
            results: [
              {
                title: 'Brave Hit',
                url: 'https://employer.example/jobs/brave',
                description: 'ok',
              },
            ],
          },
        }),
      };
    });

    const adapters = createProductionDiscoveryAdapters({
      brave: { apiKey: 'brave-key' },
      openai: { apiKey: 'sk-test' },
      transport,
      rateLimiter: createInMemoryRateLimiter(),
    });

    const results = await adapters.search.search([query()], {
      run: runStub(),
      now: () => '2026-09-02T12:00:00.000Z',
    });
    expect(results[0]?.source?.label).toBe('brave-search');
  });
});
