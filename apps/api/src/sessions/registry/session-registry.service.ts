import {
  createRegistryEvent,
  getSessionRegistryStore,
  type SessionRegistryStore,
} from './session-registry.store.js';
import type { AccountSession, SessionRegistryEvent } from './session-registry.types.js';

export class SessionRevokedError extends Error {
  constructor(sessionId: string) {
    super(`Session revoked: ${sessionId}`);
    this.name = 'SessionRevokedError';
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

export type SessionRegistrationMetadata = {
  userAgent?: string;
};

export class SessionRegistryService {
  private get store(): SessionRegistryStore {
    return getSessionRegistryStore();
  }

  async registerSession(
    accountId: string,
    sessionId: string,
    metadata: SessionRegistrationMetadata = {}
  ): Promise<AccountSession> {
    const existing = await this.store.getSessionRecord(sessionId);
    if (existing) {
      if (existing.accountId !== accountId) {
        throw new Error(`Session ${sessionId} belongs to a different account`);
      }
      if (existing.status === 'revoked') {
        throw new SessionRevokedError(sessionId);
      }
      return existing;
    }

    const timestamp = nowIso();
    const session: AccountSession = {
      sessionId,
      accountId,
      userAgent: metadata.userAgent,
      createdAt: timestamp,
      lastSeenAt: timestamp,
      revokedAt: null,
      status: 'active',
    };

    await this.store.createSessionRecord(session);
    await this.store.appendEvent(
      createRegistryEvent({
        type: 'session.created',
        sessionId,
        accountId,
        payload: metadata.userAgent ? { userAgent: metadata.userAgent } : undefined,
      })
    );

    return session;
  }

  async revokeSession(sessionId: string): Promise<AccountSession | null> {
    const revokedAt = nowIso();
    const session = await this.store.revokeSession(sessionId, revokedAt);
    if (!session) {
      return null;
    }

    await this.store.appendEvent(
      createRegistryEvent({
        type: 'session.revoked',
        sessionId,
        accountId: session.accountId,
      })
    );

    return session;
  }

  async revokeAccountSessions(accountId: string): Promise<AccountSession[]> {
    const revokedAt = nowIso();
    const sessions = await this.store.revokeAllSessions(accountId, revokedAt);

    await Promise.all(
      sessions.map((session) =>
        this.store.appendEvent(
          createRegistryEvent({
            type: 'session.revoked',
            sessionId: session.sessionId,
            accountId,
            payload: { bulk: true },
          })
        )
      )
    );

    return sessions;
  }

  async listAccountSessions(accountId: string): Promise<AccountSession[]> {
    return this.store.getSessionsByAccount(accountId);
  }

  async getSessionRecord(sessionId: string): Promise<AccountSession | null> {
    return this.store.getSessionRecord(sessionId);
  }

  async getAccountEvents(accountId: string): Promise<SessionRegistryEvent[]> {
    return this.store.getEventsByAccount(accountId);
  }
}

export const sessionRegistryService = new SessionRegistryService();
