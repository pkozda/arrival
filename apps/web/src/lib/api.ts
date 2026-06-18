import type {
  ModuleCatalogResponse,
  ModuleSchemaProjection,
  PublicModuleContract,
} from '@/lib/product-contract';
import type {
  ModuleExecuteResponse,
  ModuleExplanationView,
  ThemePreference,
  UiSnapshot,
} from '@/lib/product-contract';

export type {
  ModuleExecuteResponse,
  ModuleExplanationView,
  UiSnapshot,
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const SESSION_STORAGE_KEY = 'arrival_atlas_session_id';
export const TOKEN_STORAGE_KEY = 'arrival_atlas_auth_token';

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

export async function fetchModuleCatalog(): Promise<PublicModuleContract[]> {
  const res = await fetch(`${API_URL}/api/modules`);
  if (!res.ok) {
    throw new Error(`Module catalog request failed (${res.status})`);
  }

  const body = (await res.json()) as ModuleCatalogResponse;
  return body.modules;
}

export async function fetchModuleContract(moduleId: string): Promise<PublicModuleContract> {
  const res = await fetch(`${API_URL}/api/modules/${moduleId}`);
  if (!res.ok) {
    throw new Error(`Module contract request failed (${res.status})`);
  }

  return res.json() as Promise<PublicModuleContract>;
}

export async function fetchModuleSchema(moduleId: string): Promise<ModuleSchemaProjection> {
  const res = await fetch(`${API_URL}/api/modules/${moduleId}/schema`);
  if (!res.ok) {
    throw new Error(`Module schema request failed (${res.status})`);
  }

  return res.json() as Promise<ModuleSchemaProjection>;
}

export async function executeModule(
  moduleId: string,
  input: Record<string, unknown>,
  context?: Record<string, unknown>,
  sessionId?: string
): Promise<ModuleExecuteResponse> {
  const res = await fetch(`${API_URL}/api/modules/${moduleId}/execute`, {
    method: 'POST',
    headers: jsonAuthHeaders({ sessionId }),
    body: JSON.stringify({ input, context }),
  });

  const body = (await res.json()) as ModuleExecuteResponse;
  if (!res.ok && !body.projection) {
    const errorBody = body as unknown as { error?: string };
    throw new Error(
      typeof errorBody.error === 'string'
        ? errorBody.error
        : `Module execution failed (${res.status})`
    );
  }

  return body;
}

export async function fetchModuleExplanation(
  moduleId: string,
  executionId: string,
  sessionId?: string
): Promise<ModuleExplanationView> {
  const res = await fetch(
    `${API_URL}/api/modules/${moduleId}/explain?executionId=${encodeURIComponent(executionId)}`,
    {
      headers: buildAuthHeaders({ sessionId }),
    }
  );

  if (!res.ok) {
    const errorBody = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(errorBody?.error ?? `Explain request failed (${res.status})`);
  }

  return res.json() as Promise<ModuleExplanationView>;
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
  theme: ThemePreference
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
