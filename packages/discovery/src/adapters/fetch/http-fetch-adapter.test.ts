import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createDefaultDiscoveryRegistry,
  createFakeContentExtractor,
  createFakeSearchAdapter,
  createInMemoryProfileStore,
  createInMemoryRateLimiter,
  createInMemoryRawContentStore,
  createMockHttpTransport,
  createProductionFetchAdapter,
  emptyCriteria,
  executeDiscoveryPipeline,
  type DiscoveryProfile,
  type DiscoveryRun,
} from '../../index.js';

function runStub(): DiscoveryRun {
  return {
    id: 'run-fetch-1',
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

function ctx(overrides: { signal?: AbortSignal; timeoutMs?: number } = {}) {
  return {
    run: runStub(),
    now: () => '2026-08-30T14:00:00.000Z',
    ...overrides,
  };
}

describe('E3.3 Production FetchAdapter', () => {
  it('fetches HTML, stores body, returns RawContentRef with hash', async () => {
    const body = '<html><body>Hello job</body></html>';
    const store = createInMemoryRawContentStore();
    const transport = createMockHttpTransport(async () => ({
      status: 200,
      bodyText: body,
      headers: { 'content-type': 'text/html; charset=utf-8' },
      finalUrl: 'https://employer.example/jobs/1',
    }));

    const adapter = createProductionFetchAdapter({
      rawContentStore: store,
      transport,
    });

    const result = await adapter.fetch(
      { url: 'https://employer.example/jobs/1', candidateId: 'c1' },
      ctx()
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const expectedHash = createHash('sha256').update(body, 'utf8').digest('hex');
    expect(result.content.contentHash).toBe(expectedHash);
    expect(result.content.ref).toBe(`raw:${expectedHash}`);
    expect(result.content.sourceUrl).toBe('https://employer.example/jobs/1');
    expect(result.content.contentType).toBe('text/html');
    expect(result.content.capturedAt).toBe('2026-08-30T14:00:00.000Z');
    expect(store.get(result.content.ref)?.body).toBe(body);
    expect(transport.requests[0]?.headers?.['User-Agent']).toBeTruthy();
  });

  it('accepts xhtml and text/plain', async () => {
    const store = createInMemoryRawContentStore();
    for (const contentType of ['application/xhtml+xml', 'text/plain'] as const) {
      const adapter = createProductionFetchAdapter({
        rawContentStore: store,
        transport: createMockHttpTransport(async () => ({
          status: 200,
          bodyText: 'ok',
          headers: { 'content-type': contentType },
        })),
      });
      const result = await adapter.fetch(
        { url: 'https://employer.example/page', candidateId: 'c1' },
        ctx()
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.content.contentType).toBe(contentType);
    }
  });

  it('maps 401/403/404/429/5xx and network failures', async () => {
    const cases: Array<{ status?: number; network?: boolean; code: string }> = [
      { status: 401, code: 'AUTH_REQUIRED' },
      { status: 403, code: 'POLICY_BLOCKED' },
      { status: 404, code: 'INVALID_RESPONSE' },
      { status: 429, code: 'RATE_LIMITED' },
      { status: 503, code: 'UNAVAILABLE' },
      { network: true, code: 'NETWORK_ERROR' },
    ];

    for (const c of cases) {
      const adapter = createProductionFetchAdapter({
        rawContentStore: createInMemoryRawContentStore(),
        transport: createMockHttpTransport(async () => {
          if (c.network) throw new Error('ECONNRESET');
          return { status: c.status!, bodyText: '', headers: {} };
        }),
      });
      const result = await adapter.fetch(
        { url: 'https://employer.example/x', candidateId: 'c1' },
        ctx()
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.failureCode).toBe(c.code);
      expect(result.reasonCode).toBe('FETCH_FAILED');
    }
  });

  it('timeout and cancellation', async () => {
    const timeoutAdapter = createProductionFetchAdapter({
      rawContentStore: createInMemoryRawContentStore(),
      timeoutMs: 20,
      transport: createMockHttpTransport(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  status: 200,
                  bodyText: 'late',
                  headers: { 'content-type': 'text/html' },
                }),
              200
            );
          })
      ),
    });
    const timed = await timeoutAdapter.fetch(
      { url: 'https://employer.example/slow', candidateId: 'c1' },
      ctx()
    );
    expect(timed.ok).toBe(false);
    if (!timed.ok) {
      expect(timed.reasonCode).toBe('FETCH_TIMEOUT');
      expect(timed.failureCode).toBe('TIMEOUT');
    }

    const controller = new AbortController();
    controller.abort();
    const cancelled = await createProductionFetchAdapter({
      rawContentStore: createInMemoryRawContentStore(),
      transport: createMockHttpTransport(async () => ({
        status: 200,
        bodyText: 'x',
        headers: { 'content-type': 'text/html' },
      })),
    }).fetch(
      { url: 'https://employer.example/x', candidateId: 'c1' },
      ctx({ signal: controller.signal })
    );
    expect(cancelled.ok).toBe(false);
    if (!cancelled.ok) {
      expect(cancelled.reasonCode).toBe('FETCH_CANCELLED');
    }
  });

  it('rejects oversized and unsupported content types', async () => {
    const oversized = await createProductionFetchAdapter({
      rawContentStore: createInMemoryRawContentStore(),
      maxResponseBytes: 10,
      transport: createMockHttpTransport(async () => ({
        status: 200,
        bodyText: '0123456789ABCDEF',
        headers: { 'content-type': 'text/html' },
      })),
    }).fetch(
      { url: 'https://employer.example/big', candidateId: 'c1' },
      ctx()
    );
    expect(oversized.ok).toBe(false);
    if (!oversized.ok) {
      expect(oversized.failureCode).toBe('INVALID_RESPONSE');
      expect(oversized.message).toMatch(/maxResponseBytes/);
      expect(oversized.message).not.toContain('0123456789ABCDEF');
    }

    const truncated = await createProductionFetchAdapter({
      rawContentStore: createInMemoryRawContentStore(),
      maxResponseBytes: 10,
      transport: createMockHttpTransport(async () => ({
        status: 200,
        bodyText: '',
        headers: { 'content-type': 'text/html' },
        truncated: true,
      })),
    }).fetch(
      { url: 'https://employer.example/trunc', candidateId: 'c1' },
      ctx()
    );
    expect(truncated.ok).toBe(false);
    if (!truncated.ok) expect(truncated.failureCode).toBe('INVALID_RESPONSE');

    const badType = await createProductionFetchAdapter({
      rawContentStore: createInMemoryRawContentStore(),
      transport: createMockHttpTransport(async () => ({
        status: 200,
        bodyText: '\x00\x01',
        headers: { 'content-type': 'application/pdf' },
      })),
    }).fetch(
      { url: 'https://employer.example/file.pdf', candidateId: 'c1' },
      ctx()
    );
    expect(badType.ok).toBe(false);
    if (!badType.ok) expect(badType.failureCode).toBe('INVALID_RESPONSE');
  });

  it('rejects invalid / non-http URLs', async () => {
    const adapter = createProductionFetchAdapter({
      rawContentStore: createInMemoryRawContentStore(),
      transport: createMockHttpTransport(async () => ({
        status: 200,
        bodyText: 'x',
        headers: { 'content-type': 'text/html' },
      })),
    });

    const bad = await adapter.fetch(
      { url: 'javascript:alert(1)', candidateId: 'c1' },
      ctx()
    );
    expect(bad.ok).toBe(false);

    const ftp = await adapter.fetch(
      { url: 'ftp://files.example/a', candidateId: 'c1' },
      ctx()
    );
    expect(ftp.ok).toBe(false);
    if (!ftp.ok) expect(ftp.failureCode).toBe('POLICY_BLOCKED');
  });

  it('invokes rate limiter with fetch:http', async () => {
    const limiter = createInMemoryRateLimiter();
    await createProductionFetchAdapter({
      rawContentStore: createInMemoryRawContentStore(),
      rateLimiter: limiter,
      transport: createMockHttpTransport(async () => ({
        status: 200,
        bodyText: 'ok',
        headers: { 'content-type': 'text/html' },
      })),
    }).fetch(
      { url: 'https://employer.example/x', candidateId: 'c1' },
      ctx()
    );
    expect(limiter.acquireCount('fetch:http')).toBe(1);
  });

  it('does not leak secrets into failure messages', async () => {
    const secret = 'super-secret-cookie-value-abcdefghijklmnopqrstuvwxyz';
    const result = await createProductionFetchAdapter({
      rawContentStore: createInMemoryRawContentStore(),
      transport: createMockHttpTransport(async () => ({
        status: 401,
        bodyText: `denied cookie=${secret}`,
        headers: { 'set-cookie': secret },
      })),
    }).fetch(
      { url: 'https://employer.example/secure', candidateId: 'c1' },
      ctx()
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).not.toContain(secret);
      expect(JSON.stringify(result)).not.toContain(secret);
    }
  });
});

