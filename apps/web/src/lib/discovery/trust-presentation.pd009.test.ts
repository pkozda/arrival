import { describe, expect, it } from 'vitest';
import {
  buildTrustPresentation,
  isTrustPassed,
  resolveTrustSummaryKey,
} from './trust-presentation';

describe('PD-009 trust presentation', () => {
  it('A/F — Jobs PASS with official_source uses jobs summary', () => {
    const trust = buildTrustPresentation({
      strategyId: 'job-discovery',
      verification: {
        status: 'PASS',
        sourceTrust: 'OFFICIAL',
        freshness: 'CURRENT',
        verifiedAt: '2026-09-08T12:00:00.000Z',
        checks: [{ id: 'official_source', outcome: 'TRUE', required: true, detail: 'ok' }],
      },
      evidence: [{ id: 'e1', statement: 'Hiring', sourceUrl: 'https://employer.example/x' }],
    });
    expect(trust.status).toBe('passed');
    expect(trust.summaryKey).toBe('discovery.trust.summary.jobsOfficialSource');
    expect(trust.sourceTrustLabelKey).toBe('discovery.trust.sourceTrust.official');
    expect(trust.checks[0]?.detail).toBe('ok');
    expect(trust.evidenceStatements).toHaveLength(1);
    expect(isTrustPassed(trust)).toBe(true);
  });

  it('G — Giveaways PASS with free + deadline uses giveaway summary', () => {
    const trust = buildTrustPresentation({
      strategyId: 'giveaway-discovery',
      verification: {
        status: 'PASS',
        sourceTrust: 'COMMUNITY',
        checks: [
          { id: 'free_participation', outcome: 'TRUE', required: true },
          { id: 'deadline_valid', outcome: 'TRUE', required: true },
        ],
      },
    });
    expect(trust.summaryKey).toBe('discovery.trust.summary.giveawaysFreeAndDeadline');
    expect(trust.sourceTrustLabelKey).toBe('discovery.trust.sourceTrust.community');
  });

  it('B/C — FAIL is not presented as passed', () => {
    const trust = buildTrustPresentation({
      strategyId: 'job-discovery',
      verification: {
        status: 'FAIL',
        checks: [{ id: 'official_source', outcome: 'FALSE', required: true }],
      },
    });
    expect(trust.status).toBe('failed');
    expect(isTrustPassed(trust)).toBe(false);
    expect(trust.summaryKey).toBe('discovery.trust.summary.failed');
  });

  it('E — does not invent checks or official claim without data', () => {
    const trust = buildTrustPresentation({
      strategyId: 'job-discovery',
      verification: { status: 'PASS', checks: [] },
    });
    expect(trust.summaryKey).toBe('discovery.trust.summary.checksPassed');
    expect(trust.checks).toEqual([]);
    expect(trust.sourceTrustLabelKey).toBeUndefined();
  });

  it('H — summary keys stay independent of run lifecycle', () => {
    expect(
      resolveTrustSummaryKey({
        strategyKind: 'jobs',
        status: 'passed',
        checks: [{ id: 'official_source', outcome: 'TRUE', required: true }],
      })
    ).toBe('discovery.trust.summary.jobsOfficialSource');
  });
});
