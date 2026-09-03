import { describe, expect, it } from 'vitest';
import {
  assessIndividualVacancyPage,
  createInMemoryRawContentStore,
  createMockHttpTransport,
  createProductionVerificationAdapter,
  deriveVerificationStatus,
  employerAttributionMatches,
  jobDiscoveryStrategyV1,
  type DiscoveryRun,
  type VerificationRequest,
} from '../../index.js';
import {
  FIXTURE_ATS_INDIVIDUAL_VACANCY_HTML,
  FIXTURE_CAREERS_OPEN_POSITIONS_INDEX_HTML,
  FIXTURE_CAREERS_LISTING_WITH_JOBPOSTING_LD_HTML,
  FIXTURE_DIRECT_EMPLOYER_JOB_PATH_HTML,
  FIXTURE_DIRECT_EMPLOYER_JOBPOSTING_LD_HTML,
  FIXTURE_EMPLOYER_MARKETING_EVENTS_HTML,
  FIXTURE_GENERIC_CAREERS_LANDING_HTML,
  FIXTURE_GENERIC_JOBS_INDEX_HTML,
  FIXTURE_INDIVIDUAL_VACANCY_UNDER_CAREERS_HTML,
  FIXTURE_JOB_SEARCH_RESULTS_HTML,
  FIXTURE_OFFICIAL_EMPLOYER_JOB_HTML,
} from './fixtures/e12-2-official-employer.js';

function runStub(): DiscoveryRun {
  return {
    id: 'run-e1214',
    profileId: 'profile-job',
    strategyId: 'job-discovery',
    strategyVersion: '1',
    criteriaSnapshot: {
      required: [],
      preferred: [],
      excluded: [],
      flexible: [],
    },
    startedAt: '2026-09-02T18:00:00.000Z',
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
    candidateId: 'c-e1214',
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
      ref: 'raw-e1214',
      sourceUrl: url,
      capturedAt: '2026-09-02T18:00:00.000Z',
    },
    extracted: { fields },
    verificationPolicy: jobDiscoveryStrategyV1.verificationPolicy,
    freshnessPolicy: jobDiscoveryStrategyV1.freshnessPolicy,
    run: runStub(),
    now: () => '2026-09-02T18:00:00.000Z',
    ...overrides,
  };
}

async function verifyStored(url: string, body: string, fields: Record<string, string | null>) {
  const store = createInMemoryRawContentStore();
  store.put('raw-e1214', { body, contentType: 'text/html' });
  const adapter = createProductionVerificationAdapter({
    rawContentStore: store,
    transport: createMockHttpTransport(async () => {
      throw new Error('UNEXPECTED_NETWORK_REQUEST');
    }),
  });
  return adapter.verify(aggregatorDiscoveryRequest(url, fields));
}

