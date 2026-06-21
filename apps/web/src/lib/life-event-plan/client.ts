import { parseLifeEventPlanV1, type LifeEventPlanV1 } from '@/lib/product-contract';
import { buildAuthHeaders } from '@/lib/api';
import { isMissingUserContextProfilePlanResponse } from '@/lib/plan-fetch';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function fetchLifeEventPlan(sessionId?: string): Promise<LifeEventPlanV1 | null> {
  if (!sessionId) {
    return null;
  }

  const res = await fetch(`${API_URL}/api/modules/life-event/plan`, {
    headers: buildAuthHeaders({ sessionId }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string; code?: string } | null;
    if (isMissingUserContextProfilePlanResponse(res.status, body)) {
      return null;
    }
    throw new Error(body?.error ?? `Life event plan request failed (${res.status})`);
  }

  const body = await res.json();
  return parseLifeEventPlanV1(body);
}
