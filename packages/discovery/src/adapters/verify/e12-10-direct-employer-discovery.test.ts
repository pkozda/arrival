import { describe, expect, it } from 'vitest';
import {
  createInMemoryRawContentStore,
  createMockHttpTransport,
  createProductionVerificationAdapter,
  deriveVerificationStatus,
  employerNameMatchesHost,
  finalizeVerificationResult,
  isEmployerControlledDiscoveryHost,
  jobDiscoveryStrategyV1,
  resolveExpectedEmployer,
  type DiscoveryRun,
  type VerificationRequest,
} from '../../index.js';
import {
  FIXTURE_DIRECT_EMPLOYER_JOB_PATH_HTML,
  FIXTURE_DIRECT_EMPLOYER_JOBPOSTING_LD_HTML,
  FIXTURE_EMPLOYER_MARKETING_EVENTS_HTML,
  FIXTURE_MISMATCHED_EMPLOYER_JOB_HTML,
  FIXTURE_THIRD_PARTY_BOARD_WITH_EMPLOYER_HTML,
} from './fixtures/e12-2-official-employer.js';

const DIRECT_JOB_URL = 'https://www.auteon.example/jobs/senior-frontend-engineer';
const DIRECT_LD_URL = 'https://www.acme-robotics.example/openings/frontend';
const BOARD_URL = 'https://bebee.com/de/jobs/jedox-senior-frontend';
const EVENTS_URL = 'https://events.example-corp.example/';
const MISMATCH_URL = 'https://careers.beta-widgets.example/jobs/frontend-engineer';

