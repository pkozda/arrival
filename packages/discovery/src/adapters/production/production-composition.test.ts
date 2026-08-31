import { describe, expect, it } from 'vitest';
import {
  createDefaultDiscoveryRegistry,
  createInMemoryProfileStore,
  createInMemoryRateLimiter,
  createInMemoryRawContentStore,
  createMockHttpTransport,
  createProductionDiscoveryAdapters,
  emptyCriteria,
  executeDiscoveryPipeline,
  loadDiscoveryProductionConfig,
  redactDiscoveryProductionConfig,
  validateDiscoveryProductionConfig,
  type DiscoveryProductionConfig,
  type DiscoveryProfile,
  type DiscoveryQuery,
  type DiscoveryRun,
  type Evidence,
  type VerificationResult,
} from '../../index.js';

function runStub(): DiscoveryRun {
  return {
    id: 'run-e37',
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

function baseConfig(
  overrides: Partial<DiscoveryProductionConfig> = {}
): DiscoveryProductionConfig {
  const { brave, openai, ...rest } = overrides;
  return {
    ...rest,
    brave: {
      apiKey: 'brave-secret-key-abc',
      ...brave,
    },
    openai: {
      apiKey: 'sk-openai-secret-xyz',
      model: 'gpt-4o-mini',
      ...openai,
    },
  };
}

function openAiEnvelope(tasks: unknown) {
  return JSON.stringify({
    choices: [
      {
        message: {
          role: 'assistant',
          content: JSON.stringify({ tasks }),
        },
      },
    ],
  });
}

describe('E3.7 production composition', () => {
  it('creates all five production adapters without network I/O', () => {
    let transportCalls = 0;
    const transport = createMockHttpTransport(async () => {
      transportCalls += 1;
      throw new Error('network must not run during construction');
    });

    const adapters = createProductionDiscoveryAdapters(
      baseConfig({ transport, rateLimiter: createInMemoryRateLimiter() })
    );

    expect(typeof adapters.search.search).toBe('function');
    expect(typeof adapters.fetch.fetch).toBe('function');
    expect(typeof adapters.extract.extract).toBe('function');
    expect(typeof adapters.verify.verify).toBe('function');
    expect(typeof adapters.ai.evaluate).toBe('function');
    expect(adapters.rawContentStore).toBeDefined();
    expect(adapters.rateLimiter).toBeDefined();
    expect(adapters.transport).toBe(transport);
    expect(transportCalls).toBe(0);
  });

  it('propagates Brave and OpenAI configuration to adapters', async () => {
    const transport = createMockHttpTransport(async (req) => {
      if (req.url.includes('brave.example')) {
        return {
          status: 200,
          bodyText: JSON.stringify({
            web: {
              results: [
                {
                  title: 'Engineer',
                  url: 'https://employer.example/jobs/1',
                  description: 'x',
                },
              ],
            },
          }),
        };
      }
      return {
        status: 200,
        bodyText: openAiEnvelope([
          {
            task: 'RELEVANCE',
            outcome: 'INTERPRETED',
            interpretationConfidence: 0.5,
          },
        ]),
      };
    });

    const adapters = createProductionDiscoveryAdapters(
      baseConfig({
        transport,
        brave: {
          apiKey: 'brave-secret-key-abc',
          baseUrl: 'https://brave.example/search',
          maxResults: 3,
        },
        openai: {
          apiKey: 'sk-openai-secret-xyz',
          model: 'gpt-test-model',
          baseUrl: 'https://openai.example/v1/chat/completions',
        },
      })
    );

    await adapters.search.search(
      [
        {
          id: 'q1',
          intent: 'web_search',
          text: 'Frontend Engineer DE',
          locale: 'en',
          geography: { countryCode: 'DE' },
        } satisfies DiscoveryQuery,
      ],
      { run: runStub(), now: () => '2026-08-30T14:00:00.000Z' }
    );

    const braveReq = transport.requests.find((r) =>
      r.url.includes('brave.example')
    );
    expect(braveReq?.headers?.['X-Subscription-Token']).toBe(
      'brave-secret-key-abc'
    );
    expect(braveReq?.url).toContain('brave.example');

    const verification: VerificationResult = {
      status: 'PASS',
      sourceTrust: 'OFFICIAL',
      freshness: 'CURRENT',
      checks: [
        { id: 'official_source', outcome: 'TRUE', required: true, evidenceIds: ['ev-1'] },
      ],
      verifiedAt: '2026-08-30T14:00:00.000Z',
      evidenceIds: ['ev-1'],
    };
    const evidence: Evidence[] = [
      {
        id: 'ev-1',
        type: 'OFFICIAL_SOURCE',
        sourceUrl: 'https://employer.example/jobs/1',
        statement: 'ok',
        capturedAt: '2026-08-30T14:00:00.000Z',
      },
    ];

    await adapters.ai.evaluate({
      candidateId: 'c1',
      identity: {
        externalIds: {},
        canonicalUrl: 'https://employer.example/jobs/1',
        fingerprintMaterial: { title: 'Engineer' },
      },
      extracted: { fields: { title: 'Engineer' } },
      verification,
      evidence,
      criteria: emptyCriteria(),
      allowedTasks: ['RELEVANCE'],
      rejectOn: [],
      run: runStub(),
      now: () => '2026-08-30T14:00:00.000Z',
    });

    const aiReq = transport.requests.find((r) =>
      r.url.includes('openai.example')
    );
    expect(aiReq?.headers?.Authorization).toBe('Bearer sk-openai-secret-xyz');
    expect(aiReq?.body).toContain('gpt-test-model');
  });

  it('propagates optional fetch maxBytes via shared store path', async () => {
    const store = createInMemoryRawContentStore();
    const transport = createMockHttpTransport(async () => ({
      status: 200,
      bodyText: 'x'.repeat(50),
      headers: { 'content-type': 'text/html' },
      finalUrl: 'https://employer.example/page',
    }));

    const adapters = createProductionDiscoveryAdapters(
      baseConfig({
        transport,
        rawContentStore: store,
        fetch: { maxResponseBytes: 20 },
      })
    );

    const result = await adapters.fetch.fetch(
      {
        url: 'https://employer.example/page',
        candidateId: 'c1',
      },
      { run: runStub(), now: () => '2026-08-30T14:00:00.000Z' }
    );

    expect(result.ok).toBe(false);
  });

  it('rejects missing credentials and invalid config', () => {
    expect(
      validateDiscoveryProductionConfig({
        brave: { apiKey: '' },
        openai: { apiKey: 'k' },
      }).ok
    ).toBe(false);

    expect(
      validateDiscoveryProductionConfig({
        brave: { apiKey: 'k', baseUrl: 'not-a-url' },
        openai: { apiKey: 'k' },
      }).ok
    ).toBe(false);

    expect(
      validateDiscoveryProductionConfig({
        brave: { apiKey: 'k' },
        openai: { apiKey: 'k', model: '   ' },
      }).ok
    ).toBe(false);

    expect(
      validateDiscoveryProductionConfig({
        brave: { apiKey: 'k', timeoutMs: -1 },
        openai: { apiKey: 'k' },
      }).ok
    ).toBe(false);

    expect(() =>
      createProductionDiscoveryAdapters({
        brave: { apiKey: '' },
        openai: { apiKey: 'k' },
      })
    ).toThrow(/brave\.apiKey/);
  });

  it('loadDiscoveryProductionConfig maps env vars and fails when missing', () => {
    const loaded = loadDiscoveryProductionConfig({
      BRAVE_SEARCH_API_KEY: 'brave-from-env',
      OPENAI_API_KEY: 'sk-from-env',
      OPENAI_MODEL: 'gpt-env-model',
      BRAVE_SEARCH_BASE_URL: 'https://brave.env/search',
      OPENAI_BASE_URL: 'https://openai.env/v1/chat/completions',
    });

    expect(loaded.brave.apiKey).toBe('brave-from-env');
    expect(loaded.openai.apiKey).toBe('sk-from-env');
    expect(loaded.openai.model).toBe('gpt-env-model');
    expect(loaded.brave.baseUrl).toBe('https://brave.env/search');
    expect(loaded.openai.baseUrl).toBe('https://openai.env/v1/chat/completions');

    expect(() =>
      loadDiscoveryProductionConfig({ OPENAI_API_KEY: 'k' })
    ).toThrow(/BRAVE_SEARCH_API_KEY/);
    expect(() =>
      loadDiscoveryProductionConfig({ BRAVE_SEARCH_API_KEY: 'k' })
    ).toThrow(/OPENAI_API_KEY/);
  });

  it('redacts secrets from diagnostics view', () => {
    const config = baseConfig();
    const redacted = redactDiscoveryProductionConfig(config);
    expect(JSON.stringify(redacted)).not.toContain('brave-secret-key-abc');
    expect(JSON.stringify(redacted)).not.toContain('sk-openai-secret-xyz');
    expect(redacted.brave.apiKey).toBe('[redacted]');
    expect(redacted.openai.apiKey).toBe('[redacted]');
    expect(redacted.openai.model).toBe('gpt-4o-mini');
  });

  it('keeps provider-specific rate-limit keys on a shared limiter', async () => {
    const limiter = createInMemoryRateLimiter();
    const transport = createMockHttpTransport(async (req) => {
      if (req.method === 'GET' && req.url.includes('search')) {
        return {
          status: 200,
          bodyText: JSON.stringify({
            web: {
              results: [
                {
                  title: 'A',
                  url: 'https://employer.example/jobs/1',
                },
              ],
            },
          }),
        };
      }
      if (req.method === 'POST') {
        return {
          status: 200,
          bodyText: openAiEnvelope([
            {
              task: 'RELEVANCE',
              outcome: 'INTERPRETED',
              interpretationConfidence: 0.5,
            },
          ]),
        };
      }
      return {
        status: 200,
        bodyText: '<html><body><h1>A</h1></body></html>',
        headers: { 'content-type': 'text/html' },
        finalUrl: 'https://employer.example/jobs/1',
      };
    });

    const adapters = createProductionDiscoveryAdapters(
      baseConfig({
        transport,
        rateLimiter: limiter,
        brave: {
          apiKey: 'brave-secret-key-abc',
          baseUrl: 'https://api.search.brave.com/res/v1/web/search',
        },
      })
    );

    await adapters.search.search(
      [
        {
          id: 'q1',
          intent: 'web_search',
          text: 'job',
          locale: 'en',
        },
      ],
      { run: runStub(), now: () => '2026-08-30T14:00:00.000Z' }
    );

    await adapters.fetch.fetch(
      {
        url: 'https://employer.example/jobs/1',
        candidateId: 'c1',
      },
      { run: runStub(), now: () => '2026-08-30T14:00:00.000Z' }
    );

    await adapters.ai.evaluate({
      candidateId: 'c1',
      identity: {
        externalIds: {},
        canonicalUrl: 'https://employer.example/jobs/1',
        fingerprintMaterial: { title: 'A' },
      },
      extracted: { fields: { title: 'A' } },
      verification: {
        status: 'PASS',
        sourceTrust: 'OFFICIAL',
        freshness: 'CURRENT',
        checks: [],
        verifiedAt: '2026-08-30T14:00:00.000Z',
        evidenceIds: [],
      },
      evidence: [],
      criteria: emptyCriteria(),
      allowedTasks: ['RELEVANCE'],
      run: runStub(),
      now: () => '2026-08-30T14:00:00.000Z',
    });

    expect(limiter.acquireCount('search:brave')).toBe(1);
    expect(limiter.acquireCount('fetch:http')).toBe(1);
    expect(limiter.acquireCount('ai:openai')).toBe(1);
  });

  it('preserves AbortSignal through composed AI adapter', async () => {
    const transport = createMockHttpTransport(async () => ({
      status: 200,
      bodyText: openAiEnvelope([]),
    }));
    const adapters = createProductionDiscoveryAdapters(
      baseConfig({ transport })
    );
    const controller = new AbortController();
    controller.abort();

    const result = await adapters.ai.evaluate({
      candidateId: 'c1',
      identity: {
        externalIds: {},
        canonicalUrl: 'https://employer.example/jobs/1',
        fingerprintMaterial: { title: 'A' },
      },
      extracted: { fields: {} },
      verification: {
        status: 'PASS',
        sourceTrust: 'OFFICIAL',
        freshness: 'CURRENT',
        checks: [],
        verifiedAt: '2026-08-30T14:00:00.000Z',
        evidenceIds: [],
      },
      evidence: [],
      criteria: emptyCriteria(),
      allowedTasks: ['RELEVANCE'],
      run: runStub(),
      now: () => '2026-08-30T14:00:00.000Z',
      signal: controller.signal,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasonCode).toBe('AI_CANCELLED');
  });
});

describe('E3.7 pipeline wiring', () => {
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

  it('createProductionDiscoveryAdapters → executeDiscoveryPipeline with mock transport', async () => {
    const html = `<html><body><h1>Frontend Engineer</h1><div data-field="location">Berlin</div></body></html>`;
    const transport = createMockHttpTransport(async (req) => {
      if (req.url.includes('api.search.brave.com') || req.method === 'GET' && req.url.includes('search')) {
        return {
          status: 200,
          bodyText: JSON.stringify({
            web: {
              results: [
                {
                  title: 'Frontend Engineer',
                  url: 'https://employer.example/jobs/fe',
                  description: 'Berlin',
                },
              ],
            },
          }),
        };
      }
      if (req.method === 'POST') {
        return {
          status: 200,
          bodyText: openAiEnvelope([
            {
              task: 'RELEVANCE',
              outcome: 'INTERPRETED',
              interpretationConfidence: 0.8,
            },
            {
              task: 'SENIORITY',
              outcome: 'INTERPRETED',
              interpretationConfidence: 0.6,
            },
            {
              task: 'CLASSIFY',
              outcome: 'INTERPRETED',
              interpretationConfidence: 0.5,
            },
          ]),
        };
      }
      return {
        status: 200,
        bodyText: html,
        headers: { 'content-type': 'text/html' },
        finalUrl: 'https://employer.example/jobs/fe',
      };
    });

    const composed = createProductionDiscoveryAdapters(
      baseConfig({
        transport,
        rateLimiter: createInMemoryRateLimiter(),
        rawContentStore: createInMemoryRawContentStore(),
      })
    );

    const result = await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      adapters: {
        search: composed.search,
        fetch: composed.fetch,
        extract: composed.extract,
        verify: composed.verify,
        ai: composed.ai,
      },
      now: () => '2026-08-30T14:00:00.000Z',
      runId: 'run-e37-pipeline',
    });

    expect(result.batch.active.length + result.batch.rejected.length).toBeGreaterThan(
      0
    );
    expect(JSON.stringify(result.stageDiagnostics)).not.toContain(
      'brave-secret-key-abc'
    );
    expect(JSON.stringify(result.stageDiagnostics)).not.toContain(
      'sk-openai-secret-xyz'
    );
  });
});
