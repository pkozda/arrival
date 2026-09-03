import { describe, expect, it } from 'vitest';
import {
  createDefaultDiscoveryRegistry,
  createFakeAiAdapter,
  createInMemoryProfileStore,
  createInMemoryRateLimiter,
  createInMemoryRawContentStore,
  createInMemoryResultStore,
  createMockHttpTransport,
  createProductionContentExtractor,
  createProductionFetchAdapter,
  createProductionVerificationAdapter,
  deriveVerificationStatus,
  emptyCriteria,
  executeDiscoveryPipeline,
  finalizeVerificationResult,
  jobDiscoveryStrategyV1,
  type DiscoveryProfile,
  type DiscoveryRun,
  type VerificationRequest,
} from '../../index.js';
import {
  FIXTURE_AGGREGATOR_JOBPOSTING_ONLY_HTML,
  FIXTURE_AGGREGATOR_WITH_EMPLOYER_LINK_HTML,
  FIXTURE_AGGREGATOR_WITH_EVENTS_LINK_HTML,
  FIXTURE_EMPLOYER_MARKETING_EVENTS_HTML,
  FIXTURE_MISMATCHED_EMPLOYER_JOB_HTML,
  FIXTURE_OFFICIAL_EMPLOYER_JOB_HTML,
} from './fixtures/e12-2-official-employer.js';

const AGG_URL = 'https://board.example/jobs/frontend-123';
const OFFICIAL_URL = 'https://careers.acme-robotics.example/jobs/frontend-engineer';
const MISMATCH_URL = 'https://careers.beta-widgets.example/jobs/frontend-engineer';
const EVENTS_URL = 'https://events.example-corp.example/';
const RESOURCE_AGG_URL =
  'https://resources.example-corp.example/senior-frontend-engineer-job-description';

function runStub(): DiscoveryRun {
  return {
    id: 'run-e122',
    profileId: 'profile-job',
    strategyId: 'job-discovery',
    strategyVersion: '1',
    criteriaSnapshot: emptyCriteria(),
    startedAt: '2026-09-02T10:00:00.000Z',
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

function aggregatorRequest(
  overrides: Partial<VerificationRequest> = {}
): VerificationRequest {
  return {
    candidateId: 'c-agg',
    identity: {
      externalIds: {},
      canonicalUrl: AGG_URL,
      fingerprintMaterial: {
        title: 'Frontend Engineer',
        company: 'Acme Robotics',
      },
    },
    source: { trust: 'AGGREGATOR', label: 'brave-search', url: AGG_URL },
    canonicalUrl: AGG_URL,
    raw: {
      ref: 'raw-agg',
      sourceUrl: AGG_URL,
      capturedAt: '2026-09-02T10:00:00.000Z',
    },
    extracted: {
      fields: {
        title: 'Frontend Engineer',
        organization: 'Acme Robotics',
        company: 'Acme Robotics',
        links: JSON.stringify([
          {
            href: OFFICIAL_URL,
            text: 'Apply on company career site',
          },
        ]),
      },
    },
    verificationPolicy: jobDiscoveryStrategyV1.verificationPolicy,
    freshnessPolicy: jobDiscoveryStrategyV1.freshnessPolicy,
    run: runStub(),
    now: () => '2026-09-02T10:00:00.000Z',
    ...overrides,
  };
}

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
    notification: { emailEnabled: false, skipEmptyDigest: true },
    enabled: true,
    createdAt: '2026-09-02T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
  };
}

