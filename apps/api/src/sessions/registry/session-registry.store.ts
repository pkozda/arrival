import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  AccountSession,
  AccountSessionIndex,
  SessionRegistryEvent,
} from './session-registry.types.js';

export interface SessionRegistryStore {
  createSessionRecord(session: AccountSession): Promise<void>;
  getSessionRecord(sessionId: string): Promise<AccountSession | null>;
  updateSessionRecord(session: AccountSession): Promise<void>;
  getSessionsByAccount(accountId: string): Promise<AccountSession[]>;
  revokeSession(sessionId: string, revokedAt: string): Promise<AccountSession | null>;
  revokeAllSessions(accountId: string, revokedAt: string): Promise<AccountSession[]>;
  updateLastSeen(sessionId: string, lastSeenAt: string): Promise<AccountSession | null>;
  appendEvent(event: SessionRegistryEvent): Promise<void>;
  getEventsByAccount(accountId: string): Promise<SessionRegistryEvent[]>;
  clear(): Promise<void>;
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export class FileSessionRegistryStore implements SessionRegistryStore {
  constructor(private readonly rootDir: string) {}

  private sessionsDir(): string {
    return path.join(this.rootDir, 'sessions');
  }

  private accountsDir(): string {
    return path.join(this.rootDir, 'accounts');
  }

  private eventsDir(): string {
    return path.join(this.rootDir, 'events');
  }

  private sessionPath(sessionId: string): string {
    return path.join(this.sessionsDir(), `${safeId(sessionId)}.json`);
  }

  private accountIndexPath(accountId: string): string {
    return path.join(this.accountsDir(), `${safeId(accountId)}.json`);
  }

  private eventsPath(accountId: string): string {
    return path.join(this.eventsDir(), `${safeId(accountId)}.json`);
  }

  private async ensureDirs(): Promise<void> {
    await mkdir(this.sessionsDir(), { recursive: true });
    await mkdir(this.accountsDir(), { recursive: true });
    await mkdir(this.eventsDir(), { recursive: true });
  }

  private async readAccountIndex(accountId: string): Promise<AccountSessionIndex> {
    try {
      const raw = await readFile(this.accountIndexPath(accountId), 'utf8');
      return JSON.parse(raw) as AccountSessionIndex;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { accountId, sessionIds: [] };
      }
      throw error;
    }
  }

  private async writeAccountIndex(index: AccountSessionIndex): Promise<void> {
    await this.ensureDirs();
    await writeFile(this.accountIndexPath(index.accountId), JSON.stringify(index), 'utf8');
  }

  async createSessionRecord(session: AccountSession): Promise<void> {
    await this.ensureDirs();
    const existing = await this.getSessionRecord(session.sessionId);
    if (existing) {
      throw new Error(`Session record already exists: ${session.sessionId}`);
    }

    await writeFile(this.sessionPath(session.sessionId), JSON.stringify(session), 'utf8');

    const index = await this.readAccountIndex(session.accountId);
    if (!index.sessionIds.includes(session.sessionId)) {
      index.sessionIds.push(session.sessionId);
      await this.writeAccountIndex(index);
    }
  }

  async getSessionRecord(sessionId: string): Promise<AccountSession | null> {
    try {
      const raw = await readFile(this.sessionPath(sessionId), 'utf8');
      return JSON.parse(raw) as AccountSession;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async updateSessionRecord(session: AccountSession): Promise<void> {
    const existing = await this.getSessionRecord(session.sessionId);
    if (!existing) {
      throw new Error(`Session record not found: ${session.sessionId}`);
    }
    await this.ensureDirs();
    await writeFile(this.sessionPath(session.sessionId), JSON.stringify(session), 'utf8');
  }

  async getSessionsByAccount(accountId: string): Promise<AccountSession[]> {
    const index = await this.readAccountIndex(accountId);
    const sessions = await Promise.all(
      index.sessionIds.map((sessionId) => this.getSessionRecord(sessionId))
    );
    return sessions.filter((session): session is AccountSession => session !== null);
  }

  async revokeSession(sessionId: string, revokedAt: string): Promise<AccountSession | null> {
    const session = await this.getSessionRecord(sessionId);
    if (!session) {
      return null;
    }

    const revoked: AccountSession = {
      ...session,
      status: 'revoked',
      revokedAt,
    };
    await this.updateSessionRecord(revoked);
    return revoked;
  }

  async revokeAllSessions(accountId: string, revokedAt: string): Promise<AccountSession[]> {
    const sessions = await this.getSessionsByAccount(accountId);
    const revoked: AccountSession[] = [];

    for (const session of sessions) {
      if (session.status === 'active') {
        const updated = await this.revokeSession(session.sessionId, revokedAt);
        if (updated) {
          revoked.push(updated);
        }
      }
    }

    return revoked;
  }

  async updateLastSeen(sessionId: string, lastSeenAt: string): Promise<AccountSession | null> {
    const session = await this.getSessionRecord(sessionId);
    if (!session) {
      return null;
    }

    const updated: AccountSession = {
      ...session,
      lastSeenAt,
    };
    await this.updateSessionRecord(updated);
    return updated;
  }

  async appendEvent(event: SessionRegistryEvent): Promise<void> {
    await this.ensureDirs();
    const events = await this.getEventsByAccount(event.accountId);
    events.push(event);
    await writeFile(this.eventsPath(event.accountId), JSON.stringify(events), 'utf8');
  }

  async getEventsByAccount(accountId: string): Promise<SessionRegistryEvent[]> {
    try {
      const raw = await readFile(this.eventsPath(accountId), 'utf8');
      return JSON.parse(raw) as SessionRegistryEvent[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async clear(): Promise<void> {
    for (const dir of [this.sessionsDir(), this.accountsDir(), this.eventsDir()]) {
      try {
        const entries = await readdir(dir);
        await Promise.all(entries.map((entry) => rm(path.join(dir, entry))));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }
    }
  }
}

let activeStore: SessionRegistryStore | null = null;

export function getSessionRegistryStore(): SessionRegistryStore {
  if (!activeStore) {
    const rootDir =
      process.env.ARRIVALOS_SESSIONS_DIR ?? path.join(process.cwd(), '.arrivalos-sessions');
    activeStore = new FileSessionRegistryStore(rootDir);
  }
  return activeStore;
}

export function resetSessionRegistryStore(store: SessionRegistryStore): void {
  activeStore = store;
}

export function createRegistryEvent(params: {
  type: SessionRegistryEvent['type'];
  sessionId: string;
  accountId: string;
  payload?: Record<string, unknown>;
}): SessionRegistryEvent {
  return {
    id: randomUUID(),
    type: params.type,
    sessionId: params.sessionId,
    accountId: params.accountId,
    timestamp: new Date().toISOString(),
    ...(params.payload ? { payload: params.payload } : {}),
  };
}
