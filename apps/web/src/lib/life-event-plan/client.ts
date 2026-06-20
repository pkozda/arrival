import { parseLifeEventPlanV1, type LifeEventPlanV1 } from '@/lib/product-contract';
import { buildAuthHeaders } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function fetchLifeEventPlan(sessionId?: string): Promise<LifeEventPlanV1> {
  const res = await fetch(`${API_URL}/api/modules/life-event/plan`, {
    headers: buildAuthHeaders({ sessionId }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Life event plan request failed (${res.status})`);
  }

  const body = await res.json();
  return parseLifeEventPlanV1(body);
}
