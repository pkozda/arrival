import type { UserContextV1 } from '@arrival-atlas/product-contract';
import { hasUserContextProfile } from '@/lib/user-context';
import { fetchUiSnapshot } from '@/lib/api';
import { fetchEconomicPlan } from '@/lib/economic-reality/client';
import { clearEconomicPlanCache } from '@/lib/economic-reality/cache';
import { ER_COPY_KEYS } from '@/lib/product-contract';
import {
  EMPTY_ECONOMIC_REALITY_CLIENT_STATE,
  type EconomicRealityClientStateV1,
} from '@/lib/economic-reality/economic-reality-client-state';
import { reconcileEconomicPlanState } from '@/lib/economic-reality/reconcileEconomicPlan';
import { fetchLifeEventPlan } from '@/lib/life-event-plan';
import { fetchProfileInsights } from '@/lib/profile-insights';
import { fetchUserContext } from '@/lib/mutations';
import {
  emit,
  subscribe,
  type RuntimeReactionInputEvent,
} from './runtimeReactionBus';
import {
  buildAnnotatedSyncPlan,
  DOMAIN_SYNC_GRAPH,
  loadingFlagsForDomains,
  syncPlanDomains,
  type Domain,
  type SyncPlan,
} from './domainSyncGraph';
import {
  aggregateDomainFetchOutcome,
  collectDomainErrors,
  createSkippedDomainResult,
  evaluateConsistencyPolicy,
  mergeSuccessfulDomainStates,
  resolveDomainExecutionDecision,
  type DomainSyncResults,
} from './domainSyncExecution';
import {
  cloneDomainStateTransaction,
  type DomainErrorMap,
  type DomainStateMap,
  type DomainStateTransaction,
} from './stateTransaction';
import type { SyncScope } from './syncScope';

export type { SyncScope } from './syncScope';
export { buildSyncPlan, buildAnnotatedSyncPlan } from './domainSyncGraph';

export type ConsistencyStatus = 'idle' | 'syncing' | 'consistent' | 'degraded' | 'invalid';

export type GetCachedDomainState = () => DomainStateMap;

export type CommitStateTransaction = (transaction: DomainStateTransaction) => void;

export type ConsistencyModelSnapshot = {
  status: ConsistencyStatus;
  lastPlan: SyncPlan;
  lastTrigger: RuntimeReactionInputEvent['type'] | null;
};

type SyncSeed = {
  userContext?: UserContextV1;
  profileHeadRevision?: number;
};

type DomainFetchResult = {
  domains: DomainStateMap;
  errors: DomainErrorMap;
};

async function fetchEconomicClientState(sessionId: string): Promise<EconomicRealityClientStateV1> {
  clearEconomicPlanCache();
  const response = await fetchEconomicPlan(sessionId);
  if (!response) {
    return {
      ...EMPTY_ECONOMIC_REALITY_CLIENT_STATE,
      loading: false,
      error: null,
    };
  }

  return reconcileEconomicPlanState(EMPTY_ECONOMIC_REALITY_CLIENT_STATE, response);
}

async function fetchProfileDomain(sessionId: string, seed?: SyncSeed): Promise<DomainFetchResult> {
  const [userContextResult, profileInsightsResult] = await Promise.allSettled([
    seed?.userContext ? Promise.resolve(seed.userContext) : fetchUserContext(sessionId),
    fetchProfileInsights(sessionId),
  ]);

  const domains: DomainStateMap = {
    PROFILE: {
      userContext: null,
      profileInsights: null,
    },
  };
  const errors: DomainErrorMap = {};

  if (userContextResult.status === 'fulfilled') {
    domains.PROFILE!.userContext = userContextResult.value;
  } else {
    errors.PROFILE =
      userContextResult.reason instanceof Error
        ? userContextResult.reason.message
        : 'Failed to load your situation';
  }

  if (profileInsightsResult.status === 'fulfilled') {
    domains.PROFILE!.profileInsights = profileInsightsResult.value;
  } else {
    const message =
      profileInsightsResult.reason instanceof Error
        ? profileInsightsResult.reason.message
        : 'Failed to load situation insights';
    errors.PROFILE = errors.PROFILE ? `${errors.PROFILE}; ${message}` : message;
  }

  return { domains, errors };
}

const PLAN_DOMAINS = new Set<Domain>(['LIFE_EVENT', 'ECONOMIC']);

function resolveHasUserProfile(
  seed: SyncSeed | undefined,
  cachedDomains: DomainStateMap
): boolean {
  if (hasUserContextProfile(seed?.userContext)) {
    return true;
  }

  return hasUserContextProfile(cachedDomains.PROFILE?.userContext);
}

