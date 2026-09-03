import { describe, expect, it } from 'vitest';
import {
  jobDiscoveryStrategyV1,
  locationMatchesPreferredCountry,
  resolveJobEmployerIdentity,
  scoreJobLocation,
  scoreJobRoleRelevance,
} from './job-discovery-v1.js';
import { emptyCriteria } from '../types/criteria.js';
import type { ScoreComputationInput } from '../types/score.js';
import { fingerprintKey } from '../pipeline/candidate-factory.js';
import type { DiscoveryCandidate } from '../types/candidate.js';

/** E12.3b/E12.11/E12.12a/E12.16 — q1 is the unchanged retrieval control. */
const CANONICAL_Q1 =
  'Senior Frontend Engineer hiring vacancy Stellenangebot DE -template -"job description" -resources';

/**
 * E12.16 — q2 purpose: German-market individual vacancy / application-page bias
 * (complementary to q1), without careers/"open position"/Karriere index bait.
 */
const CANONICAL_Q2 =
  'Senior Frontend Engineer Stellenanzeige Bewerbung vacancy Germany -template -"job description" -site:linkedin.com -site:bebee.com -site:indeed.com -site:unjobs.org -site:hirify.me';

const PREFERRED_SFE = 'Senior Frontend Engineer';

function roleDim(title: string, preferredRole = PREFERRED_SFE): number {
  return scoreJobRoleRelevance(title, preferredRole);
}

function scoreTitle(
  title: string,
  opts: { location?: string | null; preferredRole?: string } = {}
) {
  const input: ScoreComputationInput = {
    candidate: {
      id: 'c1',
      runId: 'r1',
      profileId: 'p1',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      stage: 'VERIFIED',
      discoveredAt: '2026-09-02T00:00:00.000Z',
      deterministicFilterPassed: true,
      identity: { externalIds: {}, fingerprintMaterial: {} },
      extracted: {
        fields: {
          title,
          location: opts.location ?? null,
        },
      },
      evidence: [{ id: 'ev1', type: 'OFFICIAL_SOURCE', sourceUrl: 'https://example.com' }],
    } as ScoreComputationInput['candidate'],
    criteria: {
      ...emptyCriteria(),
      required: [{ key: 'country', value: 'DE' }],
      preferred: [{ key: 'role', value: opts.preferredRole ?? PREFERRED_SFE }],
    },
    verification: {
      status: 'PASS',
      sourceTrust: 'OFFICIAL',
      freshness: 'CURRENT',
      checkedAt: '2026-09-02T00:00:00.000Z',
      checks: [{ id: 'official_source', outcome: 'TRUE', required: true }],
      evidenceIds: ['ev1'],
    },
    evidence: [{ id: 'ev1', type: 'OFFICIAL_SOURCE', sourceUrl: 'https://example.com' }],
    scoredAt: '2026-09-02T00:00:00.000Z',
    strategyVersion: '1',
  };
  return jobDiscoveryStrategyV1.scoringPolicy.score(input);
}

