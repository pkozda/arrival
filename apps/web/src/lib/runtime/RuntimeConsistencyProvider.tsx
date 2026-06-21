'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  LifeEventPlanV1,
  ProfileInsightViewV1,
  UiSnapshot,
  UserContextV1,
} from '@/lib/product-contract';
import { setEconomicActionContext } from '@/lib/economic-reality/action-context';
import {
  EMPTY_ECONOMIC_REALITY_CLIENT_STATE,
  type EconomicRealityClientStateV1,
} from '@/lib/economic-reality/economic-reality-client-state';
import { subscribe } from './runtimeReactionBus';
import {
  getRuntimeConsistencyModel,
  type ConsistencyStatus,
} from './runtimeConsistencyModel';
import {
  cloneDomainStateTransaction,
  domainTransactionToLegacyErrors,
  domainTransactionToLegacyLoading,
  mergeDomainPatches,
  type DomainStateMap,
  type DomainStateTransaction,
  type SessionErrorState,
  type SessionLoadingState,
} from './stateTransaction';
import type { SyncScope } from './syncScope';

const DEFAULT_LOADING: SessionLoadingState = {
  userContext: true,
  profileInsights: true,
  lifeEventPlan: true,
  uiSnapshot: true,
  economicPlan: true,
};

const DEFAULT_ERRORS: SessionErrorState = {
  userContext: null,
  profileInsights: null,
  lifeEventPlan: null,
  uiSnapshot: null,
  economicPlan: null,
};

export type RuntimeConsistencyContextValue = {
  consistencyStatus: ConsistencyStatus;
  userContext: UserContextV1 | null;
  userContextLoading: boolean;
  userContextError: string | null;
  profileInsights: ProfileInsightViewV1 | null;
  profileInsightsLoading: boolean;
  profileInsightsError: string | null;
  lifeEventPlan: LifeEventPlanV1 | null;
  lifeEventPlanLoading: boolean;
  lifeEventPlanError: string | null;
  uiSnapshot: UiSnapshot | null;
  uiSnapshotLoading: boolean;
  uiSnapshotError: string | null;
  economicPlan: EconomicRealityClientStateV1;
  profileHeadRevision: number;
  requestSync: (scope?: SyncScope) => Promise<void>;
};

const RuntimeConsistencyContext = createContext<RuntimeConsistencyContextValue | null>(null);

function applyLoading(
  current: SessionLoadingState,
  patch?: Partial<SessionLoadingState>
): SessionLoadingState {
  if (!patch) {
    return current;
  }
  return { ...current, ...patch };
}

function applyErrors(
  current: SessionErrorState,
  patch?: Partial<SessionErrorState>
): SessionErrorState {
  if (!patch) {
    return current;
  }
  return { ...current, ...patch };
}

