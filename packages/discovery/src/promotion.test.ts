import { describe, expect, it } from 'vitest';
import { canPromote } from './invariants/promotion.js';
import { toStrategyDescriptor } from './types/strategy.js';
import { jobDiscoveryStrategyV1 } from './strategies/job-discovery-v1.js';
import type { DiscoveryCandidate } from './types/candidate.js';
import type { Score } from './types/score.js';
import type { VerificationResult } from './types/verification.js';
import { deriveVerificationStatus } from './invariants/verification-status.js';

const strategy = toStrategyDescriptor(jobDiscoveryStrategyV1);

function baseCandidate(overrides: Partial<DiscoveryCandidate> = {}): DiscoveryCandidate {
  return {
    id: 'c1',
    runId: 'r1',
    identity: {
      externalIds: { url: 'https://employer.example/jobs/1' },
      canonicalUrl: 'https://employer.example/jobs/1',
      fingerprintMaterial: { title: 'Engineer' },
    },
    source: { trust: 'AGGREGATOR', url: 'https://board.example/1' },
    discoveredAt: '2026-08-30T00:00:00.000Z',
    raw: { ref: 'raw:1' },
    extracted: { fields: { title: 'Engineer' } },
    stage: 'SCORED',
    deterministicFilterPassed: true,
    ...overrides,
  };
}

function passVerification(): VerificationResult {
  const checks = [
    { id: 'official_source', outcome: 'TRUE' as const, required: true },
  ];
  return {
    status: deriveVerificationStatus(checks),
    sourceTrust: 'OFFICIAL',
    freshness: 'CURRENT',
    checks,
    verifiedAt: '2026-08-30T00:00:00.000Z',
    evidenceIds: ['e1'],
  };
}

function goodScore(): Score {
  return {
    matchScore: 80,
    confidenceScore: 90,
    breakdown: { dimensions: [] },
    scoredAt: '2026-08-30T00:00:00.000Z',
    strategyVersion: '1',
  };
}

describe('canPromote', () => {
  it('eligible when filter passed, verification PASS, score thresholds met', () => {
    const decision = canPromote({
      candidate: baseCandidate(),
      verification: passVerification(),
      score: goodScore(),
      strategy,
    });
    expect(decision).toEqual({ eligible: true });
  });

  it('rejects when required verification UNKNOWN', () => {
    const checks = [
      { id: 'official_source', outcome: 'UNKNOWN' as const, required: true },
    ];
    const decision = canPromote({
      candidate: baseCandidate(),
      verification: {
        status: deriveVerificationStatus(checks),
        sourceTrust: 'AGGREGATOR',
        freshness: 'UNKNOWN',
        checks,
        verifiedAt: '2026-08-30T00:00:00.000Z',
        evidenceIds: [],
      },
      score: goodScore(),
      strategy,
    });
    expect(decision.eligible).toBe(false);
    if (!decision.eligible) {
      expect(decision.reasons).toContain('VERIFICATION_UNKNOWN');
    }
  });

  it('rejects when required verification FAIL', () => {
    const checks = [
      { id: 'official_source', outcome: 'FALSE' as const, required: true },
    ];
    const decision = canPromote({
      candidate: baseCandidate(),
      verification: {
        status: deriveVerificationStatus(checks),
        sourceTrust: 'AGGREGATOR',
        freshness: 'STALE',
        checks,
        verifiedAt: '2026-08-30T00:00:00.000Z',
        evidenceIds: [],
      },
      score: goodScore(),
      strategy,
    });
    expect(decision.eligible).toBe(false);
    if (!decision.eligible) {
      expect(decision.reasons).toContain('VERIFICATION_FAIL');
    }
  });

  it('never promotes rejected candidates', () => {
    const decision = canPromote({
      candidate: baseCandidate({
        stage: 'REJECTED',
        rejection: {
          reasonCode: 'REJECTED_EXCLUDED_ROLE',
          atStage: 'FILTERED',
          at: '2026-08-30T00:00:00.000Z',
        },
      }),
      verification: passVerification(),
      score: goodScore(),
      strategy,
    });
    expect(decision.eligible).toBe(false);
    if (!decision.eligible) {
      expect(decision.reasons).toContain('REJECTED_CANDIDATE');
    }
  });

  it('rejects missing verification', () => {
    const decision = canPromote({
      candidate: baseCandidate(),
      verification: null,
      score: goodScore(),
      strategy,
    });
    expect(decision.eligible).toBe(false);
    if (!decision.eligible) {
      expect(decision.reasons).toContain('MISSING_VERIFICATION');
    }
  });

  it('rejects insufficient confidence', () => {
    const decision = canPromote({
      candidate: baseCandidate(),
      verification: passVerification(),
      score: { ...goodScore(), confidenceScore: 10 },
      strategy,
    });
    expect(decision.eligible).toBe(false);
    if (!decision.eligible) {
      expect(decision.reasons).toContain('LOW_CONFIDENCE');
    }
  });

  it('rejects when deterministic filter not passed', () => {
    const decision = canPromote({
      candidate: baseCandidate({ deterministicFilterPassed: false }),
      verification: passVerification(),
      score: goodScore(),
      strategy,
    });
    expect(decision.eligible).toBe(false);
    if (!decision.eligible) {
      expect(decision.reasons).toContain('FILTER_NOT_PASSED');
    }
  });
});
