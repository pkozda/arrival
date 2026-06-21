'use client';

import { useCallback } from 'react';
import { buildAuthHeaders } from '@/lib/api';
import { getRuntimeConsistencyModel } from '@/lib/runtime/runtimeConsistencyModel';
import { economicActionContextRef, readEconomicActionContext } from './action-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type EconomicActionExecutionResult = {
  actionId: string;
  previousDeterministicHash: string;
  deterministicHash: string;
  planChanged: boolean;
};

export function useEconomicFeedbackTracker() {
  const trackModuleEntered = useCallback(async (deterministicHash: string) => {
    const context = readEconomicActionContext() ?? economicActionContextRef.current;
    if (!context) {
      return;
    }

    const res = await fetch(`${API_URL}/api/modules/economic-reality/events`, {
      method: 'POST',
      headers: {
        ...buildAuthHeaders({ sessionId: context.sessionId }),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'MODULE_ENTERED',
        deterministicHash,
      }),
    });

    if (!res.ok) {
      return;
    }

    const body = (await res.json()) as {
      previousDeterministicHash: string;
      deterministicHash: string;
      planChanged: boolean;
    };

    await getRuntimeConsistencyModel().ingest({
      type: 'ECONOMIC_ACTION_EXECUTED',
      actionId: 'module-entered',
      previousDeterministicHash: body.previousDeterministicHash,
      deterministicHash: body.deterministicHash,
      planChanged: body.planChanged,
    });
  }, []);

  const trackActionExecuted = useCallback((result: EconomicActionExecutionResult) => {
    void getRuntimeConsistencyModel().ingest({
      type: 'ECONOMIC_ACTION_EXECUTED',
      ...result,
    });
  }, []);

  return {
    trackModuleEntered,
    trackActionExecuted,
  };
}
