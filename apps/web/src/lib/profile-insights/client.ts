import { parseProfileInsightViewV1, type ProfileInsightViewV1 } from '@/lib/product-contract';
import { buildAuthHeaders } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function fetchProfileInsights(sessionId?: string): Promise<ProfileInsightViewV1> {
  const res = await fetch(`${API_URL}/api/profile-insights`, {
    headers: buildAuthHeaders({ sessionId }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Profile insights request failed (${res.status})`);
  }

  const body = await res.json();
  return parseProfileInsightViewV1(body);
}