describe('JobDiscoveryStrategyV1.buildQueries', () => {
  it('returns at most three web_search queries with stable ids (budget: exactly two)', () => {
    const queries = jobDiscoveryStrategyV1.buildQueries({
      ...emptyCriteria(),
      required: [{ key: 'country', value: 'DE' }],
      preferred: [{ key: 'role', value: 'Senior Frontend Engineer' }],
    });

    expect(queries.length).toBeLessThanOrEqual(3);
    expect(queries).toHaveLength(2);
    expect(queries.map((q) => q.id)).toEqual(['job-q1', 'job-q2']);
    expect(queries.every((q) => q.intent === 'web_search')).toBe(true);
  });

  it('keeps job-q1 exact vacancy-oriented text for the canonical DE profile', () => {
    const queries = jobDiscoveryStrategyV1.buildQueries({
      ...emptyCriteria(),
      required: [{ key: 'country', value: 'DE' }],
      preferred: [{ key: 'role', value: 'Senior Frontend Engineer' }],
    });

    const q1 = queries[0]!;
    expect(q1.id).toBe('job-q1');
    expect(q1.text).toBe(CANONICAL_Q1);
    expect(q1.text).toContain('Senior Frontend Engineer');
    expect(q1.text).toContain('DE');
    expect(q1.text).toMatch(/\bhiring\b/);
    expect(q1.text).toMatch(/\bvacancy\b/);
    expect(q1.text).not.toBe('Senior Frontend Engineer job DE');
    expect(q1.text).not.toMatch(/\bjob DE\b/);
    expect(q1.text).toContain('-template');
    expect(q1.text).toContain('-"job description"');
    expect(q1.text).toContain('-resources');
  });

  it('builds complementary job-q2 for individual DE vacancy yield (not careers indexes)', () => {
    const queries = jobDiscoveryStrategyV1.buildQueries({
      ...emptyCriteria(),
      required: [{ key: 'country', value: 'DE' }],
      preferred: [{ key: 'role', value: 'Senior Frontend Engineer' }],
    });

    const q2 = queries[1]!;
    expect(q2.id).toBe('job-q2');
    expect(q2.text).toBe(CANONICAL_Q2);
    expect(q2.text).toContain('Senior Frontend Engineer');
    expect(q2.text).toContain('Stellenanzeige');
    expect(q2.text).toContain('Bewerbung');
    expect(q2.text).toContain('vacancy');
    expect(q2.text).toContain('Germany');
    expect(q2.text).toContain('-template');
    expect(q2.text).toContain('-"job description"');
    // E12.12a index bait must not return
    expect(q2.text).not.toContain('careers');
    expect(q2.text).not.toContain('"open position"');
    expect(q2.text).not.toContain('Karriere');
    expect(q2.text).not.toMatch(/\bcompany\b/);
    // Aggregator exclusions preserved (literal text only)
    expect(q2.text).toContain('-site:linkedin.com');
    expect(q2.text).toContain('-site:bebee.com');
    expect(q2.text).toContain('-site:indeed.com');
    expect(q2.text).toContain('-site:unjobs.org');
    expect(q2.text).toContain('-site:hirify.me');
    // No employer-domain site: targeting / denylist abstraction
    expect(q2.text).not.toMatch(/-site:(siemens|bosch|auteon|palantir)\./i);
    expect(
      Object.keys(jobDiscoveryStrategyV1).some((k) =>
        /denylist|blocklist|aggregator/i.test(k)
      )
    ).toBe(false);
  });

  it('lets role and country influence both queries', () => {
    const queries = jobDiscoveryStrategyV1.buildQueries({
      ...emptyCriteria(),
      required: [{ key: 'country', value: 'AT' }],
      preferred: [{ key: 'role', value: 'Backend Engineer' }],
    });

    expect(queries).toHaveLength(2);
    expect(queries[0]?.text).toContain('Backend Engineer');
    expect(queries[0]?.text).toContain('AT');
    expect(queries[0]?.text).not.toContain('Stellenangebot');
    expect(queries[1]?.text).toContain('Backend Engineer');
    expect(queries[1]?.text).toContain('AT');
    expect(queries[1]?.text).toContain('vacancy');
    expect(queries[1]?.text).toContain('apply');
    expect(queries[1]?.text).toContain('hiring');
    expect(queries[1]?.text).not.toContain('Stellenanzeige');
    expect(queries[1]?.text).not.toContain('Bewerbung');
    expect(queries[1]?.text).not.toContain('careers');
  });

  it('preserves structural invariants on both discovery query envelopes', () => {
    const queries = jobDiscoveryStrategyV1.buildQueries({
      ...emptyCriteria(),
      required: [{ key: 'country', value: 'DE' }],
      preferred: [{ key: 'role', value: 'Senior Frontend Engineer' }],
    });

    expect(queries).toHaveLength(2);
    for (const query of queries) {
      expect(query.geography?.countryCode).toBe('DE');
      expect(query.constraints).toEqual({ employment: 'any' });
      expect(query.metadata).toEqual({ strategy: 'job-discovery', version: '1' });
      expect(query.locale).toBe('en');
      expect(query.priority).toBe(0);
      expect(query).not.toHaveProperty('search_depth');
      expect(query).not.toHaveProperty('exclude_domains');
      expect(query).not.toHaveProperty('include_domains');
      expect(query).not.toHaveProperty('max_results');
    }
  });

  it('falls back to two valid queries when role and country are absent', () => {
    const queries = jobDiscoveryStrategyV1.buildQueries(emptyCriteria());

    expect(queries).toHaveLength(2);
    expect(queries.map((q) => q.id)).toEqual(['job-q1', 'job-q2']);
    expect(queries[0]?.text).toBe('job Germany');
    expect(queries[1]?.text).toBe(
      'Stellenanzeige Bewerbung vacancy Germany -template -"job description" -site:linkedin.com -site:bebee.com -site:indeed.com -site:unjobs.org -site:hirify.me'
    );
    expect(queries.every((q) => q.intent === 'web_search')).toBe(true);
    expect(queries.every((q) => q.geography?.countryCode === 'DE')).toBe(true);
  });
});