describe('E12.2 Official employer verification bridge', () => {
  it('aggregator JobPosting + employer name alone cannot become OFFICIAL', async () => {
    const store = createInMemoryRawContentStore();
    store.put('raw-agg', {
      body: FIXTURE_AGGREGATOR_JOBPOSTING_ONLY_HTML,
      contentType: 'text/html',
    });
    const adapter = createProductionVerificationAdapter({
      rawContentStore: store,
      transport: createMockHttpTransport(async () => {
        throw new Error('UNEXPECTED_NETWORK_REQUEST');
      }),
    });

    const result = await adapter.verify(
      aggregatorRequest({
        extracted: {
          fields: {
            title: 'Frontend Engineer',
            organization: 'Acme Robotics',
            // no off-domain links
          },
        },
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.sourceTrust).toBe('AGGREGATOR');
    expect(deriveVerificationStatus(result.result.checks)).toBe('UNKNOWN');
    expect(
      result.result.checks.find((c) => c.id === 'official_source')?.outcome
    ).toBe('UNKNOWN');
    const finalized = finalizeVerificationResult({
      result: result.result,
      evidence: result.evidence,
      policy: jobDiscoveryStrategyV1.verificationPolicy,
    });
    expect(finalized.ok).toBe(true);
    if (finalized.ok) expect(finalized.result.status).toBe('UNKNOWN');
  });

  it('aggregator → official employer page succeeds with OFFICIAL evidence', async () => {
    const store = createInMemoryRawContentStore();
    store.put('raw-agg', {
      body: FIXTURE_AGGREGATOR_WITH_EMPLOYER_LINK_HTML,
      contentType: 'text/html',
    });
    const adapter = createProductionVerificationAdapter({
      rawContentStore: store,
      rateLimiter: createInMemoryRateLimiter(),
      transport: createMockHttpTransport(async (req) => {
        if (req.url.startsWith(OFFICIAL_URL)) {
          return {
            status: 200,
            bodyText: FIXTURE_OFFICIAL_EMPLOYER_JOB_HTML,
            headers: { 'content-type': 'text/html' },
            finalUrl: OFFICIAL_URL,
          };
        }
        throw new Error(`UNEXPECTED_NETWORK_REQUEST:${req.url}`);
      }),
    });

    const result = await adapter.verify(aggregatorRequest());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(deriveVerificationStatus(result.result.checks)).toBe('PASS');
    expect(result.result.sourceTrust).toBe('OFFICIAL');
    const officialEv = result.evidence.find((e) => e.type === 'OFFICIAL_SOURCE');
    expect(officialEv?.sourceUrl).toBe(OFFICIAL_URL);
    const discoveryEv = result.evidence.find((e) => e.type === 'OTHER');
    expect(discoveryEv?.sourceUrl).toBe(AGG_URL);

    const finalized = finalizeVerificationResult({
      result: result.result,
      evidence: result.evidence,
      policy: jobDiscoveryStrategyV1.verificationPolicy,
    });
    expect(finalized.ok).toBe(true);
    if (finalized.ok) {
      expect(finalized.result.status).toBe('PASS');
      expect(finalized.result.sourceTrust).toBe('OFFICIAL');
    }
  });

  it('employer attribution mismatch fails closed', async () => {
    const store = createInMemoryRawContentStore();
    store.put('raw-agg', {
      body: FIXTURE_AGGREGATOR_WITH_EMPLOYER_LINK_HTML,
      contentType: 'text/html',
    });
    const adapter = createProductionVerificationAdapter({
      rawContentStore: store,
      transport: createMockHttpTransport(async (req) => {
        if (req.url.includes('acme-robotics.example')) {
          return {
            status: 200,
            bodyText: FIXTURE_MISMATCHED_EMPLOYER_JOB_HTML,
            headers: { 'content-type': 'text/html' },
            finalUrl: MISMATCH_URL,
          };
        }
        throw new Error(`UNEXPECTED_NETWORK_REQUEST:${req.url}`);
      }),
    });

    const result = await adapter.verify(aggregatorRequest());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.sourceTrust).toBe('AGGREGATOR');
    expect(
      result.result.checks.find((c) => c.id === 'official_source')?.outcome
    ).toBe('UNKNOWN');
  });

  it('official page fetch failure fails closed', async () => {
    const store = createInMemoryRawContentStore();
    store.put('raw-agg', {
      body: FIXTURE_AGGREGATOR_WITH_EMPLOYER_LINK_HTML,
      contentType: 'text/html',
    });
    const adapter = createProductionVerificationAdapter({
      rawContentStore: store,
      transport: createMockHttpTransport(async () => ({
        status: 404,
        bodyText: 'not found',
        headers: { 'content-type': 'text/plain' },
      })),
    });

    const result = await adapter.verify(aggregatorRequest());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.sourceTrust).toBe('AGGREGATOR');
    expect(
      result.result.checks.find((c) => c.id === 'official_source')?.outcome
    ).toBe('UNKNOWN');
  });

  it('E12.5 rejects official marketing/events bridge when only title overlap matches', async () => {
    const store = createInMemoryRawContentStore();
    store.put('raw-resource', {
      body: FIXTURE_AGGREGATOR_WITH_EVENTS_LINK_HTML,
      contentType: 'text/html',
    });
    const adapter = createProductionVerificationAdapter({
      rawContentStore: store,
      transport: createMockHttpTransport(async (req) => {
        if (req.url.startsWith(EVENTS_URL) || req.url.includes('events.example-corp.example')) {
          return {
            status: 200,
            bodyText: FIXTURE_EMPLOYER_MARKETING_EVENTS_HTML,
            headers: { 'content-type': 'text/html' },
            finalUrl: EVENTS_URL,
          };
        }
        throw new Error(`UNEXPECTED_NETWORK_REQUEST:${req.url}`);
      }),
    });

    const result = await adapter.verify(
      aggregatorRequest({
        identity: {
          externalIds: {},
          canonicalUrl: RESOURCE_AGG_URL,
          fingerprintMaterial: {
            title: 'Senior Frontend Engineer Job Description [+TEMPLATE 2024]',
            company: 'Example Corp',
          },
        },
        source: { trust: 'AGGREGATOR', label: 'tavily-search', url: RESOURCE_AGG_URL },
        canonicalUrl: RESOURCE_AGG_URL,
        raw: {
          ref: 'raw-resource',
          sourceUrl: RESOURCE_AGG_URL,
          capturedAt: '2026-09-02T10:00:00.000Z',
        },
        extracted: {
          fields: {
            title: 'Senior Frontend Engineer Job Description [+TEMPLATE 2024]',
            organization: 'Example Corp',
            links: JSON.stringify([
              { href: EVENTS_URL, text: 'Example Corp Events' },
            ]),
          },
        },
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.sourceTrust).toBe('AGGREGATOR');
    expect(
      result.result.checks.find((c) => c.id === 'official_source')?.outcome
    ).toBe('UNKNOWN');
    const finalized = finalizeVerificationResult({
      result: result.result,
      evidence: result.evidence,
      policy: jobDiscoveryStrategyV1.verificationPolicy,
    });
    expect(finalized.ok).toBe(true);
    if (finalized.ok) expect(finalized.result.status).not.toBe('PASS');
  });

  it('E12.5 official JobPosting JSON-LD page passes bridge without title overlap', async () => {
    const store = createInMemoryRawContentStore();
    store.put('raw-agg', {
      body: FIXTURE_AGGREGATOR_WITH_EMPLOYER_LINK_HTML,
      contentType: 'text/html',
    });
    const officialRootUrl = 'https://www.acme-robotics.example/';
    const adapter = createProductionVerificationAdapter({
      rawContentStore: store,
      transport: createMockHttpTransport(async (req) => {
        if (req.url.startsWith(officialRootUrl) || req.url.includes('acme-robotics.example')) {
          return {
            status: 200,
            bodyText: FIXTURE_OFFICIAL_EMPLOYER_JOB_HTML,
            headers: { 'content-type': 'text/html' },
            finalUrl: officialRootUrl,
          };
        }
        throw new Error(`UNEXPECTED_NETWORK_REQUEST:${req.url}`);
      }),
    });

    const result = await adapter.verify(
      aggregatorRequest({
        extracted: {
          fields: {
            title: 'Unrelated Discovery Title',
            organization: 'Acme Robotics',
            links: JSON.stringify([
              { href: officialRootUrl, text: 'Company website' },
            ]),
          },
        },
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(deriveVerificationStatus(result.result.checks)).toBe('PASS');
    expect(result.result.sourceTrust).toBe('OFFICIAL');
    expect(
      result.result.checks.find((c) => c.id === 'official_source')?.outcome
    ).toBe('TRUE');
  });

  it('direct OFFICIAL source candidates still pass without bridge', async () => {
    const store = createInMemoryRawContentStore();
    store.put('raw-official', {
      body: FIXTURE_OFFICIAL_EMPLOYER_JOB_HTML,
      contentType: 'text/html',
    });
    const adapter = createProductionVerificationAdapter({
      rawContentStore: store,
      transport: createMockHttpTransport(async () => {
        throw new Error('UNEXPECTED_NETWORK_REQUEST');
      }),
    });

    const result = await adapter.verify({
      candidateId: 'c-official',
      identity: {
        externalIds: {},
        canonicalUrl: OFFICIAL_URL,
        fingerprintMaterial: { title: 'Frontend Engineer' },
      },
      source: { trust: 'OFFICIAL', url: OFFICIAL_URL },
      canonicalUrl: OFFICIAL_URL,
      raw: {
        ref: 'raw-official',
        sourceUrl: OFFICIAL_URL,
        capturedAt: '2026-09-02T10:00:00.000Z',
      },
      extracted: {
        fields: {
          title: 'Frontend Engineer',
          organization: 'Acme Robotics',
        },
      },
      verificationPolicy: jobDiscoveryStrategyV1.verificationPolicy,
      freshnessPolicy: jobDiscoveryStrategyV1.freshnessPolicy,
      run: runStub(),
      now: () => '2026-09-02T10:00:00.000Z',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(deriveVerificationStatus(result.result.checks)).toBe('PASS');
    expect(result.result.sourceTrust).toBe('OFFICIAL');
  });

  it('end-to-end: aggregator search → employer bridge → promoted result', async () => {
    const rawStore = createInMemoryRawContentStore();
    const transport = createMockHttpTransport(async (req) => {
      if (req.url.includes('api.search.brave.com')) {
        return {
          status: 200,
          bodyText: JSON.stringify({
            web: {
              results: [
                {
                  title: 'Frontend Engineer',
                  url: AGG_URL,
                  description: 'Acme Robotics role on job board',
                },
              ],
            },
          }),
        };
      }
      if (req.url === AGG_URL || req.url.startsWith(AGG_URL)) {
        return {
          status: 200,
          bodyText: FIXTURE_AGGREGATOR_WITH_EMPLOYER_LINK_HTML,
          headers: { 'content-type': 'text/html' },
          finalUrl: AGG_URL,
        };
      }
      if (req.url.startsWith(OFFICIAL_URL) || req.url.includes('acme-robotics.example')) {
        return {
          status: 200,
          bodyText: FIXTURE_OFFICIAL_EMPLOYER_JOB_HTML,
          headers: { 'content-type': 'text/html' },
          finalUrl: OFFICIAL_URL,
        };
      }
      if (req.url.includes('api.openai.com')) {
        return {
          status: 200,
          bodyText: JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    tasks: [
                      {
                        task: 'RELEVANCE',
                        outcome: 'INTERPRETED',
                        interpretationConfidence: 0.9,
                        rationale: 'Role matches',
                      },
                      {
                        task: 'SENIORITY',
                        outcome: 'INTERPRETED',
                        interpretationConfidence: 0.8,
                        rationale: 'Mid',
                      },
                      {
                        task: 'CLASSIFY',
                        outcome: 'INTERPRETED',
                        interpretationConfidence: 0.8,
                        rationale: 'Engineering',
                      },
                    ],
                  }),
                },
              },
            ],
            usage: { prompt_tokens: 10, completion_tokens: 20 },
          }),
        };
      }
      throw new Error(`UNEXPECTED_NETWORK_REQUEST:${req.url}`);
    });

    const resultStore = createInMemoryResultStore();
    const result = await executeDiscoveryPipeline({
      profileId: 'profile-job',
      registry: createDefaultDiscoveryRegistry(),
      profileStore: createInMemoryProfileStore([jobProfile()]),
      resultStore,
      resultWriter: resultStore,
      adapters: {
        search: (
          await import('../search/brave-search-adapter.js')
        ).createProductionSearchAdapter({
          apiKey: 'test-brave',
          transport,
          rateLimiter: createInMemoryRateLimiter(),
        }),
        fetch: createProductionFetchAdapter({
          rawContentStore: rawStore,
          transport,
          rateLimiter: createInMemoryRateLimiter(),
        }),
        extract: createProductionContentExtractor({ rawContentStore: rawStore }),
        verify: createProductionVerificationAdapter({
          rawContentStore: rawStore,
          transport,
          rateLimiter: createInMemoryRateLimiter(),
        }),
        ai: createFakeAiAdapter({
          defaultTasks: [
            {
              task: 'RELEVANCE',
              outcome: 'INTERPRETED',
              interpretationConfidence: 0.9,
            },
            {
              task: 'SENIORITY',
              outcome: 'INTERPRETED',
              interpretationConfidence: 0.8,
            },
            {
              task: 'CLASSIFY',
              outcome: 'INTERPRETED',
              interpretationConfidence: 0.8,
            },
          ],
        }),
      },
      now: () => '2026-09-02T10:00:00.000Z',
      runId: 'run-e122-e2e',
    });

    expect(result.run.status === 'SUCCESS' || result.run.status === 'PARTIAL_SUCCESS').toBe(
      true
    );
    expect(result.batch.active.some((c) => c.stage === 'PROMOTED')).toBe(true);
    const promoted = result.batch.active.find((c) => c.stage === 'PROMOTED');
    expect(promoted?.verification?.status).toBe('PASS');
    expect(promoted?.verification?.sourceTrust).toBe('OFFICIAL');
    expect(promoted?.source.trust).toBe('AGGREGATOR');
    expect(
      promoted?.evidence?.some(
        (e) => e.type === 'OFFICIAL_SOURCE' && e.sourceUrl === OFFICIAL_URL
      )
    ).toBe(true);
    expect(
      promoted?.evidence?.some((e) => e.type === 'OTHER' && e.sourceUrl === AGG_URL)
    ).toBe(true);
    expect(promoted?.promotedResult).toBeDefined();
  });
});
