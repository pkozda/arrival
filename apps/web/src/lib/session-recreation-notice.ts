const DISPLAY_CLAIM_KEY = 'arrival_atlas_session_recreated_display_claim';
const PENDING_NOTICE_KEY = 'arrival_atlas_session_recreated_pending';

export const SESSION_RECREATED_BROADCAST_KEY = 'arrival_atlas_session_recreated';

export type SessionRecreatedNoticeOutcome = 'existing' | 'created' | 'recreated';

export type SessionRecreatedBroadcast = {
  at: string;
  sessionId: string;
};

function tabAckKey(sessionId: string): string {
  return `arrival_atlas_session_recreated_ack_${sessionId}`;
}

export function markSessionRecreationNoticePending(sessionId: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(PENDING_NOTICE_KEY, sessionId);
  } catch {
    // ignore
  }
}

export function readPendingSessionRecreationNoticeSessionId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const value = localStorage.getItem(PENDING_NOTICE_KEY);
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

function clearPendingSessionRecreationNotice(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(PENDING_NOTICE_KEY);
  } catch {
    // ignore
  }
}

export function hasAcknowledgedSessionRecreatedNotice(sessionId: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return sessionStorage.getItem(tabAckKey(sessionId)) === '1';
  } catch {
    return false;
  }
}

/** Returns true when this bootstrap should present the recreation notice. */
export function shouldPresentSessionRecreatedNotice(sessionId: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    if (hasAcknowledgedSessionRecreatedNotice(sessionId)) {
      return false;
    }

    const existingClaim = localStorage.getItem(DISPLAY_CLAIM_KEY);
    if (existingClaim === sessionId) {
      return false;
    }

    localStorage.setItem(DISPLAY_CLAIM_KEY, sessionId);
    return localStorage.getItem(DISPLAY_CLAIM_KEY) === sessionId;
  } catch {
    return true;
  }
}

export function shouldOpenSessionRecreatedNotice(
  sessionId: string,
  outcome: SessionRecreatedNoticeOutcome
): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    if (hasAcknowledgedSessionRecreatedNotice(sessionId)) {
      return false;
    }

    if (readPendingSessionRecreationNoticeSessionId() !== sessionId) {
      return false;
    }

    if (outcome === 'existing') {
      return true;
    }

    if (outcome === 'recreated') {
      return shouldPresentSessionRecreatedNotice(sessionId);
    }

    return false;
  } catch {
    return outcome === 'recreated';
  }
}

export function acknowledgeSessionRecreatedNotice(sessionId: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    sessionStorage.setItem(tabAckKey(sessionId), '1');
    if (readPendingSessionRecreationNoticeSessionId() === sessionId) {
      clearPendingSessionRecreationNotice();
    }
  } catch {
    // ignore
  }
}

export function parseSessionRecreatedBroadcast(
  value: string | null | undefined
): SessionRecreatedBroadcast | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<SessionRecreatedBroadcast>;
    if (parsed.at && parsed.sessionId) {
      return { at: parsed.at, sessionId: parsed.sessionId };
    }
  } catch {
    // ignore malformed payloads
  }

  return null;
}

export function broadcastSessionRecreated(sessionId: string): string {
  const payload: SessionRecreatedBroadcast = {
    at: String(Date.now()),
    sessionId,
  };
  const serialized = JSON.stringify(payload);

  try {
    localStorage.setItem(SESSION_RECREATED_BROADCAST_KEY, serialized);
  } catch {
    // ignore
  }

  return serialized;
}

export function resolveSessionRecreatedBroadcastFollow(input: {
  broadcastValue: string;
  lastSeenBroadcastValue: string | null;
  currentSessionId: string | null;
}): SessionRecreatedBroadcast | null {
  if (input.lastSeenBroadcastValue === input.broadcastValue) {
    return null;
  }

  const payload = parseSessionRecreatedBroadcast(input.broadcastValue);
  if (!payload) {
    return null;
  }

  if (input.currentSessionId === payload.sessionId) {
    return null;
  }

  return payload;
}