describe('E12.14 individual vacancy semantics', () => {
  it('rejects Palantir-style open-positions index', () => {
    const result = employerAttributionMatches({
      expectedEmployer: 'Example Corp',
      pageUrl: 'https://www.example-corp.example/careers/open-positions',
      pageBody: FIXTURE_CAREERS_OPEN_POSITIONS_INDEX_HTML,
      expectedTitle: 'Careers | Example Corp',
    });
    expect(result.ok).toBe(false);
    expect(result.detail).toMatch(/listing|vacancy/i);
  });

  it('rejects generic careers landing and jobs index and search results', () => {
    expect(
      employerAttributionMatches({
        expectedEmployer: 'Example Corp',
        pageUrl: 'https://www.example-corp.example/careers',
        pageBody: FIXTURE_GENERIC_CAREERS_LANDING_HTML,
        expectedTitle: 'Careers — Example Corp',
      }).ok
    ).toBe(false);

    expect(
      employerAttributionMatches({
        expectedEmployer: 'Example Corp',
        pageUrl: 'https://www.example-corp.example/jobs',
        pageBody: FIXTURE_GENERIC_JOBS_INDEX_HTML,
        expectedTitle: 'All Jobs — Example Corp',
      }).ok
    ).toBe(false);

    expect(
      employerAttributionMatches({
        expectedEmployer: 'Example Corp',
        pageUrl: 'https://www.example-corp.example/jobs/results',
        pageBody: FIXTURE_JOB_SEARCH_RESULTS_HTML,
        expectedTitle: 'Search Jobs — Example Corp',
      }).ok
    ).toBe(false);
  });

  it('accepts Auteon-style individual vacancy via JOB_PATH + content', () => {
    const result = employerAttributionMatches({
      expectedEmployer: 'Auteon',
      pageUrl: 'https://www.auteon.example/jobs/senior-frontend-engineer',
      pageBody: FIXTURE_DIRECT_EMPLOYER_JOB_PATH_HTML,
      expectedTitle: 'Senior Frontend Engineer — Auteon',
    });
    expect(result.ok).toBe(true);
  });

  it('accepts JobPosting JSON-LD even without vacancy path slug', () => {
    const result = employerAttributionMatches({
      expectedEmployer: 'Acme Robotics',
      pageUrl: 'https://www.acme-robotics.example/',
      pageBody: FIXTURE_OFFICIAL_EMPLOYER_JOB_HTML,
      expectedTitle: 'Unrelated Marketing Page Title',
    });
    expect(result.ok).toBe(true);
  });

  it('rejects listing/index pages even when JobPosting JSON-LD is present (H2.3)', () => {
    const withLd = assessIndividualVacancyPage({
      pageUrl: 'https://www.example-corp.example/careers/open-positions',
      pageBody: FIXTURE_CAREERS_LISTING_WITH_JOBPOSTING_LD_HTML,
      expectedTitle: 'Careers | Example Corp',
    });
    expect(withLd.ok).toBe(false);
    expect(withLd.detail).toMatch(/listing|vacancy/i);

    expect(
      employerAttributionMatches({
        expectedEmployer: 'Example Corp',
        pageUrl: 'https://www.example-corp.example/careers/open-positions',
        pageBody: FIXTURE_CAREERS_LISTING_WITH_JOBPOSTING_LD_HTML,
        expectedTitle: 'Careers | Example Corp',
      }).ok
    ).toBe(false);

    expect(
      assessIndividualVacancyPage({
        pageUrl: 'https://www.example-corp.example/jobs',
        pageBody: FIXTURE_GENERIC_JOBS_INDEX_HTML,
        expectedTitle: 'All Jobs — Example Corp',
      }).ok
    ).toBe(false);
  });

  it('accepts individual vacancy under /careers/...', () => {
    const result = employerAttributionMatches({
      expectedEmployer: 'Example Corp',
      pageUrl: 'https://www.example-corp.example/careers/senior-frontend-engineer',
      pageBody: FIXTURE_INDIVIDUAL_VACANCY_UNDER_CAREERS_HTML,
      expectedTitle: 'Senior Frontend Engineer — Example Corp',
    });
    expect(result.ok).toBe(true);
  });

  it('accepts ATS individual vacancy with nested path', () => {
    expect(
      assessIndividualVacancyPage({
        pageUrl:
          'https://msgservices.example-ats.example/de/jobs/91/senior-frontend-engineer-application-support',
        pageBody: FIXTURE_ATS_INDIVIDUAL_VACANCY_HTML,
        expectedTitle: 'Senior Frontend Engineer (m/f/d)',
      }).ok
    ).toBe(true);

    expect(
      employerAttributionMatches({
        expectedEmployer: 'Msg Services',
        pageUrl:
          'https://msgservices.example-ats.example/de/jobs/91/senior-frontend-engineer-application-support',
        pageBody: FIXTURE_ATS_INDIVIDUAL_VACANCY_HTML,
        expectedTitle: 'Senior Frontend Engineer (m/f/d)',
      }).ok
    ).toBe(true);
  });

  it('E12.5 marketing/events regression still rejects', () => {
    const bad = employerAttributionMatches({
      expectedEmployer: 'Example Corp',
      pageUrl: 'https://events.example-corp.example/',
      pageBody: FIXTURE_EMPLOYER_MARKETING_EVENTS_HTML,
      expectedTitle: 'Senior Frontend Engineer Job Description [+TEMPLATE 2024]',
    });
    expect(bad.ok).toBe(false);
    expect(bad.detail).toContain('not recognizably a job posting');
  });

  it('adapter: open-positions index stays UNKNOWN; Auteon and JobPosting stay PASS', async () => {
    const rejected = await verifyStored(
      'https://www.example-corp.example/careers/open-positions',
      FIXTURE_CAREERS_OPEN_POSITIONS_INDEX_HTML,
      { title: 'Careers | Example Corp', organization: 'Example Corp' }
    );
    expect(rejected.ok).toBe(true);
    if (!rejected.ok) return;
    expect(deriveVerificationStatus(rejected.result.checks)).toBe('UNKNOWN');

    const auteon = await verifyStored(
      'https://www.auteon.example/jobs/senior-frontend-engineer',
      FIXTURE_DIRECT_EMPLOYER_JOB_PATH_HTML,
      { title: 'Senior Frontend Engineer', organization: 'Auteon', company: 'Auteon' }
    );
    expect(auteon.ok).toBe(true);
    if (!auteon.ok) return;
    expect(deriveVerificationStatus(auteon.result.checks)).toBe('PASS');
    expect(auteon.result.sourceTrust).toBe('OFFICIAL');

    const ld = await verifyStored(
      'https://www.acme-robotics.example/openings/frontend',
      FIXTURE_DIRECT_EMPLOYER_JOBPOSTING_LD_HTML,
      { title: 'Frontend Engineer', organization: 'Acme Robotics' }
    );
    expect(ld.ok).toBe(true);
    if (!ld.ok) return;
    expect(deriveVerificationStatus(ld.result.checks)).toBe('PASS');
  });
});
