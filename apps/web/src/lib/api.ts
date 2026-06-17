const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const SESSION_STORAGE_KEY = 'arrival_atlas_session_id';
export const TOKEN_STORAGE_KEY = 'arrival_atlas_auth_token';

export interface SnapshotProfileEmployment {
  status?: string;
  grossMonthlyIncome?: number;
  taxClass?: number;
  churchTax?: boolean;
}

export interface SnapshotProfileHousehold {
  size?: number;
  maritalStatus?: string;
}

export interface SnapshotProfileHousing {
  monthlyColdRent?: number;
}

export interface SnapshotProfileInsurance {
  type?: string;
  hasCoverage?: boolean;
}

export interface SnapshotProfile {
  preferredLanguage?: string;
  employment?: SnapshotProfileEmployment;
  household?: SnapshotProfileHousehold;
  housing?: SnapshotProfileHousing;
  insurance?: SnapshotProfileInsurance;
  [key: string]: unknown;
}

export interface UiSnapshot {
  schemaVersion: number;
  snapshotVersion: number;
  lastMutationId: string | null;
  generatedAt: string;
  session: {
    sessionId: string;
    language: string;
    uiPreferences: {
      theme: 'light' | 'dark' | 'system';
    };
  };
  profile: SnapshotProfile | null;
  modules: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
  executions: Array<{
    moduleId: string;
    result: unknown;
    timestamp: number;
    executionId: string;
    snapshotVersion: number;
  }>;
  executionsByModuleId: Record<
    string,
    Array<{
      moduleId: string;
      result: unknown;
      timestamp: number;
      executionId: string;
      snapshotVersion: number;
    }>
  >;
  uxSnapshot: {
    actionCards: unknown[];
    prioritySignals: unknown[];
    attentionLayer: unknown[];
  };
  ftu: {
    isFirstTimeUser: boolean;
    step?: number;
  };
  fallback?: {
    reason: string;
    code: 'PROJECTION_ERROR';
  };
}

export interface ModuleInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  enabled: boolean;
}

export interface UxActionCard {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  source: string;
}

export interface UxPayload {
  actions: UxActionCard[];
  summary: string;
}

export interface ModuleResult<T = unknown> {
  moduleId: string;
  version: string;
  success: boolean;
  data?: T;
  error?: string;
  executedAt: string;
  ux?: UxPayload;
}

export type AuthHeaderOptions = {
  sessionId?: string | null;
  token?: string | null;
};

export function readStoredSessionId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const sessionId = localStorage.getItem(SESSION_STORAGE_KEY);
    return sessionId && sessionId.length > 0 ? sessionId : null;
  } catch {
    return null;
  }
}

export function writeStoredSessionId(sessionId: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
}

export function readStoredToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    return token && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

export function writeStoredToken(token: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function writeStoredSessionAuth(sessionId: string, token: string | null | undefined): void {
  writeStoredSessionId(sessionId);
  if (token) {
    writeStoredToken(token);
  }
}

export function buildAuthHeaders(options: AuthHeaderOptions = {}): Record<string, string> {
  const sessionId = options.sessionId ?? readStoredSessionId();
  const token = options.token ?? readStoredToken();
  const headers: Record<string, string> = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (sessionId) {
    headers['x-session-id'] = sessionId;
  }

  return headers;
}

function jsonAuthHeaders(options: AuthHeaderOptions = {}): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...buildAuthHeaders(options),
  };
}

export async function executeModule<TInput, TOutput>(
  moduleId: string,
  input: TInput,
  context?: Record<string, unknown>,
  sessionId?: string
): Promise<ModuleResult<TOutput>> {
  const res = await fetch(`${API_URL}/api/modules/${moduleId}/execute`, {
    method: 'POST',
    headers: jsonAuthHeaders({ sessionId }),
    body: JSON.stringify({ input, context }),
  });

  return res.json();
}

export async function createSession(context?: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${API_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context }),
  });
  const data = (await res.json()) as { sessionId: string; token?: string };
  writeStoredSessionAuth(data.sessionId, data.token);
  return data.sessionId;
}

export async function isSessionValid(
  sessionId: string,
  options: AuthHeaderOptions = {}
): Promise<boolean> {
  const headers = buildAuthHeaders({ sessionId, ...options });
  if (!headers.Authorization && !headers['x-session-id']) {
    return false;
  }

  try {
    const res = await fetch(`${API_URL}/api/sessions/${sessionId}`, {
      headers,
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Restore a stored session when valid; otherwise create a new session and persist it.
 */
export async function ensureSession(context?: Record<string, unknown>): Promise<string> {
  const storedSessionId = readStoredSessionId();
  const storedToken = readStoredToken();

  if (
    storedSessionId &&
    (await isSessionValid(storedSessionId, { token: storedToken, sessionId: storedSessionId }))
  ) {
    return storedSessionId;
  }

  return createSession(context);
}

export const LEGACY_THEME_STORAGE_KEY = 'arrivalos-theme';

export function clearLegacyThemeStorage(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export async function fetchUiSnapshot(sessionId: string): Promise<UiSnapshot> {
  const res = await fetch(`${API_URL}/api/ui-snapshot`, {
    headers: buildAuthHeaders({ sessionId }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Snapshot request failed (${res.status})`);
  }

  return res.json() as Promise<UiSnapshot>;
}

export async function updateSessionLanguage(
  sessionId: string,
  language: string
): Promise<void> {
  const res = await fetch(`${API_URL}/api/sessions/${sessionId}`, {
    method: 'PATCH',
    headers: jsonAuthHeaders({ sessionId }),
    body: JSON.stringify({ context: { userProfile: { language } } }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Session update failed (${res.status})`);
  }
}

export async function updateSessionTheme(
  sessionId: string,
  theme: 'light' | 'dark' | 'system'
): Promise<void> {
  const res = await fetch(`${API_URL}/api/sessions/${sessionId}`, {
    method: 'PATCH',
    headers: jsonAuthHeaders({ sessionId }),
    body: JSON.stringify({ context: { userProfile: { uiPreferences: { theme } } } }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Session update failed (${res.status})`);
  }
}

export async function fetchTranslations(lang: string): Promise<Record<string, string>> {
  const res = await fetch(`${API_URL}/api/i18n/${lang}`);
  if (!res.ok) return {};
  const data = await res.json();
  return data.translations;
}
