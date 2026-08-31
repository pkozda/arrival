import { describe, expect, it } from 'vitest';
import {
  createInMemoryProfileStore,
  createInMemoryRateLimiter,
  createInMemoryRawContentStore,
  createInMemoryResultStore,
  createMockHttpTransport,
  createProductionDiscoveryAdapters,
  createStrategyRegistry,
  emptyCriteria,
  executeDiscoveryPipeline,
  jobDiscoveryStrategyV1,
  loadDiscoveryProductionConfig,
  redactDiscoveryProductionConfig,
  validateDiscoveryProductionConfig,
  type DiscoveryProfile,
  type DiscoveryStrategyModule,
  type HttpRequest,
  type HttpResponse,
  type HttpTransport,
} from '../../index.js';

/**
 * Brave Search always tags results as AGGREGATOR (search ≠ official employer).
 * Smoke uses the real job strategy with verification requiring `current_page`
 * so production adapters can reach PASS/PROMOTE without inventing OFFICIAL trust.
 */
function smokeJobStrategy(): DiscoveryStrategyModule {
  return {
    ...jobDiscoveryStrategyV1,
    verificationPolicy: {
      requireVerificationPass: true,
      requiredChecks: [{ id: 'current_page', allowUnknown: false }],
      requireOfficialSource: false,
      acceptedSourceTrustForDiscovery: [
        'OFFICIAL',
        'ESTABLISHED_THIRD_PARTY',
        'AGGREGATOR',
      ],
    },
  };
}

function smokeRegistry() {
  return createStrategyRegistry([smokeJobStrategy()]);
}

function jobProfile(
  overrides: Partial<DiscoveryProfile> = {}
): DiscoveryProfile {
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
    ...overrides,
  };
}

const CANDIDATE_URL = 'https://careers.employer.example/jobs/frontend-engineer';
const NOW = '2026-08-30T14:00:00.000Z';

const SMOKE_JOB_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>Frontend Engineer</title>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"JobPosting","title":"Frontend Engineer","hiringOrganization":{"name":"Acme GmbH"},"jobLocation":{"address":{"addressLocality":"Berlin"}},"employmentType":"FULL_TIME"}
  </script>
</head>
<body>
  <h1>Frontend Engineer</h1>
  <div data-field="organization">Acme GmbH</div>
  <div data-field="location">Berlin</div>
  <div data-field="employmentType">full-time</div>
  <p>Join Acme GmbH in Berlin. Full-time Frontend Engineer role.</p>
  <a href="${CANDIDATE_URL}">Apply</a>
