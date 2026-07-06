import {
  buildAuthHeaders,
  clearStoredSessionAuth,
  createSession,
  readStoredSessionId,
  writeStoredSessionId,
} from '@/lib/api';
import type { SupportedLanguage, ThemePreference } from '@/lib/product-contract';
import { clearAtlasClientPersistedState } from '@/lib/atlas-reset/clear-client-state';
import { clearJourneyGuideState } from '@/lib/journey-guide/storage';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type DevResetScope = 'session' | 'all';

export function isDevToolsUiEnabled(): boolean {
  return process.env.NODE_ENV === 'development';
}

/** @deprecated Use `clearAtlasClientPersistedState` */
export function clearDevClientState(): void {
  clearAtlasClientPersistedState();
}

async function resetUserDataOnServer(sessionId: string, scope: DevResetScope): Promise<void> {
  if (!sessionId && scope !== 'all') {
    return;
  }

  const endpoint =
    scope === 'all' ? '/api/dev/reset-all-state' : '/api/dev/reset-user-data';

  const res = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: buildAuthHeaders({ sessionId: sessionId || undefined }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Dev reset failed (${res.status})`);
  }
}

/** Follower tab: adopt recreated session without creating a new session. */
export function adoptRecreatedSessionId(ownerSessionId: string): string {
  const storedSessionId = readStoredSessionId();
  if (storedSessionId !== ownerSessionId) {
    writeStoredSessionId(ownerSessionId);
  }

  clearJourneyGuideState();
  return ownerSessionId;
}

/** Follower tab: adopt owner session and clear client state without creating a new session. */
export function adoptAtlasSessionAfterDemoReset(ownerSessionId: string): string {
  const storedSessionId = readStoredSessionId();
  if (storedSessionId !== ownerSessionId) {
    writeStoredSessionId(ownerSessionId);
  }

  clearAtlasClientPersistedState();
  return ownerSessionId;
}

export async function resetAtlasSession(input: {
  sessionId?: string | null;
  language?: SupportedLanguage;
  theme?: ThemePreference;
  serverScope?: DevResetScope;
}): Promise<string> {
  const activeSessionId = input.sessionId ?? readStoredSessionId();
  const serverScope = input.serverScope ?? 'session';

  if (isDevToolsUiEnabled()) {
    try {
      if (serverScope === 'all') {
        await resetUserDataOnServer('', 'all');
      } else if (activeSessionId) {
        await resetUserDataOnServer(activeSessionId, 'session');
      }
    } catch {
      // Production or unavailable dev endpoint — client reset + new session still applies.
    }
  }

  clearStoredSessionAuth();
  clearAtlasClientPersistedState();

  return createSession({
    userProfile: {
      language: input.language ?? 'en',
      uiPreferences: { theme: input.theme ?? 'dark' },
    },
  });
}

export async function resetDevUserData(input: {
  scope: DevResetScope;
  sessionId?: string | null;
  language: SupportedLanguage;
  theme: ThemePreference;
}): Promise<string> {
  return resetAtlasSession({
    sessionId: input.sessionId,
    language: input.language,
    theme: input.theme,
    serverScope: input.scope,
  });
}
