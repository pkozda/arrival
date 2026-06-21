'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { ER_COPY_KEYS } from '@/lib/product-contract';
import { fetchEconomicPlan } from './client';
import {
  EMPTY_ECONOMIC_REALITY_CLIENT_STATE,
  type EconomicRealityClientStateV1,
} from './economic-reality-client-state';
import { reconcileEconomicPlanState } from './reconcileEconomicPlan';
import { bindEconomicActionContext, clearEconomicActionContext } from './action-context';

type EconomicRealityPlanContextValue = EconomicRealityClientStateV1 & {
  refetch: () => Promise<void>;
};

const EconomicRealityPlanContext = createContext<EconomicRealityPlanContextValue | null>(null);

function useEconomicRealityPlanInternal(sessionId?: string): EconomicRealityPlanContextValue {
  const [state, setState] = useState<EconomicRealityClientStateV1>(
    EMPTY_ECONOMIC_REALITY_CLIENT_STATE
  );

  const load = useCallback(async () => {
    if (!sessionId) {
      setState({
        ...EMPTY_ECONOMIC_REALITY_CLIENT_STATE,
        loading: false,
        error: ER_COPY_KEYS.UI_SESSION_NOT_READY,
      });
      return;
    }

    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
    }));

    try {
      const response = await fetchEconomicPlan(sessionId);
      setState((prev) => reconcileEconomicPlanState(prev, response));
    } catch (error) {
      const message =
        error instanceof Error && error.message.startsWith('ER.')
          ? error.message
          : ER_COPY_KEYS.UI_ERROR;
      setState((prev) => ({
        ...prev,
        loading: false,
        error: message,
      }));
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (sessionId && state.deterministicHash && state.actionSet) {
      bindEconomicActionContext({
        sessionId,
        deterministicHash: state.deterministicHash,
        actionSet: state.actionSet,
      });
      return;
    }

    clearEconomicActionContext();
  }, [sessionId, state.deterministicHash, state.actionSet]);

  return {
    ...state,
    refetch: load,
  };
}

export function EconomicRealityPlanProvider({
  sessionId,
  children,
}: {
  sessionId?: string | null;
  children: ReactNode;
}) {
  const value = useEconomicRealityPlanInternal(sessionId ?? undefined);
  return (
    <EconomicRealityPlanContext.Provider value={value}>{children}</EconomicRealityPlanContext.Provider>
  );
}

export function useEconomicRealityPlan(): EconomicRealityPlanContextValue {
  const context = useContext(EconomicRealityPlanContext);
  if (!context) {
    throw new Error('useEconomicRealityPlan must be used within EconomicRealityPlanProvider');
  }
  return context;
}