function runStub(): DiscoveryRun {
  return {
    id: 'run-e1210',
    profileId: 'profile-job',
    strategyId: 'job-discovery',
    strategyVersion: '1',
    criteriaSnapshot: {
      required: [],
      preferred: [],
      excluded: [],
      flexible: [],
    },
    startedAt: '2026-09-02T15:00:00.000Z',
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

function aggregatorDiscoveryRequest(
  url: string,
  fields: Record<string, string | null>,
  overrides: Partial<VerificationRequest> = {}
): VerificationRequest {
  return {
    candidateId: 'c-e1210',
    identity: {
      externalIds: {},
      canonicalUrl: url,
      fingerprintMaterial: {
        title: String(fields.title ?? 'Engineer'),
        company: String(fields.organization ?? fields.company ?? ''),
      },
    },
    source: { trust: 'AGGREGATOR', label: 'tavily-search', url },
    canonicalUrl: url,
    raw: {
      ref: 'raw-e1210',
      sourceUrl: url,
      capturedAt: '2026-09-02T15:00:00.000Z',
    },
    extracted: { fields },
    verificationPolicy: jobDiscoveryStrategyV1.verificationPolicy,
    freshnessPolicy: jobDiscoveryStrategyV1.freshnessPolicy,
    run: runStub(),
    now: () => '2026-09-02T15:00:00.000Z',
    ...overrides,
  };
}

describe('E12.10 host authority helpers', () => {
  it('matches employer name in hostname and rejects known aggregator hosts', () => {
    expect(employerNameMatchesHost('Auteon', 'www.auteon.example')).toBe(true);
    expect(employerNameMatchesHost('Jedox', 'bebee.com')).toBe(false);
    expect(
      isEmployerControlledDiscoveryHost({
        discoveryUrl: DIRECT_JOB_URL,
        expectedEmployer: 'Auteon',
      })
    ).toBe(true);
    expect(
      isEmployerControlledDiscoveryHost({
        discoveryUrl: BOARD_URL,
        expectedEmployer: 'Jedox',
      })
    ).toBe(false);
    expect(
      isEmployerControlledDiscoveryHost({
        discoveryUrl: BOARD_URL,
        expectedEmployer: 'BeBee',
      })
    ).toBe(false);
  });
});

describe('E12.10 Direct employer discovery verification', () => {
  it('Positive 1: AGGREGATOR + employer-controlled /jobs URL → PASS / OFFICIAL', async () => {
    const store = createInMemoryRawContentStore();
    store.put('raw-e1210', {
      body: FIXTURE_DIRECT_EMPLOYER_JOB_PATH_HTML,
      contentType: 'text/html',
    });
    const adapter = createProductionVerificationAdapter({
      rawContentStore: store,
      transport: createMockHttpTransport(async () => {
        throw new Error('UNEXPECTED_NETWORK_REQUEST');
      }),
    });

    const result = await adapter.verify(
      aggregatorDiscoveryRequest(DIRECT_JOB_URL, {
        title: 'Senior Frontend Engineer',
        organization: 'Auteon',
        company: 'Auteon',
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.checks.find((c) => c.id === 'official_source')?.outcome).toBe(
      'TRUE'
    );
    expect(deriveVerificationStatus(result.result.checks)).toBe('PASS');
    expect(result.result.sourceTrust).toBe('OFFICIAL');
    expect(result.evidence.find((e) => e.type === 'OFFICIAL_SOURCE')?.sourceUrl).toBe(
      DIRECT_JOB_URL
    );

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

  it('Positive 2: employer-controlled discovery URL with JobPosting LD (no JOB_PATH) → PASS', async () => {
    const store = createInMemoryRawContentStore();
    store.put('raw-e1210', {
      body: FIXTURE_DIRECT_EMPLOYER_JOBPOSTING_LD_HTML,
      contentType: 'text/html',
    });
    const adapter = createProductionVerificationAdapter({
      rawContentStore: store,
      transport: createMockHttpTransport(async () => {
        throw new Error('UNEXPECTED_NETWORK_REQUEST');
      }),
    });

    const result = await adapter.verify(
      aggregatorDiscoveryRequest(DIRECT_LD_URL, {
        title: 'Frontend Engineer',
        organization: 'Acme Robotics',
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(deriveVerificationStatus(result.result.checks)).toBe('PASS');
    expect(result.result.sourceTrust).toBe('OFFICIAL');
  });

  it('Negative 1: aggregator /jobs page mentioning employer does NOT become official', async () => {
    const store = createInMemoryRawContentStore();
    store.put('raw-e1210', {
      body: FIXTURE_THIRD_PARTY_BOARD_WITH_EMPLOYER_HTML,
      contentType: 'text/html',
    });
    const adapter = createProductionVerificationAdapter({
      rawContentStore: store,
      transport: createMockHttpTransport(async () => {
        throw new Error('UNEXPECTED_NETWORK_REQUEST');
      }),
    });

    const result = await adapter.verify(
      aggregatorDiscoveryRequest(BOARD_URL, {
        title: 'Senior Frontend Engineer (m/f/d) - Jedox | BeBee',
        organization: 'Jedox',
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.sourceTrust).toBe('AGGREGATOR');
    expect(result.result.checks.find((c) => c.id === 'official_source')?.outcome).toBe(
      'UNKNOWN'
    );
    expect(deriveVerificationStatus(result.result.checks)).toBe('UNKNOWN');
  });

  it('Negative 2: third-party host with employer+title only → UNKNOWN', async () => {
    const store = createInMemoryRawContentStore();
    store.put('raw-e1210', {
      body: `<!DOCTYPE html><html><body>
        <h1>Senior Frontend Engineer</h1>
        <p>Siemens is hiring. Great opportunity.</p>
      </body></html>`,
      contentType: 'text/html',
    });
    const adapter = createProductionVerificationAdapter({
      rawContentStore: store,
      transport: createMockHttpTransport(async () => {
        throw new Error('UNEXPECTED_NETWORK_REQUEST');
      }),
    });

    const thirdParty = 'https://news.example/articles/siemens-hiring-frontend';
    const result = await adapter.verify(
      aggregatorDiscoveryRequest(thirdParty, {
        title: 'Senior Frontend Engineer',
        organization: 'Siemens',
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(deriveVerificationStatus(result.result.checks)).toBe('UNKNOWN');
    expect(result.result.sourceTrust).toBe('AGGREGATOR');
  });

  it('Negative 3: employer marketing/events page without JOB_PATH or JobPosting → UNKNOWN', async () => {
    const store = createInMemoryRawContentStore();
    store.put('raw-e1210', {
      body: FIXTURE_EMPLOYER_MARKETING_EVENTS_HTML,
      contentType: 'text/html',
    });
    const adapter = createProductionVerificationAdapter({
      rawContentStore: store,
      transport: createMockHttpTransport(async () => {
        throw new Error('UNEXPECTED_NETWORK_REQUEST');
      }),
    });

    const result = await adapter.verify(
      aggregatorDiscoveryRequest(EVENTS_URL, {
        title: 'Senior Frontend Engineer Job Description [+TEMPLATE 2024]',
        organization: 'Example Corp',
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.checks.find((c) => c.id === 'official_source')?.outcome).toBe(
      'UNKNOWN'
    );
    expect(deriveVerificationStatus(result.result.checks)).toBe('UNKNOWN');
  });

  it('Negative 4: discovery host does not match expected employer → UNKNOWN', async () => {
    const store = createInMemoryRawContentStore();
    store.put('raw-e1210', {
      body: FIXTURE_MISMATCHED_EMPLOYER_JOB_HTML,
      contentType: 'text/html',
    });
    const adapter = createProductionVerificationAdapter({
      rawContentStore: store,
      transport: createMockHttpTransport(async () => {
        throw new Error('UNEXPECTED_NETWORK_REQUEST');
      }),
    });

    const result = await adapter.verify(
      aggregatorDiscoveryRequest(MISMATCH_URL, {
        title: 'Frontend Engineer',
        organization: 'Acme Robotics',
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.sourceTrust).toBe('AGGREGATOR');
    expect(deriveVerificationStatus(result.result.checks)).toBe('UNKNOWN');
  });
});

describe('E12.11 employer identity → Path A', () => {
  it('title∩host brand fallback reaches official verification without pre-set organization', async () => {
    const store = createInMemoryRawContentStore();
    store.put('raw-e1210', {
      body: FIXTURE_DIRECT_EMPLOYER_JOB_PATH_HTML,
      contentType: 'text/html',
    });
    const adapter = createProductionVerificationAdapter({
      rawContentStore: store,
      transport: createMockHttpTransport(async () => {
        throw new Error('UNEXPECTED_NETWORK_REQUEST');
      }),
    });

    expect(
      resolveExpectedEmployer(
        { fields: { title: 'Open Positions at auteon - Apply now!' } },
        { discoveryUrl: DIRECT_JOB_URL }
      )
    ).toMatch(/auteon/i);

    const result = await adapter.verify(
      aggregatorDiscoveryRequest(DIRECT_JOB_URL, {
        title: 'Open Positions at auteon - Apply now!',
        // no organization / company — E12.11 title∩host fallback
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.checks.find((c) => c.id === 'official_source')?.outcome).toBe(
      'TRUE'
    );
    expect(deriveVerificationStatus(result.result.checks)).toBe('PASS');
    expect(result.result.sourceTrust).toBe('OFFICIAL');
  });

  it('title brand on host without employer token does not become official', async () => {
    const thirdParty = 'https://jobs.thirdparty.example/listing/senior-frontend';
    const store = createInMemoryRawContentStore();
    store.put('raw-e1210', {
      body: `<!DOCTYPE html><html><body>
        <h1>Senior Frontend Engineer at auteon</h1>
        <p>Auteon is hiring.</p>
      </body></html>`,
      contentType: 'text/html',
    });
    const adapter = createProductionVerificationAdapter({
      rawContentStore: store,
      transport: createMockHttpTransport(async () => {
        throw new Error('UNEXPECTED_NETWORK_REQUEST');
      }),
    });

    // No structured org; host labels are generic "jobs" + "thirdparty" — title has auteon
    // but auteon is not a host brand label → identity undefined from fallback
    expect(
      resolveExpectedEmployer(
        { fields: { title: 'Senior Frontend Engineer at auteon' } },
        { discoveryUrl: thirdParty }
      )
    ).toBeUndefined();

    const result = await adapter.verify(
      aggregatorDiscoveryRequest(thirdParty, {
        title: 'Senior Frontend Engineer at auteon',
        organization: 'Auteon', // even with org field, host lacks employer token
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      isEmployerControlledDiscoveryHost({
        discoveryUrl: thirdParty,
        expectedEmployer: 'Auteon',
      })
    ).toBe(false);
    expect(result.result.sourceTrust).toBe('AGGREGATOR');
    expect(deriveVerificationStatus(result.result.checks)).toBe('UNKNOWN');
  });
});
