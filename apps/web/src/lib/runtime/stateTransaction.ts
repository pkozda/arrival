import type {
  LifeEventPlanV1,
  ProfileInsightViewV1,
  UiSnapshot,
  UserContextV1,
} from '@/lib/product-contract';
import type { EconomicRealityClientStateV1 } from '@/lib/economic-reality/economic-reality-client-state';
import type { Domain } from './domainSyncGraph';
import type { DomainSyncResults } from './domainSyncExecution';

export type SessionLoadingState = {
  userContext: boolean;
  profileInsights: boolean;
  lifeEventPlan: boolean;
  uiSnapshot: boolean;
  economicPlan: boolean;
};

export type SessionErrorState = {
  userContext: string | null;
  profileInsights: string | null;
  lifeEventPlan: string | null;
  uiSnapshot: string | null;
  economicPlan: string | null;
};

export type ProfileDomainState = {
  userContext: UserContextV1 | null;
  profileInsights: ProfileInsightViewV1 | null;
};

export type LifeEventDomainState = {
  lifeEventPlan: LifeEventPlanV1 | null;
};

export type EconomicDomainState = {
  economicPlan: EconomicRealityClientStateV1;
};

export type SnapshotDomainState = {
  uiSnapshot: UiSnapshot | null;
};

export type DomainStateMap = {
  PROFILE?: ProfileDomainState;
  LIFE_EVENT?: LifeEventDomainState;
  ECONOMIC?: EconomicDomainState;
  SNAPSHOT?: SnapshotDomainState;
};

export type DomainLoadingMap = Partial<Record<Domain, boolean>>;

export type DomainErrorMap = Partial<Record<Domain, string | null>>;

export type ConsistencyPolicy = import('./domainSyncExecution').ConsistencyPolicy;

export type DomainStateTransaction = {
  domains: DomainStateMap;
  profileHeadRevision?: number;
  loading?: DomainLoadingMap;
  errors?: DomainErrorMap;
  consistencyPolicy?: ConsistencyPolicy;
  syncResults?: DomainSyncResults;
};

export function cloneDomainStateTransaction(transaction: DomainStateTransaction): DomainStateTransaction {
  return structuredClone(transaction);
}

export function domainTransactionToLegacyLoading(
  loading?: DomainLoadingMap
): Partial<{
  userContext: boolean;
  profileInsights: boolean;
  lifeEventPlan: boolean;
  uiSnapshot: boolean;
  economicPlan: boolean;
}> {
  if (!loading) {
    return {};
  }

  return {
    userContext: loading.PROFILE,
    profileInsights: loading.PROFILE,
    lifeEventPlan: loading.LIFE_EVENT,
    uiSnapshot: loading.SNAPSHOT,
    economicPlan: loading.ECONOMIC,
  };
}

export function domainTransactionToLegacyErrors(
  errors?: DomainErrorMap
): Partial<{
  userContext: string | null;
  profileInsights: string | null;
  lifeEventPlan: string | null;
  uiSnapshot: string | null;
  economicPlan: string | null;
}> {
  if (!errors) {
    return {};
  }

  return {
    userContext: errors.PROFILE ?? null,
    profileInsights: errors.PROFILE ?? null,
    lifeEventPlan: errors.LIFE_EVENT ?? null,
    uiSnapshot: errors.SNAPSHOT ?? null,
    economicPlan: errors.ECONOMIC ?? null,
  };
}

/** @deprecated Use DomainStateTransaction — kept for incremental migration */
export type StateTransaction = {
  userContext?: UserContextV1 | null;
  profileInsights?: ProfileInsightViewV1 | null;
  lifeEventPlan?: LifeEventPlanV1 | null;
  uiSnapshot?: UiSnapshot | null;
  economicPlan?: EconomicRealityClientStateV1;
  profileHeadRevision?: number;
  loading?: ReturnType<typeof domainTransactionToLegacyLoading>;
  errors?: ReturnType<typeof domainTransactionToLegacyErrors>;
};

export function cloneStateTransaction(transaction: StateTransaction): StateTransaction {
  return structuredClone(transaction);
}

export function mergeDomainPatches(
  target: DomainStateMap,
  patch: DomainStateMap
): DomainStateMap {
  return {
    ...target,
    ...patch,
    PROFILE: patch.PROFILE ? { ...target.PROFILE, ...patch.PROFILE } : target.PROFILE,
    LIFE_EVENT: patch.LIFE_EVENT ? { ...target.LIFE_EVENT, ...patch.LIFE_EVENT } : target.LIFE_EVENT,
    ECONOMIC: patch.ECONOMIC ? { ...target.ECONOMIC, ...patch.ECONOMIC } : target.ECONOMIC,
    SNAPSHOT: patch.SNAPSHOT ? { ...target.SNAPSHOT, ...patch.SNAPSHOT } : target.SNAPSHOT,
  };
}
