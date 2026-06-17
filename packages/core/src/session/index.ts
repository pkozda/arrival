import type { AppContext, Session } from '../types/index.js';

const sessions = new Map<string, Session>();

function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function createSession(context: AppContext = {}): Session {
  const now = new Date().toISOString();
  const session: Session = {
    id: generateSessionId(),
    createdAt: now,
    lastActiveAt: now,
    context: { ...context },
  };
  sessions.set(session.id, session);
  return session;
}

export function getSession(sessionId: string): Session | undefined {
  return sessions.get(sessionId);
}

export function updateSessionContext(
  sessionId: string,
  context: Partial<AppContext>
): Session | undefined {
  const session = sessions.get(sessionId);
  if (!session) return undefined;

  session.context = {
    ...session.context,
    ...context,
    userProfile: context.userProfile
      ? { ...session.context.userProfile, ...context.userProfile }
      : session.context.userProfile,
    systemState: context.systemState
      ? { ...session.context.systemState, ...context.systemState }
      : session.context.systemState,
  };
  session.lastActiveAt = new Date().toISOString();
  return session;
}

export function deleteSession(sessionId: string): boolean {
  return sessions.delete(sessionId);
}

export function listSessions(): Session[] {
  return Array.from(sessions.values());
}

/** Restores a session into the in-memory store (used by state hydration). */
export function restoreSession(session: Session): void {
  sessions.set(session.id, {
    ...session,
    context: {
      ...session.context,
      userProfile: session.context.userProfile
        ? { ...session.context.userProfile }
        : session.context.userProfile,
      systemState: session.context.systemState
        ? { ...session.context.systemState }
        : session.context.systemState,
    },
  });
}
