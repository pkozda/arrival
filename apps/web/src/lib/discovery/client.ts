import { buildAuthHeaders } from '@/lib/api';
import { DiscoveryApiError, isDiscoveryApiErrorCode } from './errors';
import type {
  CreateDiscoveryProfileInput,
  DiscoveryProfile,
  DiscoveryProfileResponse,
  DiscoveryProfilesListResponse,
  DiscoveryNotificationEmailResponse,
  DiscoveryResultUserView,
  ProfileRunNowResult,
  ProfileRunSummary,
  ResultState,
  UpdateDiscoveryProfileInput,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const BASE = `${API_URL}/api/modules/discovery`;

type ApiErrorBody = { error?: string; code?: string };

async function parseError(res: Response): Promise<DiscoveryApiError> {
  const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
  const code = body?.code;
  const mapped = isDiscoveryApiErrorCode(code)
    ? code
    : res.status === 401
      ? 'UNAUTHORIZED'
      : 'FETCH_FAILED';
  return new DiscoveryApiError(body?.error ?? `Discovery API failed (${res.status})`, mapped);
}

async function discoveryFetch<T>(
  path: string,
  sessionId: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...buildAuthHeaders({ sessionId }),
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw await parseError(res);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export async function fetchDiscoveryProfiles(
  sessionId: string
): Promise<DiscoveryProfilesListResponse> {
  return discoveryFetch<DiscoveryProfilesListResponse>('/profiles', sessionId);
}

export async function fetchDiscoveryProfile(
  sessionId: string,
  profileId: string
): Promise<DiscoveryProfileResponse> {
  return discoveryFetch<DiscoveryProfileResponse>(
    `/profiles/${encodeURIComponent(profileId)}`,
    sessionId
  );
}

export async function createDiscoveryProfile(
  sessionId: string,
  input: CreateDiscoveryProfileInput
): Promise<DiscoveryProfileResponse> {
  return discoveryFetch<DiscoveryProfileResponse>('/profiles', sessionId, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function enableDiscoveryProfile(
  sessionId: string,
  profileId: string
): Promise<DiscoveryProfile> {
  const body = await discoveryFetch<{ profile: DiscoveryProfile }>(
    `/profiles/${encodeURIComponent(profileId)}/enable`,
    sessionId,
    { method: 'POST' }
  );
  return body.profile;
}

export async function disableDiscoveryProfile(
  sessionId: string,
  profileId: string
): Promise<DiscoveryProfile> {
  const body = await discoveryFetch<{ profile: DiscoveryProfile }>(
    `/profiles/${encodeURIComponent(profileId)}/disable`,
    sessionId,
    { method: 'POST' }
  );
  return body.profile;
}

export async function fetchDiscoveryResults(
  sessionId: string,
  profileId: string
): Promise<DiscoveryResultUserView[]> {
  const body = await discoveryFetch<{ results: DiscoveryResultUserView[] }>(
    `/profiles/${encodeURIComponent(profileId)}/results`,
    sessionId
  );
  return body.results;
}

export async function fetchDiscoveryResult(
  sessionId: string,
  profileId: string,
  resultId: string
): Promise<DiscoveryResultUserView> {
  const body = await discoveryFetch<{ result: DiscoveryResultUserView }>(
    `/profiles/${encodeURIComponent(profileId)}/results/${encodeURIComponent(resultId)}`,
    sessionId
  );
  return body.result;
}

export async function updateDiscoveryResultUserState(
  sessionId: string,
  profileId: string,
  resultId: string,
  userState: ResultState
): Promise<DiscoveryResultUserView> {
  const body = await discoveryFetch<{ result: DiscoveryResultUserView }>(
    `/profiles/${encodeURIComponent(profileId)}/results/${encodeURIComponent(resultId)}/user-state`,
    sessionId,
    {
      method: 'PATCH',
      body: JSON.stringify({ userState }),
    }
  );
  return body.result;
}

export async function updateDiscoveryProfile(
  sessionId: string,
  profileId: string,
  input: UpdateDiscoveryProfileInput
): Promise<DiscoveryProfileResponse> {
  return discoveryFetch<DiscoveryProfileResponse>(
    `/profiles/${encodeURIComponent(profileId)}`,
    sessionId,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    }
  );
}

export async function triggerDiscoveryRunNow(
  sessionId: string,
  profileId: string
): Promise<ProfileRunNowResult> {
  return discoveryFetch<ProfileRunNowResult>(
    `/profiles/${encodeURIComponent(profileId)}/run-now`,
    sessionId,
    { method: 'POST' }
  );
}

export async function fetchDiscoveryRunSummary(
  sessionId: string,
  profileId: string
): Promise<ProfileRunSummary> {
  return discoveryFetch<ProfileRunSummary>(
    `/profiles/${encodeURIComponent(profileId)}/run-summary`,
    sessionId
  );
}

export async function fetchDiscoveryNotificationEmail(
  sessionId: string
): Promise<DiscoveryNotificationEmailResponse> {
  return discoveryFetch<DiscoveryNotificationEmailResponse>(
    '/notification-email',
    sessionId
  );
}

export async function updateDiscoveryNotificationEmail(
  sessionId: string,
  email: string | null
): Promise<DiscoveryNotificationEmailResponse> {
  return discoveryFetch<DiscoveryNotificationEmailResponse>(
    '/notification-email',
    sessionId,
    {
      method: 'PATCH',
      body: JSON.stringify({ email }),
    }
  );
}
