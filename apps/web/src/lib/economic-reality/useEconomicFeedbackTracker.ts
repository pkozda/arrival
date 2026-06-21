'use client';

import { useCallback } from 'react';
import { buildAuthHeaders } from '@/lib/api';
import { readEconomicActionContext } from './action-context';
import { invalidateEconomicPlanIfHashChanged } from './revalidation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type EconomicActionExecutionResult = {
  actionId: string;
  previousDeterministicHash: string;
  deterministicHash: string;
  planChanged: boolean;
};

export function useEconomicFeedbackTracker(refetch: () => Promise<void>) {
  const trackModuleEntered = useCallback(
    async (deterministicHash: string) => {
      const context = readEconomicActionContext();
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

      if (invalidateEconomicPlanIfHashChanged(body.previousDeterministicHash, body.deterministicHash)) {
        await refetch();
      }
    },
    [refetch]
  );

  const trackActionExecuted = useCallback(
    async (result: EconomicActionExecutionResult) => {
      if (
        invalidateEconomicPlanIfHashChanged(
          result.previousDeterministicHash,
          result.deterministicHash
        )
      ) {
        await refetch();
      }
    },
    [refetch]
  );

  return {
    trackModuleEntered,
    trackActionExecuted,
  };
}
