import { describe, expect, it } from 'vitest';
import { EMPTY_ECONOMIC_REALITY_CLIENT_STATE } from '@/lib/economic-reality/economic-reality-client-state';
import {
  buildAnnotatedSyncPlan,
  buildSyncPlan,
  DOMAIN_SYNC_GRAPH,
  syncPlanDomains,
} from './domainSyncGraph';
import {
  createFailedDomainResult,
  createSkippedDomainResult,
  createSuccessfulDomainResult,
  evaluateConsistencyPolicy,
  mergeSuccessfulDomainStates,
  resolveDomainExecutionDecision,
  type DomainSyncResults,
} from './domainSyncExecution';

describe('domainSyncExecution', () => {
  it('blocks dependency targets when upstream domain fails', () => {
    const completed = new Map([
      ['LIFE_EVENT', createFailedDomainResult('LIFE_EVENT', 'life event unavailable')],
    ] as const);

    const decision = resolveDomainExecutionDecision('ECONOMIC', DOMAIN_SYNC_GRAPH, completed);

    expect(decision).toEqual({
      execute: false,
      skipReason: 'dependency_failed',
      error: 'Blocked ECONOMIC because LIFE_EVENT failed',
    });
  });

  it('uses cached snapshot fallback when recompute upstream fails', () => {
    const completed = new Map([
      ['ECONOMIC', createFailedDomainResult('ECONOMIC', 'economic unavailable')],
    ] as const);

    const decision = resolveDomainExecutionDecision('SNAPSHOT', DOMAIN_SYNC_GRAPH, completed);

    expect(decision).toEqual({
      execute: false,
      skipReason: 'recompute_fallback_cached',
      error: 'Skipped SNAPSHOT recompute because ECONOMIC failed',
    });
  });

  it('allows cascade targets to execute after upstream failure', () => {
    const completed = new Map([
      ['PROFILE', createFailedDomainResult('PROFILE', 'profile unavailable')],
    ] as const);

    const decision = resolveDomainExecutionDecision('LIFE_EVENT', DOMAIN_SYNC_GRAPH, completed);

    expect(decision).toEqual({ execute: true });
  });

  it('marks policy degraded when any domain fails or is blocked', () => {
    const plan = buildAnnotatedSyncPlan({ type: 'SESSION_SYNC_REQUESTED', scope: 'FULL' });
    const results: DomainSyncResults = {
      plan,
      results: [
        createFailedDomainResult('PROFILE', 'profile unavailable'),
        createSkippedDomainResult(
          'LIFE_EVENT',
          'dependency_failed',
          'Blocked LIFE_EVENT because PROFILE failed'
        ),
      ],
    };

    expect(evaluateConsistencyPolicy(results)).toBe('degraded');
  });

  it('treats profile_not_ready skips as non-failure for policy evaluation', () => {
    const plan = buildAnnotatedSyncPlan({ type: 'SESSION_SYNC_REQUESTED', scope: 'FULL' });
    const results: DomainSyncResults = {
      plan,
      results: [
        createSkippedDomainResult(
          'LIFE_EVENT',
          'profile_not_ready',
          'Skipped LIFE_EVENT until UserContext profile is available'
        ),
        createSkippedDomainResult(
          'ECONOMIC',
          'profile_not_ready',
          'Skipped ECONOMIC until UserContext profile is available'
        ),
      ],
    };

    expect(evaluateConsistencyPolicy(results)).toBe('satisfied');
  });

  it('treats cached snapshot skip as non-failure for policy evaluation', () => {
    const plan = buildAnnotatedSyncPlan({
      type: 'ECONOMIC_ACTION_EXECUTED',
      actionId: 'a1',
      previousDeterministicHash: 'hash-a',
      deterministicHash: 'hash-b',
      planChanged: true,
    });

    const results: DomainSyncResults = {
      plan,
      results: [
        {
          domain: 'SNAPSHOT',
          status: 'skipped',
          skipped: true,
          skipReason: 'recompute_fallback_cached',
          usedCachedSnapshot: true,
          error: 'Skipped SNAPSHOT recompute because ECONOMIC failed',
          domains: { SNAPSHOT: { uiSnapshot: null } },
        },
      ],
    };

    expect(evaluateConsistencyPolicy(results)).toBe('satisfied');
  });

  it('annotated plan preserves domain ordering from buildSyncPlan', () => {
    const annotated = buildAnnotatedSyncPlan({
      type: 'PROFILE_MUTATED',
      revision: 1,
      userContext: { schemaVersion: '1.0.0', profile: { language: 'en' } },
    });

    expect(syncPlanDomains(annotated)).toEqual(
      buildSyncPlan({
        type: 'PROFILE_MUTATED',
        revision: 1,
        userContext: { schemaVersion: '1.0.0', profile: { language: 'en' } },
      })
    );

    expect(annotated[0]).toMatchObject({ domain: 'PROFILE', reasons: ['cascade'] });
    expect(annotated.find((step) => step.domain === 'ECONOMIC')?.reasons).toContain('dependency');
    expect(annotated.find((step) => step.domain === 'SNAPSHOT')?.reasons).toContain('recompute');
  });

  describe('mergeSuccessfulDomainStates', () => {
    const plan = buildAnnotatedSyncPlan({ type: 'SESSION_SYNC_REQUESTED', scope: 'FULL' });

    it('merges multiple successful domains into one DomainStateMap', () => {
      const results: DomainSyncResults = {
        plan,
        results: [
          createSuccessfulDomainResult('PROFILE', {
            PROFILE: { userContext: null, profileInsights: null },
          }),
          createSuccessfulDomainResult('ECONOMIC', {
            ECONOMIC: {
              economicPlan: {
                ...EMPTY_ECONOMIC_REALITY_CLIENT_STATE,
                loading: false,
                error: null,
              },
            },
          }),
          createSuccessfulDomainResult('SNAPSHOT', {
            SNAPSHOT: { uiSnapshot: null },
          }),
        ],
      };

      expect(mergeSuccessfulDomainStates(results)).toEqual({
        PROFILE: { userContext: null, profileInsights: null },
        ECONOMIC: {
          economicPlan: {
            ...EMPTY_ECONOMIC_REALITY_CLIENT_STATE,
            loading: false,
            error: null,
          },
        },
        SNAPSHOT: { uiSnapshot: null },
      });
    });

    it('merges multiple patches for the same domain', () => {
      const results: DomainSyncResults = {
        plan,
        results: [
          createSuccessfulDomainResult('PROFILE', {
            PROFILE: { userContext: null, profileInsights: null },
          }),
          createSuccessfulDomainResult('PROFILE', {
            PROFILE: {
              userContext: { profile: null },
              profileInsights: null,
            },
          }),
        ],
      };

      expect(mergeSuccessfulDomainStates(results)).toEqual({
        PROFILE: {
          userContext: { profile: null },
          profileInsights: null,
        },
      });
    });

    it('skips non-success results', () => {
      const results: DomainSyncResults = {
        plan,
        results: [
          createFailedDomainResult('PROFILE', 'profile unavailable'),
          createSkippedDomainResult(
            'LIFE_EVENT',
            'dependency_failed',
            'Blocked LIFE_EVENT because PROFILE failed',
            { LIFE_EVENT: { lifeEventPlan: null } }
          ),
          createSuccessfulDomainResult('SNAPSHOT', {
            SNAPSHOT: { uiSnapshot: null },
          }),
        ],
      };

      expect(mergeSuccessfulDomainStates(results)).toEqual({
        SNAPSHOT: { uiSnapshot: null },
      });
    });

    it('skips success results without domains', () => {
      const results: DomainSyncResults = {
        plan,
        results: [
          {
            domain: 'PROFILE',
            status: 'success',
            error: null,
          },
          createSuccessfulDomainResult('SNAPSHOT', {
            SNAPSHOT: { uiSnapshot: null },
          }),
        ],
      };

      expect(mergeSuccessfulDomainStates(results)).toEqual({
        SNAPSHOT: { uiSnapshot: null },
      });
    });
  });
});
