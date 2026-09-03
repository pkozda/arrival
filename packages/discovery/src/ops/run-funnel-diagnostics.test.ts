import { describe, expect, it } from 'vitest';
import type { PipelineExecuteResult } from '../pipeline/execute.js';
import type { DiscoveryCandidate } from '../types/candidate.js';
import { rawToCandidate } from '../pipeline/candidate-factory.js';
import {
  buildDiscoveryRunFunnelDiagnostics,
  MAX_FUNNEL_CANDIDATES,
  parseDiscoveryRunFunnelDiagnostics,
  serializeDiscoveryRunFunnelDiagnostics,
} from './run-funnel-diagnostics.js';

const RUN_ID = 'run-funnel-test';
const DISCOVERED_AT = '2026-09-02T14:00:00.000Z';

function emptyResult(
  overrides: Partial<PipelineExecuteResult> = {}
): PipelineExecuteResult {
  return {
    run: {
      id: RUN_ID,
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      criteriaSnapshot: { required: [], preferred: [], excluded: [], flexible: [] },
      startedAt: DISCOVERED_AT,
      status: 'SUCCESS',
      stats: {
        candidatesFound: 0,
        candidatesRejected: 0,
        candidatesVerified: 0,
        resultsCreated: 0,
        resultsUpdated: 0,
      },
    },
    batch: { active: [], rejected: [] },
    stageOrder: ['build_queries', 'search'],
    stageDiagnostics: [],
    queries: [],
    ...overrides,
  };
}

function discoveredCandidate(index: number, url: string, title: string): DiscoveryCandidate {
  return rawToCandidate(
    {
      discoveredUrl: url,
      title,
      source: { trust: 'AGGREGATOR', label: 'tavily-search' },
    },
    RUN_ID,
    index,
    DISCOVERED_AT
  );
}