export function commitStateTransaction(
  transaction: DomainStateTransaction,
  apply: {
    setUserContext: (value: UserContextV1 | null) => void;
    setProfileInsights: (value: ProfileInsightViewV1 | null) => void;
    setLifeEventPlan: (value: LifeEventPlanV1 | null) => void;
    setUiSnapshot: (value: UiSnapshot | null) => void;
    setEconomicPlan: (value: EconomicRealityClientStateV1) => void;
    setProfileHeadRevision: (value: number) => void;
    setLoading: (updater: (current: SessionLoadingState) => SessionLoadingState) => void;
    setErrors: (updater: (current: SessionErrorState) => SessionErrorState) => void;
  },
  options?: {
    onPolicySatisfied?: (domains: DomainStateMap) => void;
  }
): void {
  const tx = cloneDomainStateTransaction(transaction);
  const policy = tx.consistencyPolicy ?? 'satisfied';
  const shouldCommitDomains = policy === 'satisfied' && Object.keys(tx.domains).length > 0;

  if (shouldCommitDomains) {
    if (tx.domains.PROFILE) {
      if (tx.domains.PROFILE.userContext !== undefined) {
        apply.setUserContext(
          tx.domains.PROFILE.userContext ? structuredClone(tx.domains.PROFILE.userContext) : null
        );
      }
      if (tx.domains.PROFILE.profileInsights !== undefined) {
        apply.setProfileInsights(
          tx.domains.PROFILE.profileInsights
            ? structuredClone(tx.domains.PROFILE.profileInsights)
            : null
        );
      }
    }

    if (tx.domains.LIFE_EVENT?.lifeEventPlan !== undefined) {
      apply.setLifeEventPlan(
        tx.domains.LIFE_EVENT.lifeEventPlan
          ? structuredClone(tx.domains.LIFE_EVENT.lifeEventPlan)
          : null
      );
    }

    if (tx.domains.SNAPSHOT?.uiSnapshot !== undefined) {
      apply.setUiSnapshot(
        tx.domains.SNAPSHOT.uiSnapshot ? structuredClone(tx.domains.SNAPSHOT.uiSnapshot) : null
      );
    }

    if (tx.domains.ECONOMIC?.economicPlan !== undefined) {
      apply.setEconomicPlan(structuredClone(tx.domains.ECONOMIC.economicPlan));
    }

    if (tx.profileHeadRevision !== undefined) {
      apply.setProfileHeadRevision(tx.profileHeadRevision);
    }

    options?.onPolicySatisfied?.(tx.domains);
  }

  const legacyLoading = domainTransactionToLegacyLoading(tx.loading);
  if (Object.keys(legacyLoading).length > 0) {
    apply.setLoading((current) => applyLoading(current, legacyLoading));
  }

  const legacyErrors = domainTransactionToLegacyErrors(tx.errors);
  if (Object.keys(legacyErrors).length > 0) {
    apply.setErrors((current) => applyErrors(current, legacyErrors));
  }
}