async function fetchLifeEventDomain(
  sessionId: string,
  hasUserProfile: boolean
): Promise<DomainFetchResult> {
  if (!sessionId || !hasUserProfile) {
    return {
      domains: { LIFE_EVENT: { lifeEventPlan: null } },
      errors: {},
    };
  }

  try {
    const lifeEventPlan = await fetchLifeEventPlan(sessionId);
    return {
      domains: { LIFE_EVENT: { lifeEventPlan } },
      errors: {},
    };
  } catch (error) {
    return {
      domains: { LIFE_EVENT: { lifeEventPlan: null } },
      errors: {
        LIFE_EVENT:
          error instanceof Error ? error.message : 'Failed to load your next steps plan',
      },
    };
  }
}

async function fetchEconomicDomain(
  sessionId: string,
  hasUserProfile: boolean
): Promise<DomainFetchResult> {
  if (!sessionId || !hasUserProfile) {
    return {
      domains: {
        ECONOMIC: {
          economicPlan: {
            ...EMPTY_ECONOMIC_REALITY_CLIENT_STATE,
            loading: false,
            error: null,
          },
        },
      },
      errors: {},
    };
  }

  try {
    const economicPlan = await fetchEconomicClientState(sessionId);
    return {
      domains: { ECONOMIC: { economicPlan } },
      errors: { ECONOMIC: economicPlan.error },
    };
  } catch (error) {
    const message =
      error instanceof Error && error.message.startsWith('ER.')
        ? error.message
        : ER_COPY_KEYS.UI_ERROR;
    return {
      domains: {
        ECONOMIC: {
          economicPlan: {
            ...EMPTY_ECONOMIC_REALITY_CLIENT_STATE,
            loading: false,
            error: message,
          },
        },
      },
      errors: { ECONOMIC: message },
    };
  }
}

async function fetchSnapshotDomain(sessionId: string): Promise<DomainFetchResult> {
  try {
    const uiSnapshot = await fetchUiSnapshot(sessionId);
    return {
      domains: { SNAPSHOT: { uiSnapshot } },
      errors: {},
    };
  } catch (error) {
    return {
      domains: { SNAPSHOT: { uiSnapshot: null } },
      errors: {
        SNAPSHOT:
          error instanceof Error ? error.message : 'Failed to refresh your situation',
      },
    };
  }
}

async function fetchDomain(
  domain: Domain,
  sessionId: string,
  options?: { seed?: SyncSeed; hasUserProfile?: boolean }
): Promise<DomainFetchResult> {
  const hasUserProfile = options?.hasUserProfile ?? false;

  switch (domain) {
    case 'PROFILE':
      return fetchProfileDomain(sessionId, options?.seed);
    case 'LIFE_EVENT':
      return fetchLifeEventDomain(sessionId, hasUserProfile);
    case 'ECONOMIC':
      return fetchEconomicDomain(sessionId, hasUserProfile);
    case 'SNAPSHOT':
      return fetchSnapshotDomain(sessionId);
    default: {
      const exhaustive: never = domain;
      return exhaustive;
    }
  }
}

export class RuntimeConsistencyModel {
  private status: ConsistencyStatus = 'idle';
  private lastPlan: SyncPlan = [];
  private lastTrigger: RuntimeReactionInputEvent['type'] | null = null;
  private commit: CommitStateTransaction | null = null;
  private getCachedDomains: GetCachedDomainState = () => ({});
  private sessionId: string | null = null;
  private bootstrapReady = false;
  private syncQueue: Promise<void> = Promise.resolve();
  private unsubscribe: (() => void) | null = null;

  registerCommit(commit: CommitStateTransaction): void {
    this.commit = commit;
  }

  registerCachedDomains(getCachedDomains: GetCachedDomainState): void {
    this.getCachedDomains = getCachedDomains;
  }

  setSessionId(sessionId: string | null): void {
    this.sessionId = sessionId;
  }

  setBootstrapReady(ready: boolean): void {
    this.bootstrapReady = ready;
  }

  isBootstrapReady(): boolean {
    return this.bootstrapReady;
  }

  getSnapshot(): ConsistencyModelSnapshot {
    return {
      status: this.status,
      lastPlan: this.lastPlan,
      lastTrigger: this.lastTrigger,
    };
  }

  start(): void {
    if (this.unsubscribe) {
      return;
    }

    const eventTypes: RuntimeReactionInputEvent['type'][] = [
      'PROFILE_MUTATED',
      'ECONOMIC_ACTION_EXECUTED',
      'SESSION_SYNC_REQUESTED',
    ];

    const unsubscribers = eventTypes.map((eventType) =>
      subscribe(eventType, (event) => {
        if (event.type === 'SYNC_STARTED' || event.type === 'SYNC_COMPLETED') {
          return;
        }
        void this.ingest(event);
      })
    );

    this.unsubscribe = () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
    };
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  ingest(event: RuntimeReactionInputEvent): Promise<void> {
    this.syncQueue = this.syncQueue.then(() => this.runSync(event));
    return this.syncQueue;
  }