describe('buildDiscoveryRunFunnelDiagnostics', () => {
  it('projects an empty zero-hit run', () => {
    const result = emptyResult({
      queries: [{ id: 'job-q1', intent: 'web_search', text: 'engineer hiring DE' }],
      stageDiagnostics: [
        {
          runId: RUN_ID,
          stage: 'search',
          durationMs: 1,
          outcome: 'ok',
          message: 'Discovered 0 candidate(s)',
        },
      ],
    });

    const funnel = buildDiscoveryRunFunnelDiagnostics(result);

    expect(funnel.queries).toEqual([{ id: 'job-q1', text: 'engineer hiring DE' }]);
    expect(funnel.stats.candidatesFound).toBe(0);
    expect(funnel.rejected).toEqual([]);
    expect(funnel.discovered).toEqual([]);
    expect(funnel.promoted).toEqual({
      created: 0,
      updated: 0,
      denied: 0,
      unchanged: 0,
    });
    expect(funnel.partialFailureCount).toBe(0);
    expect(funnel.status).toBe('SUCCESS');
  });

  it('projects rejected candidates with existing reason codes', () => {
    const candidate = discoveredCandidate(
      0,
      'https://resources.example/job-description',
      'Role Job Description'
    );
    const result = emptyResult({
      run: {
        ...emptyResult().run,
        stats: {
          candidatesFound: 1,
          candidatesRejected: 1,
          candidatesVerified: 0,
          resultsCreated: 0,
          resultsUpdated: 0,
        },
      },
      batch: {
        active: [],
        rejected: [
          {
            candidate: {
              ...candidate,
              stage: 'REJECTED',
              rejection: {
                reasonCode: 'REJECTED_VERIFICATION_FAIL',
                atStage: 'VERIFYING',
                at: DISCOVERED_AT,
                message: 'Verification FAIL',
              },
            },
            rejection: {
              reasonCode: 'REJECTED_VERIFICATION_FAIL',
              atStage: 'VERIFYING',
              at: DISCOVERED_AT,
              message: 'Verification FAIL',
            },
          },
        ],
      },
    });

    const funnel = buildDiscoveryRunFunnelDiagnostics(result);

    expect(funnel.rejected).toHaveLength(1);
    expect(funnel.rejected[0]).toEqual({
      candidateId: `${RUN_ID}:cand:0`,
      url: 'https://resources.example/job-description',
      title: 'Role Job Description',
      atStage: 'VERIFYING',
      reasonCode: 'REJECTED_VERIFICATION_FAIL',
      message: 'Verification FAIL',
    });
  });

  it('projects promotion stats from structured run stats and persist outcomes', () => {
    const promoted = discoveredCandidate(0, 'https://employer.example/jobs/1', 'Engineer');
    const denied = discoveredCandidate(1, 'https://other.example/jobs/2', 'Other Role');
    const result = emptyResult({
      run: {
        ...emptyResult().run,
        status: 'PARTIAL_SUCCESS',
        stats: {
          candidatesFound: 2,
          candidatesRejected: 0,
          candidatesVerified: 2,
          resultsCreated: 1,
          resultsUpdated: 0,
        },
        diagnostics: [
          {
            code: 'PARTIAL_ADAPTER_FAILURE',
            message: 'ai:timeout',
            at: DISCOVERED_AT,
          },
        ],
      },
      batch: {
        active: [
          { ...promoted, stage: 'PROMOTED', persistOutcome: 'CREATED' },
          { ...denied, stage: 'SCORED', persistOutcome: 'DENIED' },
        ],
        rejected: [],
      },
      stageDiagnostics: [
        {
          runId: RUN_ID,
          stage: 'persist_promote',
          durationMs: 2,
          outcome: 'partial',
          message: 'Persist complete; created=1 updated=0 unchanged=0 denied=1',
        },
      ],
    });

    const funnel = buildDiscoveryRunFunnelDiagnostics(result);

    expect(funnel.stats.candidatesFound).toBe(2);
    expect(funnel.stats.candidatesVerified).toBe(2);
    expect(funnel.stats.resultsCreated).toBe(1);
    expect(funnel.stats.resultsUpdated).toBe(0);
    expect(funnel.promoted).toEqual({
      created: 1,
      updated: 0,
      denied: 1,
      unchanged: 0,
    });
    expect(funnel.partialFailureCount).toBe(1);
    expect(funnel.stages).toEqual([
      {
        stage: 'persist_promote',
        outcome: 'partial',
        message: 'Persist complete; created=1 updated=0 unchanged=0 denied=1',
      },
    ]);
  });

  it('projects stage summaries without per-candidate diagnostics', () => {
    const result = emptyResult({
      stageDiagnostics: [
        {
          runId: RUN_ID,
          stage: 'search',
          durationMs: 3,
          outcome: 'ok',
          message: 'Discovered 1 candidate(s)',
        },
        {
          runId: RUN_ID,
          stage: 'collect',
          candidateId: `${RUN_ID}:cand:0`,
          durationMs: 1,
          outcome: 'ok',
          message: 'Fetched https://employer.example/jobs/1',
        },
        {
          runId: RUN_ID,
          stage: 'verify',
          durationMs: 4,
          outcome: 'ok',
          message: 'Verify complete; 1 PASS, 0 rejected',
        },
      ],
    });

    const funnel = buildDiscoveryRunFunnelDiagnostics(result);

    expect(funnel.stages).toEqual([
      {
        stage: 'search',
        outcome: 'ok',
        message: 'Discovered 1 candidate(s)',
      },
      {
        stage: 'verify',
        outcome: 'ok',
        message: 'Verify complete; 1 PASS, 0 rejected',
      },
    ]);
  });

  it('caps discovered and rejected lists deterministically', () => {
    const rejected = Array.from({ length: MAX_FUNNEL_CANDIDATES + 5 }, (_, i) => {
      const candidate = discoveredCandidate(
        i,
        `https://example.com/jobs/${i}`,
        `Role ${i}`
      );
      return {
        candidate: {
          ...candidate,
          stage: 'REJECTED' as const,
          rejection: {
            reasonCode: 'REJECTED_DUPLICATE' as const,
            atStage: 'DEDUPLICATED' as const,
            at: DISCOVERED_AT,
          },
        },
        rejection: {
          reasonCode: 'REJECTED_DUPLICATE' as const,
          atStage: 'DEDUPLICATED' as const,
          at: DISCOVERED_AT,
        },
      };
    });

    const funnel = buildDiscoveryRunFunnelDiagnostics(
      emptyResult({
        run: {
          ...emptyResult().run,
          stats: {
            candidatesFound: rejected.length,
            candidatesRejected: rejected.length,
            candidatesVerified: 0,
            resultsCreated: 0,
            resultsUpdated: 0,
          },
        },
        batch: { active: [], rejected },
      })
    );

    expect(funnel.discovered).toHaveLength(MAX_FUNNEL_CANDIDATES);
    expect(funnel.rejected).toHaveLength(MAX_FUNNEL_CANDIDATES);
    expect(funnel.discovered[0]?.candidateId).toBe(`${RUN_ID}:cand:0`);
    expect(funnel.rejected[0]?.candidateId).toBe(`${RUN_ID}:cand:0`);
    expect(funnel.discovered[MAX_FUNNEL_CANDIDATES - 1]?.candidateId).toBe(
      `${RUN_ID}:cand:${MAX_FUNNEL_CANDIDATES - 1}`
    );
  });

  it('round-trips through metadata serialization', () => {
    const funnel = buildDiscoveryRunFunnelDiagnostics(
      emptyResult({
        queries: [{ id: 'q1', intent: 'web_search', text: 'test' }],
      })
    );
    const parsed = parseDiscoveryRunFunnelDiagnostics(
      serializeDiscoveryRunFunnelDiagnostics(funnel)
    );
    expect(parsed).toEqual(funnel);
  });
});
