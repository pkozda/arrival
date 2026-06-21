import { buildAuthHeaders } from '@/lib/api';
import type { EconomicActionSetV1 } from '@/lib/product-contract';
import { ER_COPY_KEYS } from '@/lib/product-contract';
import {
  economicActionContextRef,
  readEconomicActionContext,
  type EconomicActionExecutionContext,
} from './action-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class EconomicActionExecutionError extends Error {
  readonly code: 'E_STALE_ACTION_SET' | 'E_ACTION_NOT_FOUND' | 'E_NO_CONTEXT' | 'EXECUTION_FAILED';

  constructor(code: EconomicActionExecutionError['code'], message: string) {
    super(message);
    this.name = 'EconomicActionExecutionError';
    this.code = code;
  }
}

function assertActionInSet(actionSet: EconomicActionSetV1, actionId: string): void {
  const exists = actionSet.actions.some((action) => action.id === actionId);
  if (!exists) {
    throw new EconomicActionExecutionError(
      'E_ACTION_NOT_FOUND',
      `Action ${actionId} is not in the current action set`
    );
  }
}

export async function executeEconomicAction(
  actionId: string,
  contextOverride?: EconomicActionExecutionContext | null
): Promise<{
  actionId: string;
  previousDeterministicHash: string;
  deterministicHash: string;
  planChanged: boolean;
}> {
  const context = contextOverride ?? readEconomicActionContext() ?? economicActionContextRef.current;
  if (!context) {
    throw new EconomicActionExecutionError(
      'E_NO_CONTEXT',
      ER_COPY_KEYS.UI_SESSION_NOT_READY
    );
  }

  assertActionInSet(context.actionSet, actionId);

  const res = await fetch(`${API_URL}/api/modules/economic-reality/action/execute`, {
    method: 'POST',
    headers: {
      ...buildAuthHeaders({ sessionId: context.sessionId }),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      actionId,
      deterministicHash: context.deterministicHash,
    }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { code?: string; error?: string } | null;
    if (body?.code === 'E_STALE_ACTION_SET') {
      throw new EconomicActionExecutionError(
        'E_STALE_ACTION_SET',
        ER_COPY_KEYS.UI_ACTION_STALE
      );
    }

    throw new EconomicActionExecutionError(
      'EXECUTION_FAILED',
      ER_COPY_KEYS.UI_ACTION_FAILED
    );
  }

  const body = (await res.json()) as {
    actionId: string;
    previousDeterministicHash: string;
    deterministicHash: string;
    planChanged: boolean;
  };

  return body;
}
