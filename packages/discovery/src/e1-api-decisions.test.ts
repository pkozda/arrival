import { describe, expect, it } from 'vitest';
import { jobDiscoveryStrategyV1 } from './strategies/job-discovery-v1.js';
import { giveawayDiscoveryStrategyV1 } from './strategies/giveaway-discovery-v1.js';
import { emptyCriteria, type DiscoveryCriteria } from './types/criteria.js';
import type { DiscoveryQuery } from './types/query.js';
import type { NormalizedCandidateData, RawCandidatePayload } from './types/candidate.js';
import type { Score } from './types/score.js';

describe('E1 API decisions — strategy surface', () => {
  it('Decision 1: strategies accept shared DiscoveryCriteria envelope', () => {
    const criteria: DiscoveryCriteria = {
      ...emptyCriteria(),
      required: [{ key: 'country', value: 'DE' }],
      preferred: [{ key: 'role', value: 'Frontend Engineer' }],
      excluded: [{ key: 'role', value: 'Team Lead' }],
    };
    expect(jobDiscoveryStrategyV1.validateCriteria(criteria)).toEqual({ ok: true });
  });

  it('Decision 2: rank() is on scoringPolicy and is pure/strategy-owned', () => {
    const score: Score = {
      matchScore: 87,
      confidenceScore: 100,
      breakdown: { dimensions: [] },
      scoredAt: '2026-08-30T00:00:00.000Z',
      strategyVersion: '1',
    };
    const jobRank = jobDiscoveryStrategyV1.scoringPolicy.rank(score, {});
    const giveawayRank = giveawayDiscoveryStrategyV1.scoringPolicy.rank(score, {
      opportunityHints: { deadlineHours: 12 },
    });
    expect(typeof jobRank).toBe('number');
    expect(typeof giveawayRank).toBe('number');
    // Same headline scores can rank differently across strategies / hints
    expect(giveawayRank).not.toBe(jobRank);
  });

  it('Decision 3: DiscoveryQuery has no vendor/HTTP fields', () => {
    const criteria: DiscoveryCriteria = {
      ...emptyCriteria(),
      required: [{ key: 'country', value: 'DE' }],
    };
    const queries: DiscoveryQuery[] = jobDiscoveryStrategyV1.buildQueries(criteria);
    expect(queries.length).toBeGreaterThan(0);
    for (const q of queries) {
      expect(q).toHaveProperty('intent');
      expect(q).toHaveProperty('text');
      expect(q).not.toHaveProperty('google');
      expect(q).not.toHaveProperty('serp');
      expect(q).not.toHaveProperty('headers');
      expect(q).not.toHaveProperty('axios');
      expect(typeof q.text).toBe('string');
    }
  });

  it('Decision 4: normalize returns NormalizedCandidateData patch, not DiscoveryCandidate', () => {
    const raw: RawCandidatePayload = {
      discoveredUrl: 'https://employer.example/jobs/1',
      title: 'Senior Frontend',
      source: { trust: 'AGGREGATOR' },
      data: { company: 'Acme' },
    };
    const normalized: NormalizedCandidateData = jobDiscoveryStrategyV1.normalize(raw, {
      runId: 'r1',
      discoveredAt: '2026-08-30T00:00:00.000Z',
    });
    expect(normalized.identity.canonicalUrl).toBe(raw.discoveredUrl);
    expect(normalized.extracted.fields.title).toBe('Senior Frontend');
    // Must not look like a lifecycle candidate
    expect(normalized).not.toHaveProperty('runId');
    expect(normalized).not.toHaveProperty('stage');
    expect(normalized).not.toHaveProperty('deterministicFilterPassed');
  });

  it('giveaway filter rejects purchaseRequired=true as hard rejection', () => {
    const normalized = giveawayDiscoveryStrategyV1.normalize(
      {
        title: 'Win a car',
        data: { purchaseRequired: true },
      },
      { runId: 'r1', discoveredAt: '2026-08-30T00:00:00.000Z' }
    );
    const result = giveawayDiscoveryStrategyV1.filter(normalized, {
      ...emptyCriteria(),
      required: [
        { key: 'country', value: 'DE' },
        { key: 'freeParticipation', value: true },
      ],
    });
    expect(result).toEqual({
      action: 'REJECT',
      reasonCode: 'REJECTED_PURCHASE_REQUIRED',
    });
  });
});
