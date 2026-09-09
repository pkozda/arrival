import { describe, expect, it } from 'vitest';
import {
  buildOpportunityPresentation,
  formatMatchPercent,
  isActiveRunPresentation,
  isErrorPresentation,
  isNoResultsPresentation,
  orderOpportunitiesForDisplay,
  resolveOpportunitySourceAction,
  resolveOpportunityUrl,
  salaryFromResult,
} from './opportunity-presentation';
import type { DiscoveryResultUserView } from './types';

function sampleResult(
  overrides: Partial<DiscoveryResultUserView> = {}
): DiscoveryResultUserView {
  return {
    id: 'r1',
    profileId: 'p1',
    strategyId: 'job-discovery',
    strategyVersion: '1',
    canonicalPresentation: {
      title: 'Frontend Engineer',
      summary: 'Build UI',
      primaryUrl: 'https://employer.example/jobs/1',
    },
    source: { trust: 'OFFICIAL', url: 'https://employer.example/jobs/1' },
    verification: { status: 'PASS', sourceTrust: 'OFFICIAL' },
    evidence: [],
    score: {
      matchScore: 82,
      confidenceScore: 70,
      scoredAt: '2026-09-08T12:00:00.000Z',
    },
    lifecycle: 'ACTIVE',
    userState: 'NEW',
    firstSeenAt: '2026-09-08T12:00:00.000Z',
    lastVerifiedAt: '2026-09-08T12:00:00.000Z',
    lastChangedAt: '2026-09-08T12:00:00.000Z',
    promotedFromRunId: 'run-1',
    identity: {
      fingerprintMaterial: { company: 'Acme GmbH', title: 'Frontend Engineer' },
    },
    materialFields: { salary: '60000' },
    changeMetadata: { inferredNovelty: 'NEW', changedFields: [] },
    ...overrides,
  };
}

describe('PD-008 opportunity presentation', () => {
  it('A/G — PASS + URL yields external open action', () => {
    const action = resolveOpportunitySourceAction(sampleResult());
    expect(action).toEqual({
      kind: 'external_open',
      href: 'https://employer.example/jobs/1',
    });
  });

  it('G — FAIL verification is not actionable even with URL', () => {
    expect(
      resolveOpportunitySourceAction(
        sampleResult({ verification: { status: 'FAIL' } })
      )
    ).toBeNull();
  });

  it('H — omits salary and summary when absent', () => {
    const view = buildOpportunityPresentation(
      sampleResult({
        materialFields: {},
        canonicalPresentation: { title: 'Role only' },
      })
    );
    expect(view.salary).toBeUndefined();
    expect(view.summary).toBeUndefined();
    expect(view.title).toBe('Role only');
  });

  it('B — fromCurrentRun ties result to run id', () => {
    const current = buildOpportunityPresentation(sampleResult(), {
      currentRunId: 'run-1',
    });
    const prior = buildOpportunityPresentation(sampleResult(), {
      currentRunId: 'run-other',
    });
    expect(current.fromCurrentRun).toBe(true);
    expect(prior.fromCurrentRun).toBe(false);
  });

  it('C/D — NO_RESULTS vs ERROR vs active stay distinct', () => {
    expect(isNoResultsPresentation('NO_RESULTS')).toBe(true);
    expect(isNoResultsPresentation('ERROR')).toBe(false);
    expect(isErrorPresentation('ERROR')).toBe(true);
    expect(isActiveRunPresentation('RUNNING')).toBe(true);
    expect(isActiveRunPresentation('SUCCESS')).toBe(false);
  });

  it('formats 0–100 scores without multiplying by 100 again', () => {
    expect(formatMatchPercent(82)).toBe('82%');
    expect(formatMatchPercent(0.82)).toBe('82%');
  });

  it('H — does not invent URLs', () => {
    expect(
      resolveOpportunityUrl(
        sampleResult({
          canonicalPresentation: { title: 'No url' },
          source: { trust: 'UNKNOWN' },
          identity: {},
        })
      )
    ).toBeNull();
  });

  it('salaryFromResult only when present', () => {
    expect(salaryFromResult(sampleResult())).toBe('60000');
    expect(salaryFromResult({})).toBeNull();
  });

  it('orders current-run first without inventing rank scores', () => {
    const ordered = orderOpportunitiesForDisplay([
      { id: 'a', fromCurrentRun: false },
      { id: 'b', fromCurrentRun: true },
      { id: 'c', fromCurrentRun: false },
    ]);
    expect(ordered.map((x) => x.id)).toEqual(['b', 'a', 'c']);
  });
});