describe('JobDiscoveryStrategyV1 role relevance scoring (E12.18)', () => {
  it('scores clear frontend title variants as strong matches', () => {
    const positives = [
      'Senior Frontend Engineer',
      'Senior Frontend Developer',
      'Frontend Engineer',
      'Frontend Developer',
      'Senior Front-end Engineer',
      'Senior Front End Developer',
    ];
    for (const title of positives) {
      expect(roleDim(title)).toBeGreaterThanOrEqual(80);
    }
  });

  it('normalizes frontend punctuation and spacing', () => {
    expect(roleDim('Front-end Engineer')).toBe(roleDim('Frontend Engineer'));
    expect(roleDim('Front End Developer')).toBe(roleDim('Frontend Developer'));
  });

  it('treats seniority-only overlap as a mismatch, not a strong match', () => {
    const seniorityOnly = roleDim('Senior Product Manager');
    const frontend = roleDim('Senior Frontend Engineer');
    expect(seniorityOnly).toBeLessThan(20);
    expect(frontend).toBeGreaterThan(seniorityOnly);
  });

  it('scores unrelated engineering titles as low / mismatch', () => {
    const negatives = [
      'Senior SAP (ABAP) Developer',
      'Senior Backend Engineer',
      'Senior Data Engineer',
      'Senior Network Engineer',
      'Senior QA Engineer',
      'Senior Embedded Engineer',
    ];
    for (const title of negatives) {
      expect(roleDim(title)).toBeLessThan(20);
    }
  });

  it('orders frontend > fullstack adjacent > unrelated', () => {
    const frontend = roleDim('Senior Frontend Engineer');
    const fullstack = roleDim('Senior Fullstack Engineer');
    const sap = roleDim('Senior SAP (ABAP) Developer');
    const backend = roleDim('Senior Backend Engineer');
    expect(frontend).toBeGreaterThan(fullstack);
    expect(fullstack).toBeGreaterThan(sap);
    expect(fullstack).toBeGreaterThan(backend);
    expect(fullstack).toBeGreaterThanOrEqual(30);
    expect(fullstack).toBeLessThan(70);
  });

  it('does not let official/current/other-location compensate a clear SAP mismatch (E12.16 loc=60)', () => {
    // Non-preferred-country location → 60. Valid DE locations score 85 and can
    // still clear minMatch with SAP role=0 (pre-existing weight residual; thresholds unchanged).
    const sap = scoreTitle('Senior SAP (ABAP) Developer', { location: 'London' });
    const role = sap.breakdown.dimensions.find((d) => d.id === 'role')!.value;
    const location = sap.breakdown.dimensions.find((d) => d.id === 'location')!.value;
    expect(role).toBeLessThan(20);
    expect(location).toBe(60);
    expect(sap.matchScore).toBeLessThan(
      jobDiscoveryStrategyV1.scoringPolicy.minMatchToNotify
    );
  });

  it('keeps strong frontend matches above the promotion match threshold when official/current', () => {
    for (const title of [
      'Senior Frontend Engineer',
      'Senior Frontend Developer',
      'Frontend Engineer',
    ]) {
      const scored = scoreTitle(title, { location: null });
      expect(scored.matchScore).toBeGreaterThanOrEqual(
        jobDiscoveryStrategyV1.scoringPolicy.minMatchToNotify
      );
      expect(scored.breakdown.dimensions.find((d) => d.id === 'role')!.value).toBeGreaterThanOrEqual(
        80
      );
    }
  });

  it('keeps unchanged scoring weights and promotion thresholds', () => {
    expect(jobDiscoveryStrategyV1.scoringPolicy.minMatchToNotify).toBe(60);
    expect(jobDiscoveryStrategyV1.scoringPolicy.minConfidenceToNotify).toBe(70);
    expect(jobDiscoveryStrategyV1.scoringPolicy.dimensions.map((d) => d.id)).toEqual([
      'role',
      'location',
      'freshness',
      'source',
    ]);
    expect(jobDiscoveryStrategyV1.scoringPolicy.dimensions.map((d) => d.weight)).toEqual([
      0.3, 0.2, 0.2, 0.3,
    ]);
  });
});

