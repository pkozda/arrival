const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const SESSION_STORAGE_KEY = 'arrival_atlas_session_id';

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
  snapshotVersion: number;
  lastMutationId: string | null;
  generatedAt: string;
  session: {
    sessionId: string;
    language: string;
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
  uxSnapshot: {
    actionCards: unknown[];
    prioritySignals: unknown[];
    attentionLayer: unknown[];
  };
  ftu: {
    isFirstTimeUser: boolean;
    step?: number;
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

export async function fetchModules(): Promise<ModuleInfo[]> {
  const res = await fetch(`${API_URL}/api/modules`, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error('Failed to fetch modules');
  const data = await res.json();
  return data.modules;
}

export async function executeModule<TInput, TOutput>(
  moduleId: string,
  input: TInput,
  context?: Record<string, unknown>,
  sessionId?: string
): Promise<ModuleResult<TOutput>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sessionId) headers['x-session-id'] = sessionId;

  const res = await fetch(`${API_URL}/api/modules/${moduleId}/execute`, {
    method: 'POST',
    headers,
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
  const data = await res.json();
  return data.sessionId;
}

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

export async function isSessionValid(sessionId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/sessions/${sessionId}`);
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

  if (storedSessionId && (await isSessionValid(storedSessionId))) {
    return storedSessionId;
  }

  const sessionId = await createSession(context);
  writeStoredSessionId(sessionId);
  return sessionId;
}

export async function fetchUiSnapshot(sessionId: string): Promise<UiSnapshot> {
  const res = await fetch(`${API_URL}/api/ui-snapshot`, {
    headers: { 'x-session-id': sessionId },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Snapshot request failed (${res.status})`);
  }

  return res.json() as Promise<UiSnapshot>;
}

export async function fetchTranslations(lang: string): Promise<Record<string, string>> {
  const res = await fetch(`${API_URL}/api/i18n/${lang}`);
  if (!res.ok) return {};
  const data = await res.json();
  return data.translations;
}