  requestSync(scope: SyncScope = 'FULL'): Promise<void> {
    return this.ingest({ type: 'SESSION_SYNC_REQUESTED', scope });
  }

  private async executeSyncPlan(
    annotatedPlan: ReturnType<typeof buildAnnotatedSyncPlan>,
    sessionId: string,
    seed?: SyncSeed
  ): Promise<DomainSyncResults> {
    const results: DomainSyncResults['results'] = [];
    const completedResults = new Map(
      results.map((result) => [result.domain, result] as const)
    );
    let hasUserProfile = resolveHasUserProfile(seed, this.getCachedDomains());

    for (const step of annotatedPlan) {
      const decision = resolveDomainExecutionDecision(
        step.domain,
        DOMAIN_SYNC_GRAPH,
        completedResults
      );

      if (!decision.execute) {
        const cachedDomains =
          decision.skipReason === 'recompute_fallback_cached'
            ? pickCachedDomainState(this.getCachedDomains(), step.domain)
            : undefined;

        const skipped = createSkippedDomainResult(
          step.domain,
          decision.skipReason,
          decision.error,
          cachedDomains
        );
        results.push(skipped);
        completedResults.set(step.domain, skipped);
        continue;
      }

      if (PLAN_DOMAINS.has(step.domain) && !hasUserProfile) {
        const skipped = createSkippedDomainResult(
          step.domain,
          'profile_not_ready',
          `Skipped ${step.domain} until UserContext profile is available`
        );
        results.push(skipped);
        completedResults.set(step.domain, skipped);
        continue;
      }

      const fetchResult = await fetchDomain(step.domain, sessionId, {
        seed: step.domain === 'PROFILE' ? seed : undefined,
        hasUserProfile,
      });
      const outcome = aggregateDomainFetchOutcome(step.domain, fetchResult);
      results.push(outcome);
      completedResults.set(step.domain, outcome);

      if (step.domain === 'PROFILE') {
        hasUserProfile = hasUserContextProfile(
          fetchResult.domains.PROFILE?.userContext ?? null
        );
      }
    }

    return { plan: annotatedPlan, results };
  }

  private async runSync(event: RuntimeReactionInputEvent): Promise<void> {
    if (!this.bootstrapReady || !this.commit || !this.sessionId) {
      return;
    }

    const annotatedPlan = buildAnnotatedSyncPlan(event, DOMAIN_SYNC_GRAPH);
    const plan = syncPlanDomains(annotatedPlan);
    this.lastPlan = plan;
    this.lastTrigger = event.type;
    this.status = 'syncing';

    emit({ type: 'SYNC_STARTED', plan, trigger: event.type });
    this.commit({
      domains: {},
      loading: loadingFlagsForDomains(plan, true),
    });

    const seed: SyncSeed | undefined =
      event.type === 'PROFILE_MUTATED'
        ? { userContext: event.userContext, profileHeadRevision: event.revision }
        : undefined;

    try {
      const syncResults = await this.executeSyncPlan(annotatedPlan, this.sessionId, seed);
      const policy = evaluateConsistencyPolicy(syncResults);
      const errors = collectDomainErrors(syncResults);

      const transaction: DomainStateTransaction = {
        domains: policy === 'satisfied' ? mergeSuccessfulDomainStates(syncResults) : {},
        loading: loadingFlagsForDomains(plan, false),
        errors,
        consistencyPolicy: policy,
        syncResults,
      };

      if (policy === 'satisfied' && seed?.profileHeadRevision !== undefined) {
        transaction.profileHeadRevision = seed.profileHeadRevision;
      }

      this.commit(cloneDomainStateTransaction(transaction));
      this.status = policy === 'satisfied' ? 'consistent' : 'degraded';
      emit({ type: 'SYNC_COMPLETED', plan, success: policy === 'satisfied' });
    } catch {
      this.status = 'invalid';
      this.commit({
        domains: {},
        loading: loadingFlagsForDomains(plan, false),
        consistencyPolicy: 'degraded',
      });
      emit({ type: 'SYNC_COMPLETED', plan, success: false });
    }
  }
}

function pickCachedDomainState(cached: DomainStateMap, domain: Domain): DomainStateMap | undefined {
  const state = cached[domain];
  if (!state) {
    return undefined;
  }
  return { [domain]: structuredClone(state) } as DomainStateMap;
}

let sharedModel: RuntimeConsistencyModel | null = null;

export function getRuntimeConsistencyModel(): RuntimeConsistencyModel {
  if (!sharedModel) {
    sharedModel = new RuntimeConsistencyModel();
  }
  return sharedModel;
}

export function resetRuntimeConsistencyModelForTests(): void {
  sharedModel?.stop();
  sharedModel = null;
}