describe('H2.1 employer identity normalization', () => {
  it('maps organization into fingerprint company when company is absent', () => {
    const normalized = jobDiscoveryStrategyV1.normalize({
      discoveredUrl: 'https://employer.example/jobs/1',
      title: 'Senior Frontend Engineer',
      data: { organization: 'Example GmbH', location: 'Berlin' },
    });
    expect(normalized.identity.fingerprintMaterial.company).toBe('Example GmbH');
    expect(normalized.extracted.fields.company).toBe('Example GmbH');
    expect(normalized.extracted.fields.organization).toBe('Example GmbH');
  });

  it('preserves an explicit company over organization', () => {
    expect(
      resolveJobEmployerIdentity({
        company: 'Keep Me AG',
        organization: 'Other Org',
      })
    ).toBe('Keep Me AG');

    const normalized = jobDiscoveryStrategyV1.normalize({
      discoveredUrl: 'https://employer.example/jobs/2',
      title: 'Engineer',
      data: { company: 'Keep Me AG', organization: 'Other Org' },
    });
    expect(normalized.identity.fingerprintMaterial.company).toBe('Keep Me AG');
    expect(normalized.extracted.fields.company).toBe('Keep Me AG');
  });

  it('keeps same-title different-employer fingerprints distinct', () => {
    const fields = jobDiscoveryStrategyV1.deduplicationPolicy.fingerprintFields;
    const a = jobDiscoveryStrategyV1.normalize({
      discoveredUrl: 'https://a.example/jobs/1',
      title: 'Senior Frontend Engineer',
      data: { organization: 'Example GmbH' },
    });
    const b = jobDiscoveryStrategyV1.normalize({
      discoveredUrl: 'https://b.example/jobs/1',
      title: 'Senior Frontend Engineer',
      data: { organization: 'Other GmbH' },
    });

    const candA = {
      identity: a.identity,
      extracted: a.extracted,
    } as DiscoveryCandidate;
    const candB = {
      identity: b.identity,
      extracted: b.extracted,
    } as DiscoveryCandidate;

    expect(fingerprintKey(candA, fields)).not.toBe(fingerprintKey(candB, fields));
    expect(fingerprintKey(candA, ['title', 'company'])).not.toBe(
      fingerprintKey(candB, ['title', 'company'])
    );
  });
});

describe('H2.2 location country matching', () => {
  it('credits German country representations and cities', () => {
    expect(locationMatchesPreferredCountry('Germany', 'DE')).toBe(true);
    expect(locationMatchesPreferredCountry('Deutschland', 'DE')).toBe(true);
    expect(locationMatchesPreferredCountry('Berlin, DE', 'DE')).toBe(true);
    expect(locationMatchesPreferredCountry('Bremen', 'DE')).toBe(true);
    expect(locationMatchesPreferredCountry('Hamburg', 'DE')).toBe(true);
    expect(locationMatchesPreferredCountry('Hannover', 'DE')).toBe(true);
    expect(locationMatchesPreferredCountry('Munich', 'DE')).toBe(true);
    expect(scoreJobLocation('Germany', 'DE')).toBe(85);
    expect(scoreJobLocation('Bremen', 'DE')).toBe(85);
  });

  it('does not credit arbitrary de substrings', () => {
    expect(locationMatchesPreferredCountry('Developer – Code Studio', 'DE')).toBe(false);
    expect(locationMatchesPreferredCountry('Delaware, USA', 'DE')).toBe(false);
    expect(locationMatchesPreferredCountry('remote code', 'DE')).toBe(false);
    expect(scoreJobLocation('Developer – Code Studio', 'DE')).toBe(60);
  });

  it('keeps missing location neutral', () => {
    expect(scoreJobLocation('', 'DE')).toBe(50);
    expect(scoreJobLocation('   ', 'DE')).toBe(50);
    const scored = scoreTitle('Senior Frontend Engineer', { location: null });
    expect(scored.breakdown.dimensions.find((d) => d.id === 'location')!.value).toBe(50);
  });

  it('uses preferred country (AT) rather than hardcoding Germany', () => {
    expect(locationMatchesPreferredCountry('Vienna', 'AT')).toBe(true);
    expect(locationMatchesPreferredCountry('Berlin', 'AT')).toBe(false);
    expect(scoreJobLocation('Vienna', 'AT')).toBe(85);
    expect(scoreJobLocation('Berlin', 'AT')).toBe(60);
  });

  it('SAP mismatch with invalid de-substring location stays below minMatch', () => {
    const sap = scoreTitle('Senior SAP (ABAP) Developer', {
      location: 'Developer – Code Studio',
    });
    expect(sap.breakdown.dimensions.find((d) => d.id === 'location')!.value).toBe(60);
    expect(sap.matchScore).toBeLessThan(
      jobDiscoveryStrategyV1.scoringPolicy.minMatchToNotify
    );
  });
});
