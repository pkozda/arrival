import { vi } from 'vitest';
import { buildEconomicRealityPlan } from '@arrival-atlas/modules/economic-reality';
import { ECONOMIC_FIXTURES } from '@arrival-atlas/modules/economic-reality';
import type { UserContextV1 } from '@/lib/product-contract';
import { subscribe } from '@/lib/runtime/runtimeReactionBus';
import {
  mergeDomainPatches,
  type DomainStateMap,
  type DomainStateTransaction,
} from '@/lib/runtime/stateTransaction';
import {
  getRuntimeConsistencyModel,
  resetRuntimeConsistencyModelForTests,
} from '@/lib/runtime/runtimeConsistencyModel';

export const SESSION_ID = 'sess_regression_test';

export const FIXTURE_USER_CONTEXT = ECONOMIC_FIXTURES[0]!.userContext as UserContextV1;

const FIXED_META = {
  requestId: 'req_regression_test',
  generatedAt: '2026-06-20T12:00:00.000Z',
};

export function buildFixtureEconomicPlanResponse(fixtureId = 'EF01') {
  const fixture = ECONOMIC_FIXTURES.find((entry) => entry.id === fixtureId)!;
  return buildEconomicRealityPlan(fixture.userContext, FIXED_META);
}

export function createRuntimeTestHarness() {
  resetRuntimeConsistencyModelForTests();

  const model = getRuntimeConsistencyModel();
  const commits: DomainStateTransaction[] = [];
  const syncStarted: string[] = [];
  const syncCompleted: boolean[] = [];
  let cachedDomains: DomainStateMap = {};

  model.registerCommit((transaction) => {
    commits.push(structuredClone(transaction));
    if (transaction.consistencyPolicy === 'satisfied') {
      cachedDomains = mergeDomainPatches(cachedDomains, transaction.domains);
    }
  });
  model.registerCachedDomains(() => cachedDomains);
  model.start();

  const unsubscribeStarted = subscribe('SYNC_STARTED', () => {
    syncStarted.push('started');
  });
  const unsubscribeCompleted = subscribe('SYNC_COMPLETED', (event) => {
    if (event.type === 'SYNC_COMPLETED') {
      syncCompleted.push(event.success);
    }
  });

  return {
    model,
    commits,
    syncStarted,
    syncCompleted,
    seedCachedProfile: (userContext: UserContextV1 = FIXTURE_USER_CONTEXT) => {
      cachedDomains = mergeDomainPatches(cachedDomains, {
        PROFILE: { userContext, profileInsights: null },
      });
    },
    teardown: () => {
      unsubscribeStarted();
      unsubscribeCompleted();
      model.stop();
      resetRuntimeConsistencyModelForTests();
    },
  };
}
