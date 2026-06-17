import {
  createRegistryEvent,
  getSessionRegistryStore,
} from './registry/session-registry.store.js';
import {
  sessionRegistryService,
  type SessionRegistrationMetadata,
} from './registry/session-registry.service.js';
import type { AccountSession } from './registry/session-registry.types.js';

function nowIso(): string {
  return new Date().toISOString();
}

export async function ensureSessionRegistered(params: {
  sessionId: string;
  accountId: string;
  userAgent?: string;
}): Promise<{ session: AccountSession; created: boolean }> {
  const existing = await sessionRegistryService.getSessionRecord(params.sessionId);
  if (existing) {
    return { session: existing, created: false };
  }

  const metadata: SessionRegistrationMetadata = params.userAgent
    ? { userAgent: params.userAgent }
    : {};

  const session = await sessionRegistryService.registerSession(
    params.accountId,
    params.sessionId,
    metadata
  );

  return { session, created: true };
}

export async function touchSessionLastSeen(params: {
  sessionId: string;
  accountId: string;
}): Promise<void> {
  const store = getSessionRegistryStore();
  const updated = await store.updateLastSeen(params.sessionId, nowIso());

  if (!updated) {
    return;
  }

  await store.appendEvent(
    createRegistryEvent({
      type: 'session.lastSeenUpdated',
      sessionId: params.sessionId,
      accountId: params.accountId,
    })
  );
}
