import {
  parseEconomicRealityPlanResponseV1,
  type EconomicRealityPlanResponseV1,
} from '@/lib/product-contract';
import { buildAuthHeaders } from '@/lib/api';
import { EconomicRealityPlanFetchError, isEconomicRealityPlanErrorCode } from './errors';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function fetchEconomicPlan(
  sessionId?: string
): Promise<EconomicRealityPlanResponseV1> {
  const res = await fetch(`${API_URL}/api/modules/economic-reality/plan`, {
    headers: buildAuthHeaders({ sessionId }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string;
      code?: string;
    } | null;

    const code = body?.code;
    throw new EconomicRealityPlanFetchError(
      body?.error ?? `Economic reality plan fetch failed (${res.status})`,
      isEconomicRealityPlanErrorCode(code) ? code : 'FETCH_FAILED'
    );
  }

  const body = await res.json();
  return parseEconomicRealityPlanResponseV1(body);
}
