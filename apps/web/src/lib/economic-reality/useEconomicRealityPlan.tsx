'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useRuntimeConsistency } from '@/lib/runtime/RuntimeConsistencyProvider';
import type { EconomicRealityClientStateV1 } from './economic-reality-client-state';

type EconomicRealityPlanContextValue = EconomicRealityClientStateV1 & {
  refetch: () => Promise<void>;
};

const EconomicRealityPlanContext = createContext<EconomicRealityPlanContextValue | null>(null);

export function EconomicRealityPlanProvider({ children }: { children: ReactNode }) {
  const { economicPlan, requestSync } = useRuntimeConsistency();

  const value = useMemo<EconomicRealityPlanContextValue>(
    () => ({
      ...economicPlan,
      refetch: () => requestSync('ECONOMIC'),
    }),
    [economicPlan, requestSync]
  );

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