describe('E3.3 pipeline Collect → Parse with production FetchAdapter', () => {
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

  it('successful fetch feeds RawContentRef into Parse', async () => {
    const store = createInMemoryRawContentStore();
    const html =
      '<html><body><h1>Frontend Engineer</h1><p>Berlin</p></body></html>';
    const fetch = createProductionFetchAdapter({
      rawContentStore: store,
      transport: createMockHttpTransport(async () => ({
        status: 200,
        bodyText: html,
        headers: { 'content-type': 'text/html' },
        finalUrl: 'https://employer.example/jobs/fe',
      })),
    });
    const extract = createFakeContentExtractor({ contentStore: store });

    const result = await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      adapters: {
        search: createFakeSearchAdapter({
          defaultResults: [
            {
              discoveredUrl: 'https://employer.example/jobs/fe',
              title: 'Frontend Engineer',
              source: { trust: 'AGGREGATOR' },
            },
          ],
        }),
        fetch,
        extract,
      },
      now: () => '2026-08-30T14:00:00.000Z',
      runId: 'run-e33-ok',
    });

    const cand = result.batch.active[0];
    expect(cand).toBeDefined();
    expect(cand!.raw.sourceUrl).toBe('https://employer.example/jobs/fe');
    expect(cand!.raw.contentHash).toBeTruthy();
    expect(store.has(cand!.raw.ref)).toBe(true);
    expect(cand!.extracted.fields.title ?? cand!.identity.fingerprintMaterial.title).toBeTruthy();
  });

  it('fetch failure is observable and not empty success', async () => {
    const store = createInMemoryRawContentStore();
    const result = await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      adapters: {
        search: createFakeSearchAdapter({
          defaultResults: [
            {
              discoveredUrl: 'https://employer.example/gone',
              title: 'Gone',
              source: { trust: 'AGGREGATOR' },
            },
          ],
        }),
        fetch: createProductionFetchAdapter({
          rawContentStore: store,
          transport: createMockHttpTransport(async () => ({
            status: 404,
            bodyText: 'missing',
            headers: { 'content-type': 'text/html' },
          })),
        }),
        extract: createFakeContentExtractor({ contentStore: store }),
      },
      now: () => '2026-08-30T14:00:00.000Z',
      runId: 'run-e33-fail',
    });

    expect(result.batch.active).toHaveLength(0);
    expect(result.batch.rejected.length).toBeGreaterThanOrEqual(1);
    expect(result.batch.rejected[0]?.rejection.details?.failure).toBe(
      'INVALID_RESPONSE'
    );
    expect(result.run.status).toBe('PARTIAL_SUCCESS');
    const collectDiag = result.stageDiagnostics.find(
      (d) => d.stage === 'collect' && d.outcome === 'reject'
    );
    expect(collectDiag?.reasonCode).toBe('FETCH_FAILED');
    expect(JSON.stringify(result.stageDiagnostics)).not.toContain('missing');
  });
});
