import {
  buildAuthHeaders,
  clearStoredSessionAuth,
  createSession,
  readStoredSessionId,
} from '@/lib/api';
import { resetRuntimeSessionState } from '@/lib/life-event/runtime/runtime-store';
import { ONBOARDING_DISMISS_STORAGE_KEY } from '@/lib/situation-utils';
import type { SupportedLanguage, ThemePreference } from '@/lib/product-contract';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type DevResetScope = 'session' | 'all';

export function isDevToolsUiEnabled(): boolean {
  return process.env.NODE_ENV === 'development';
}

export function clearDevClientState(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(ONBOARDING_DISMISS_STORAGE_KEY);
  } catch {
    // ignore
  }

  resetRuntimeSessionState();
}

async function resetUserDataOnServer(sessionId: string, scope: DevResetScope): Promise<void> {
  if (!sessionId) {
    return;
  }

  const endpoint =
    scope === 'all' ? '/api/dev/reset-all-state' : '/api/dev/reset-user-data';

  const res = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: buildAuthHeaders({ sessionId }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Dev reset failed (${res.status})`);
  }
}

export async function resetDevUserData(input: {
  scope: DevResetScope;
  sessionId?: string | null;
  language: SupportedLanguage;
  theme: ThemePreference;
}): Promise<string> {
  const activeSessionId = input.sessionId ?? readStoredSessionId();

  if (activeSessionId) {
    await resetUserDataOnServer(activeSessionId, input.scope);
  } else if (input.scope === 'all') {
    await resetUserDataOnServer('', input.scope);
  }

  clearStoredSessionAuth();
  clearDevClientState();

  return createSession({
    userProfile: {
      language: input.language,
      uiPreferences: { theme: input.theme },
    },
  });
}
