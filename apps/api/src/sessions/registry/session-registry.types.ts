export type AccountSessionStatus = 'active' | 'revoked';

export type AccountSession = {
  sessionId: string;
  accountId: string;
  userAgent?: string;
  createdAt: string;
  lastSeenAt: string;
  revokedAt?: string | null;
  status: AccountSessionStatus;
};

export type SessionRegistryEventType =
  | 'session.created'
  | 'session.revoked'
  | 'session.lastSeenUpdated';

export type SessionRegistryEvent = {
  id: string;
  type: SessionRegistryEventType;
  sessionId: string;
  accountId: string;
  timestamp: string;
  payload?: Record<string, unknown>;
};

export type AccountSessionIndex = {
  accountId: string;
  sessionIds: string[];
};