export function RuntimeConsistencyProvider({
  sessionId,
  children,
}: {
  sessionId: string | null;
  children: ReactNode;
}) {
  const modelRef = useRef(getRuntimeConsistencyModel());
  const lastAppliedSnapshotVersionRef = useRef(-1);
  const cachedDomainsRef = useRef<DomainStateMap>({});
  const bootstrapCompleteRef = useRef(false);
  const [bootstrapComplete, setBootstrapComplete] = useState(false);

  const [consistencyStatus, setConsistencyStatus] = useState<ConsistencyStatus>('idle');
  const [userContext, setUserContext] = useState<UserContextV1 | null>(null);
  const [profileInsights, setProfileInsights] = useState<ProfileInsightViewV1 | null>(null);
  const [lifeEventPlan, setLifeEventPlan] = useState<LifeEventPlanV1 | null>(null);
  const [uiSnapshot, setUiSnapshot] = useState<UiSnapshot | null>(null);
  const [economicPlan, setEconomicPlan] = useState<EconomicRealityClientStateV1>(
    EMPTY_ECONOMIC_REALITY_CLIENT_STATE
  );
  const [profileHeadRevision, setProfileHeadRevision] = useState(0);
  const [loading, setLoading] = useState<SessionLoadingState>(DEFAULT_LOADING);
  const [errors, setErrors] = useState<SessionErrorState>(DEFAULT_ERRORS);

  const commit = useCallback((transaction: DomainStateTransaction) => {
    commitStateTransaction(
      transaction,
      {
        setUserContext: (value) => setUserContext(value),
        setProfileInsights: (value) => setProfileInsights(value),
        setLifeEventPlan: (value) => setLifeEventPlan(value),
        setUiSnapshot: (value) => {
          if (value && value.snapshotVersion >= lastAppliedSnapshotVersionRef.current) {
            lastAppliedSnapshotVersionRef.current = value.snapshotVersion;
          }
          setUiSnapshot(value);
        },
        setEconomicPlan: (value) => setEconomicPlan(value),
        setProfileHeadRevision: (value) => setProfileHeadRevision(value),
        setLoading: (updater) => setLoading(updater),
        setErrors: (updater) => setErrors(updater),
      },
      {
        onPolicySatisfied: (domains) => {
          cachedDomainsRef.current = mergeDomainPatches(cachedDomainsRef.current, domains);
        },
      }
    );
    setConsistencyStatus(modelRef.current.getSnapshot().status);
  }, []);

  const requestSync = useCallback(
    (scope: SyncScope = 'FULL') => modelRef.current.requestSync(scope),
    []
  );

  useEffect(() => {
    const model = modelRef.current;
    model.registerCommit(commit);
    model.registerCachedDomains(() => cachedDomainsRef.current);
    model.start();

    const unsubscribeStarted = subscribe('SYNC_STARTED', () => {
      setConsistencyStatus('syncing');
    });
    const unsubscribeCompleted = subscribe('SYNC_COMPLETED', (event) => {
      if (event.type !== 'SYNC_COMPLETED') {
        return;
      }
      setConsistencyStatus(
        event.success ? 'consistent' : modelRef.current.getSnapshot().status === 'degraded'
          ? 'degraded'
          : 'invalid'
      );
    });

    return () => {
      unsubscribeStarted();
      unsubscribeCompleted();
      model.stop();
    };
  }, [commit]);

  useEffect(() => {
    bootstrapCompleteRef.current = true;
    modelRef.current.setBootstrapReady(true);
    setBootstrapComplete(true);
  }, []);

  useEffect(() => {
    const model = modelRef.current;
    model.setSessionId(sessionId);

    if (!sessionId) {
      lastAppliedSnapshotVersionRef.current = -1;
      cachedDomainsRef.current = {};
      commit({
        domains: {
          PROFILE: { userContext: null, profileInsights: null },
          LIFE_EVENT: { lifeEventPlan: null },
          SNAPSHOT: { uiSnapshot: null },
          ECONOMIC: {
            economicPlan: {
              ...EMPTY_ECONOMIC_REALITY_CLIENT_STATE,
              loading: false,
              error: null,
            },
          },
        },
        profileHeadRevision: 0,
        loading: {
          PROFILE: false,
          LIFE_EVENT: false,
          SNAPSHOT: false,
          ECONOMIC: false,
        },
        errors: {
          PROFILE: null,
          LIFE_EVENT: null,
          SNAPSHOT: null,
          ECONOMIC: null,
        },
        consistencyPolicy: 'satisfied',
      });
      setConsistencyStatus('idle');
      setEconomicActionContext(null);
      return;
    }

    if (!bootstrapCompleteRef.current) {
      return;
    }

    void model.ingest({ type: 'SESSION_SYNC_REQUESTED', scope: 'FULL' });
  }, [sessionId, bootstrapComplete, commit]);

  if (sessionId && economicPlan.deterministicHash && economicPlan.actionSet) {
    setEconomicActionContext({
      sessionId,
      deterministicHash: economicPlan.deterministicHash,
      actionSet: economicPlan.actionSet,
    });
  } else {
    setEconomicActionContext(null);
  }

  const value = useMemo<RuntimeConsistencyContextValue>(
    () => ({
      consistencyStatus,
      userContext,
      userContextLoading: loading.userContext,
      userContextError: errors.userContext,
      profileInsights,
      profileInsightsLoading: loading.profileInsights,
      profileInsightsError: errors.profileInsights,
      lifeEventPlan,
      lifeEventPlanLoading: loading.lifeEventPlan,
      lifeEventPlanError: errors.lifeEventPlan,
      uiSnapshot,
      uiSnapshotLoading: loading.uiSnapshot,
      uiSnapshotError: errors.uiSnapshot,
      economicPlan,
      profileHeadRevision,
      requestSync,
    }),
    [
      consistencyStatus,
      userContext,
      loading,
      errors,
      profileInsights,
      lifeEventPlan,
      uiSnapshot,
      economicPlan,
      profileHeadRevision,
      requestSync,
    ]
  );

  return (
    <RuntimeConsistencyContext.Provider value={value}>{children}</RuntimeConsistencyContext.Provider>
  );
}

export function useRuntimeConsistency(): RuntimeConsistencyContextValue {
  const context = useContext(RuntimeConsistencyContext);
  if (!context) {
    throw new Error('useRuntimeConsistency must be used within RuntimeConsistencyProvider');
  }
  return context;
}
