import { describe, expect, it } from 'vitest';
import type { UserContextV1 } from '@/lib/product-contract';
import {
  buildAnnotatedSyncPlan,
  buildSyncPlan,
  DOMAIN_SYNC_GRAPH,
  syncPlanDomains,
} from '@/lib/runtime/domainSyncGraph';
import type { RuntimeReactionInputEvent } from '@/lib/runtime/runtimeReactionBus';
import {
  createFailedDomainResult,
  resolveDomainExecutionDecision,
} from '@/lib/runtime/domainSyncExecution';
import { FIXTURE_USER_CONTEXT } from './test-harness';

const minimalUserContext = {
  schemaVersion: '1.0.0',
  profile: { language: 'en' },
} as UserContextV1;

function planForSequence(events: RuntimeReactionInputEvent[]) {
  return events.map((event) => buildSyncPlan(event));
}

describe('Domain sync graph determinism invariants', () => {
  it('produces identical plans for identical event sequences across runs', () => {
    const events = [
      {
        type: 'PROFILE_MUTATED' as const,
        revision: 1,
        userContext: FIXTURE_USER_CONTEXT,
      },
      {
        type: 'ECONOMIC_ACTION_EXECUTED' as const,
        actionId: 'intent-1',
        previousDeterministicHash: 'hash-a',
        deterministicHash: 'hash-b',
        planChanged: true,
      },
    ];

    const firstRun = planForSequence(events);
    const secondRun = planForSequence(events);

    expect(firstRun).toEqual(secondRun);
    expect(firstRun[0]).toEqual(['PROFILE', 'LIFE_EVENT', 'ECONOMIC', 'SNAPSHOT']);
    expect(firstRun[1]).toEqual(['ECONOMIC', 'SNAPSHOT']);
  });

  it('preserves canonical domain ordering in every plan', () => {
    const plans = [
      buildSyncPlan({
        type: 'PROFILE_MUTATED',
        revision: 1,
        userContext: minimalUserContext,
      }),
      buildSyncPlan({
        type: 'SESSION_SYNC_REQUESTED',
        scope: 'FULL',
      }),
      buildSyncPlan({
        type: 'ECONOMIC_ACTION_EXECUTED',
        actionId: 'a1',
        previousDeterministicHash: 'h1',
        deterministicHash: 'h2',
        planChanged: false,
      }),
    ];

    for (const plan of plans) {
      const profileIndex = plan.indexOf('PROFILE');
      const lifeEventIndex = plan.indexOf('LIFE_EVENT');
      const economicIndex = plan.indexOf('ECONOMIC');
      const snapshotIndex = plan.indexOf('SNAPSHOT');

      if (profileIndex >= 0 && economicIndex >= 0) {
        expect(profileIndex).toBeLessThan(economicIndex);
      }
      if (lifeEventIndex >= 0 && economicIndex >= 0) {
        expect(lifeEventIndex).toBeLessThan(economicIndex);
      }
      if (snapshotIndex >= 0) {
        for (const domain of ['PROFILE', 'LIFE_EVENT', 'ECONOMIC'] as const) {
          const domainIndex = plan.indexOf(domain);
          if (domainIndex >= 0) {
            expect(domainIndex).toBeLessThan(snapshotIndex);
          }
        }
      }
    }
  });

  it('isolates dependency failures per edge semantics', () => {
    const lifeEventFailed = new Map([
      ['LIFE_EVENT', createFailedDomainResult('LIFE_EVENT', 'life event unavailable')],
    ] as const);

    expect(resolveDomainExecutionDecision('ECONOMIC', DOMAIN_SYNC_GRAPH, lifeEventFailed)).toEqual({
      execute: false,
      skipReason: 'dependency_failed',
      error: 'Blocked ECONOMIC because LIFE_EVENT failed',
    });

    const profileFailed = new Map([
      ['PROFILE', createFailedDomainResult('PROFILE', 'profile unavailable')],
    ] as const);

    expect(resolveDomainExecutionDecision('LIFE_EVENT', DOMAIN_SYNC_GRAPH, profileFailed)).toEqual({
      execute: true,
    });
  });

  it('annotated plan reasons remain stable for PROFILE_MUTATED', () => {
    const annotatedA = buildAnnotatedSyncPlan({
      type: 'PROFILE_MUTATED',
      revision: 1,
      userContext: minimalUserContext,
    });
    const annotatedB = buildAnnotatedSyncPlan({
      type: 'PROFILE_MUTATED',
      revision: 1,
      userContext: minimalUserContext,
    });

    expect(syncPlanDomains(annotatedA)).toEqual(syncPlanDomains(annotatedB));
    expect(annotatedA).toEqual(annotatedB);
  });
});