</body>
</html>`;

function braveSearchBody(url = CANDIDATE_URL) {
  return JSON.stringify({
    web: {
      results: [
        {
          title: 'Frontend Engineer',
          url,
          description: 'Acme GmbH — Berlin — full-time',
        },
      ],
    },
  });
}

function openAiBody(tasks: unknown[]) {
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

const DEFAULT_AI_TASKS = [
  {
    task: 'RELEVANCE',
    outcome: 'INTERPRETED',
    interpretationConfidence: 0.85,
    details: { label: 'strong_fit' },
  },
  {
    task: 'SENIORITY',
    outcome: 'INTERPRETED',
    interpretationConfidence: 0.7,
    details: { seniority: 'mid' },
  },
  {
    task: 'CLASSIFY',
    outcome: 'INTERPRETED',
    interpretationConfidence: 0.65,
    details: { category: 'engineering' },
  },
];

/**
 * Deterministic transport — throws UNEXPECTED_NETWORK_REQUEST for unregistered calls.
 * Makes accidental real-network usage impossible in this suite.
 */
function createSmokeHttpTransport(options: {
  onSearch?: (req: HttpRequest) => Promise<HttpResponse> | HttpResponse;
  onPage?: (req: HttpRequest) => Promise<HttpResponse> | HttpResponse;
  onAi?: (req: HttpRequest) => Promise<HttpResponse> | HttpResponse;
}): HttpTransport & { requests: HttpRequest[] } {
  return createMockHttpTransport(async (req) => {
    const url = req.url;
    const method = (req.method ?? 'GET').toUpperCase();

    if (method === 'POST' || url.includes('/chat/completions')) {
      if (!options.onAi) {
        throw new Error(`UNEXPECTED_NETWORK_REQUEST: AI ${method} ${url}`);
      }
      return options.onAi(req);
    }

    if (
      url.includes('api.search.brave.com') ||
      url.includes('/web/search') ||
      (options.onSearch && url.includes('search'))
    ) {
      if (!options.onSearch) {
        throw new Error(`UNEXPECTED_NETWORK_REQUEST: search ${method} ${url}`);
      }
      return options.onSearch(req);
    }

    if (method === 'GET') {
      if (!options.onPage) {
        throw new Error(`UNEXPECTED_NETWORK_REQUEST: page ${method} ${url}`);
      }
      return options.onPage(req);
    }

    throw new Error(`UNEXPECTED_NETWORK_REQUEST: ${method} ${url}`);
  });
}

function composeProduction(transport: HttpTransport, rateLimiter = createInMemoryRateLimiter()) {
  return createProductionDiscoveryAdapters({
    brave: { apiKey: 'brave-smoke-secret-key' },
    openai: { apiKey: 'sk-openai-smoke-secret', model: 'gpt-4o-mini' },
    transport,
    rateLimiter,
    rawContentStore: createInMemoryRawContentStore(),
  });
}

async function runSmokePipeline(opts: {
  transport: HttpTransport;
  rateLimiter?: ReturnType<typeof createInMemoryRateLimiter>;
  signal?: AbortSignal;
  adapterTimeoutMs?: number;
  runId?: string;
  useDefaultJobVerification?: boolean;
}) {
  const composed = composeProduction(
    opts.transport,
    opts.rateLimiter ?? createInMemoryRateLimiter()
  );
  const resultStore = createInMemoryResultStore([]);

  return executeDiscoveryPipeline({
    profileId: 'profile-job',
    registry: opts.useDefaultJobVerification
      ? createStrategyRegistry([jobDiscoveryStrategyV1])
      : smokeRegistry(),
    profileStore: createInMemoryProfileStore([jobProfile()]),
    resultStore,
    resultWriter: resultStore,
    adapters: {
      search: composed.search,
      fetch: composed.fetch,
      extract: composed.extract,
      verify: composed.verify,
      ai: composed.ai,
    },
    now: () => NOW,
    runId: opts.runId ?? 'run-e38-smoke',
    signal: opts.signal,
    adapterTimeoutMs: opts.adapterTimeoutMs,
  });
}

describe('E3.8 production smoke — happy path', () => {
  it('composition → full pipeline → PROMOTED + Result + Digest', async () => {
    const transport = createSmokeHttpTransport({
      onSearch: () => ({
        status: 200,
        bodyText: braveSearchBody(),
      }),
      onPage: (req) => ({
        status: 200,
        bodyText: SMOKE_JOB_HTML,
        headers: { 'content-type': 'text/html; charset=utf-8' },
        finalUrl: req.url,
      }),
      onAi: () => ({
        status: 200,
        bodyText: openAiBody(DEFAULT_AI_TASKS),
      }),
    });

    const result = await runSmokePipeline({ transport, runId: 'run-e38-happy' });

    expect(result.stageOrder).toEqual([
      'resolve_snapshot',
      'build_queries',
      'search',
      'collect',
      'parse',
      'normalize',
      'deduplicate',
      'filter',
      'verify',
      'ai_evaluate',
      'score',
      'novelty_state',
      'persist_promote',
      'digest',
    ]);

    expect(result.run.status).toBe('SUCCESS');
    const promoted = result.batch.active.find((c) => c.stage === 'PROMOTED');
    expect(promoted).toBeDefined();
    expect(promoted?.verification?.status).toBe('PASS');
    expect(promoted?.score).toBeDefined();
    expect(promoted?.aiEvaluation?.tasks.length).toBeGreaterThan(0);
    expect(promoted?.identity.canonicalUrl).toBe(CANDIDATE_URL);
    expect(promoted?.source.trust).toBe('AGGREGATOR');

    // Evidence only from verification — AI must not fabricate
    expect(promoted?.evidence?.every((e) => e.sourceUrl?.startsWith('http'))).toBe(
      true
    );
    expect(
      promoted?.aiEvaluation?.tasks.every(
        (t) => !('sourceUrl' in (t.details ?? {}))
      )
    ).toBe(true);

    expect(result.run.stats.resultsCreated).toBeGreaterThanOrEqual(1);
    expect(result.digest).toBeDefined();
    expect(result.digest!.resultIds.length).toBeGreaterThan(0);
    expect(result.digest!.entries.some((e) => e.shouldNotify)).toBe(true);

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('brave-smoke-secret-key');
    expect(serialized).not.toContain('sk-openai-smoke-secret');
  });
});

describe('E3.8 production smoke — failure / cancel / timeout', () => {
  it('AI adapter failure → continues without AI; PARTIAL_SUCCESS; no fake AI success', async () => {
    const transport = createSmokeHttpTransport({
      onSearch: () => ({ status: 200, bodyText: braveSearchBody() }),
      onPage: (req) => ({
        status: 200,
        bodyText: SMOKE_JOB_HTML,
        headers: { 'content-type': 'text/html' },
        finalUrl: req.url,
      }),
      onAi: () => ({
        status: 503,
        bodyText: 'unavailable sk-openai-smoke-secret',
      }),
    });

    const result = await runSmokePipeline({
      transport,
      runId: 'run-e38-ai-fail',
    });

    expect(result.run.status).toBe('PARTIAL_SUCCESS');
    expect(
      result.stageDiagnostics.some((d) => d.reasonCode === 'AI_ADAPTER_FAILED')
    ).toBe(true);
    expect(JSON.stringify(result.stageDiagnostics)).not.toContain(
      'sk-openai-smoke-secret'
    );

    // Promoted results may still exist without AI
    const promoted = result.batch.active.find((c) => c.stage === 'PROMOTED');
    expect(promoted?.aiEvaluation).toBeUndefined();
    expect(promoted?.verification?.status).toBe('PASS');
    expect(promoted?.score).toBeDefined();
    if (promoted?.promotedResult) {
      expect(result.digest?.resultIds).toContain(promoted.promotedResult.id);
    }
  });

  it('fatal search failure → explicit diagnostic; no fabricated candidates', async () => {
    const transport = createSmokeHttpTransport({
      onSearch: () => ({
        status: 401,
        bodyText: 'unauthorized brave-smoke-secret-key',
      }),
      // page/ai must not be reached; if they are, throw
    });

    const result = await runSmokePipeline({
      transport,
      runId: 'run-e38-search-fail',
    });

    // Existing semantics: search AdapterFailure → PARTIAL_SUCCESS (not silent empty SUCCESS)
    expect(result.run.status).toBe('PARTIAL_SUCCESS');
    expect(result.batch.active).toHaveLength(0);
    expect(result.batch.rejected).toHaveLength(0);
    expect(result.run.stats.candidatesFound).toBe(0);
    expect(result.run.stats.resultsCreated).toBe(0);
    expect(
      result.stageDiagnostics.some(
        (d) =>
          d.stage === 'search' &&
          (d.outcome === 'error' || d.outcome === 'partial')
      )
    ).toBe(true);
    expect(JSON.stringify(result)).not.toContain('brave-smoke-secret-key');
    expect(result.digest?.resultIds ?? []).toHaveLength(0);
  });

  it('AbortSignal propagates to adapters (ADAPTER_CANCELLED); no fake Result', async () => {
    const controller = new AbortController();
    controller.abort();

    const transport = createSmokeHttpTransport({
      onSearch: async (req) => {
        if (req.signal?.aborted) {
          const err = new Error('aborted');
          err.name = 'AbortError';
          throw err;
        }
        return { status: 200, bodyText: braveSearchBody() };
      },
    });

    const result = await runSmokePipeline({
      transport,
      signal: controller.signal,
      runId: 'run-e38-cancel',
    });

    expect(result.batch.active).toHaveLength(0);
    expect(result.run.stats.resultsCreated).toBe(0);
    expect(
      result.stageDiagnostics.some(
        (d) =>
          d.reasonCode === 'ADAPTER_CANCELLED' ||
          d.reasonCode === 'CANCELLED' ||
          String(d.message).toLowerCase().includes('cancel')
      )
    ).toBe(true);
    expect(result.run.status).not.toBe('SUCCESS');
  });

  it('timeout surfaces explicitly; no empty success; no retry storm', async () => {
    let searchCalls = 0;
    const transport = createSmokeHttpTransport({
      onSearch: () =>
        new Promise((resolve) => {
          searchCalls += 1;
          setTimeout(
            () =>
              resolve({
                status: 200,
                bodyText: braveSearchBody(),
              }),
            250
          );
        }),
    });

    const result = await runSmokePipeline({
      transport,
      adapterTimeoutMs: 30,
      runId: 'run-e38-timeout',
    });

    expect(searchCalls).toBe(1);
    expect(result.batch.active).toHaveLength(0);
    expect(result.run.stats.resultsCreated).toBe(0);
    expect(
      result.stageDiagnostics.some(
        (d) =>
          d.reasonCode === 'ADAPTER_TIMEOUT' ||
          d.reasonCode === 'TIMEOUT' ||
          String(d.message).toLowerCase().includes('timed out')
      )
    ).toBe(true);
    expect(result.run.status).not.toBe('SUCCESS');
  });
});

describe('E3.8 contract hardening', () => {
  it('rejects missing/invalid production config without network', () => {
    let calls = 0;
    const transport = createMockHttpTransport(async () => {
      calls += 1;
      throw new Error('UNEXPECTED_NETWORK_REQUEST');
    });

    expect(
      validateDiscoveryProductionConfig({
        brave: { apiKey: '' },
        openai: { apiKey: 'k' },
      }).ok
    ).toBe(false);
    expect(
      validateDiscoveryProductionConfig({
        brave: { apiKey: 'k' },
        openai: { apiKey: '' },
      }).ok
    ).toBe(false);
    expect(
      validateDiscoveryProductionConfig({
        brave: { apiKey: 'k', baseUrl: 'ftp://bad' },
        openai: { apiKey: 'k' },
      }).ok
    ).toBe(false);

    expect(() =>
      loadDiscoveryProductionConfig({ OPENAI_API_KEY: 'k' })
    ).toThrow(/BRAVE_SEARCH_API_KEY/);
    expect(() =>
      loadDiscoveryProductionConfig({ BRAVE_SEARCH_API_KEY: 'k' })
    ).toThrow(/OPENAI_API_KEY/);

    createProductionDiscoveryAdapters({
      brave: { apiKey: 'k' },
      openai: { apiKey: 'k' },
      transport,
    });
    expect(calls).toBe(0);
  });

  it('redacted config never includes API keys', () => {
    const redacted = redactDiscoveryProductionConfig({
      brave: { apiKey: 'brave-leak-test-key' },
      openai: { apiKey: 'sk-openai-leak-test-key', model: 'gpt-4o-mini' },
    });
    const text = JSON.stringify(redacted);
    expect(text).not.toContain('brave-leak-test-key');
    expect(text).not.toContain('sk-openai-leak-test-key');
    expect(redacted.brave.apiKey).toBe('[redacted]');
  });

  it('shared limiter keeps provider-isolated keys through composition', async () => {
    const limiter = createInMemoryRateLimiter();
    const transport = createSmokeHttpTransport({
      onSearch: () => ({ status: 200, bodyText: braveSearchBody() }),
      onPage: (req) => ({
        status: 200,
        bodyText: SMOKE_JOB_HTML,
        headers: { 'content-type': 'text/html' },
        finalUrl: req.url,
      }),
      onAi: () => ({
        status: 200,
        bodyText: openAiBody(DEFAULT_AI_TASKS),
      }),
    });

    await runSmokePipeline({
      transport,
      rateLimiter: limiter,
      runId: 'run-e38-rate',
    });

    expect(limiter.acquireCount('search:brave')).toBeGreaterThanOrEqual(1);
    expect(limiter.acquireCount('fetch:http')).toBeGreaterThanOrEqual(1);
    expect(limiter.acquireCount('ai:openai')).toBeGreaterThanOrEqual(1);
    // No collapsed global key
    expect(limiter.acquireCount('provider')).toBe(0);
    expect(limiter.acquireCount('http')).toBe(0);
  });

  it('aggregator cannot become OFFICIAL under default job verification', async () => {
    const transport = createSmokeHttpTransport({
      onSearch: () => ({ status: 200, bodyText: braveSearchBody() }),
      onPage: (req) => ({
        status: 200,
        bodyText: `${SMOKE_JOB_HTML}<p>This is the official careers page.</p>`,
        headers: { 'content-type': 'text/html' },
        finalUrl: req.url,
      }),
      onAi: () => ({
        status: 200,
        bodyText: openAiBody(DEFAULT_AI_TASKS),
      }),
    });

    const result = await runSmokePipeline({
      transport,
      useDefaultJobVerification: true,
      runId: 'run-e38-agg-official',
    });

    const all = [
      ...result.batch.active,
      ...result.batch.rejected.map((r) => r.candidate),
    ];
    expect(all.some((c) => c.source.trust === 'OFFICIAL')).toBe(false);
    expect(all.every((c) => c.verification?.status !== 'PASS')).toBe(true);
    expect(all.every((c) => c.stage !== 'PROMOTED')).toBe(true);
  });

  it('strict transport fails loudly on unexpected requests', async () => {
    const transport = createSmokeHttpTransport({});

    await expect(
      transport.request({
        url: 'https://unexpected.example/path',
        method: 'GET',
      })
    ).rejects.toThrow(/UNEXPECTED_NETWORK_REQUEST/);

    // Pipeline path: missing page handler → fetch fails; no silent empty success
    const result = await runSmokePipeline({
      transport: createSmokeHttpTransport({
        onSearch: () => ({ status: 200, bodyText: braveSearchBody() }),
      }),
      runId: 'run-e38-unexpected',
    });
    expect(result.run.status).toBe('PARTIAL_SUCCESS');
    expect(result.batch.active.every((c) => c.stage !== 'PROMOTED')).toBe(true);
    expect(result.run.stats.resultsCreated).toBe(0);
  });
});
