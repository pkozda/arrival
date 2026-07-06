/** Demo exploration flag — shared across tabs via localStorage (RB-A05). */
export const ATLAS_DEMO_STORAGE_KEY = 'arrival_atlas_demo_active';

/** Legacy per-tab key — migrated once then removed. */
export const ATLAS_DEMO_LEGACY_SESSION_KEY = 'arrival_atlas_home_authenticated';

/** Cross-tab signal that a full demo reset occurred (RB-A02). */
export const ATLAS_DEMO_RESET_BROADCAST_KEY = 'arrival_atlas_demo_reset_at';

/** Cross-tab lock while one tab owns a demo reset (RB-A02 follow-up). */
export const ATLAS_DEMO_RESET_OWNER_KEY = 'arrival_atlas_demo_reset_owner';

/** Per-tab id for reset ownership claims. */
export const ATLAS_DEMO_RESET_TAB_ID_KEY = 'arrival_atlas_demo_reset_tab_id';

export const ATLAS_DEMO_RESET_OWNER_TTL_MS = 12_000;

export type AtlasDemoResetBroadcast = {
  at: string;
  sessionId: string;
};

export type AtlasDemoResetOwnership = {
  ownerId: string;
  startedAt: number;
};

function getLocalStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function getSessionStorage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

export function readAtlasDemoActive(): boolean {
  const local = getLocalStorage();
  const session = getSessionStorage();
  if (!local) {
    return false;
  }

  try {
    const stored = local.getItem(ATLAS_DEMO_STORAGE_KEY);
    if (stored === '1') {
      return true;
    }
    if (stored === '0') {
      return false;
    }

    if (session) {
      const legacy = session.getItem(ATLAS_DEMO_LEGACY_SESSION_KEY);
      if (legacy === '1') {
        local.setItem(ATLAS_DEMO_STORAGE_KEY, '1');
        session.removeItem(ATLAS_DEMO_LEGACY_SESSION_KEY);
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}

/** Synchronous demo state read for provider initialization (R5). */
export const readAtlasDemoState = readAtlasDemoActive;

export function writeAtlasDemoActive(active: boolean): void {
  const local = getLocalStorage();
  const session = getSessionStorage();
  if (!local) {
    return;
  }

  try {
    if (active) {
      local.setItem(ATLAS_DEMO_STORAGE_KEY, '1');
    } else {
      local.removeItem(ATLAS_DEMO_STORAGE_KEY);
    }
    session?.removeItem(ATLAS_DEMO_LEGACY_SESSION_KEY);
  } catch {
    // ignore quota / private mode
  }
}

export function parseAtlasDemoResetBroadcast(
  value: string | null | undefined
): AtlasDemoResetBroadcast | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<AtlasDemoResetBroadcast>;
    if (parsed.at && parsed.sessionId) {
      return { at: parsed.at, sessionId: parsed.sessionId };
    }
  } catch {
    // ignore legacy or malformed payloads
  }

  return null;
}

export function broadcastAtlasDemoReset(sessionId: string): string {
  const payload: AtlasDemoResetBroadcast = {
    at: String(Date.now()),
    sessionId,
  };
  const serialized = JSON.stringify(payload);

  try {
    const local = getLocalStorage();
    local?.setItem(ATLAS_DEMO_RESET_BROADCAST_KEY, serialized);
  } catch {
    // ignore
  }

  return serialized;
}

function readRawResetOwnershipLock(): AtlasDemoResetOwnership | null {
  const local = getLocalStorage();
  if (!local) {
    return null;
  }

  try {
    const raw = local.getItem(ATLAS_DEMO_RESET_OWNER_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<AtlasDemoResetOwnership>;
    if (!parsed.ownerId || typeof parsed.startedAt !== 'number') {
      return null;
    }

    return {
      ownerId: parsed.ownerId,
      startedAt: parsed.startedAt,
    };
  } catch {
    return null;
  }
}

export function readResetOwnershipLock(): AtlasDemoResetOwnership | null {
  const lock = readRawResetOwnershipLock();
  if (!lock) {
    return null;
  }

  if (Date.now() - lock.startedAt > ATLAS_DEMO_RESET_OWNER_TTL_MS) {
    clearResetOwnershipLock();
    return null;
  }

  return lock;
}

export function clearResetOwnershipLock(): void {
  try {
    getLocalStorage()?.removeItem(ATLAS_DEMO_RESET_OWNER_KEY);
  } catch {
    // ignore
  }
}

export function getDemoResetTabId(): string {
  const session = getSessionStorage();
  if (!session) {
    return `tab_${Date.now()}`;
  }

  try {
    const existing = session.getItem(ATLAS_DEMO_RESET_TAB_ID_KEY);
    if (existing) {
      return existing;
    }

    const tabId = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    session.setItem(ATLAS_DEMO_RESET_TAB_ID_KEY, tabId);
    return tabId;
  } catch {
    return `tab_${Date.now()}`;
  }
}

/** Returns true when this tab becomes the reset owner. */
export function attemptAcquireResetOwnership(ownerId: string): boolean {
  const local = getLocalStorage();
  if (!local) {
    return true;
  }

  const existing = readResetOwnershipLock();
  if (existing && existing.ownerId !== ownerId) {
    return false;
  }

  const claim: AtlasDemoResetOwnership = {
    ownerId,
    startedAt: Date.now(),
  };

  try {
    local.setItem(ATLAS_DEMO_RESET_OWNER_KEY, JSON.stringify(claim));
    return readRawResetOwnershipLock()?.ownerId === ownerId;
  } catch {
    return false;
  }
}

export function readLatestDemoResetBroadcast(): AtlasDemoResetBroadcast | null {
  try {
    return parseAtlasDemoResetBroadcast(
      getLocalStorage()?.getItem(ATLAS_DEMO_RESET_BROADCAST_KEY) ?? null
    );
  } catch {
    return null;
  }
}

function isBroadcastComplete(
  broadcast: AtlasDemoResetBroadcast | null,
  afterStartedAt?: number
): broadcast is AtlasDemoResetBroadcast {
  if (!broadcast) {
    return false;
  }

  if (afterStartedAt === undefined) {
    return true;
  }

  return Number(broadcast.at) >= afterStartedAt;
}

/** Waits for the owner broadcast without polling. */
export function waitForDemoResetBroadcastCompletion(options?: {
  afterStartedAt?: number;
}): Promise<AtlasDemoResetBroadcast | null> {
  if (typeof window === 'undefined') {
    return Promise.resolve(null);
  }

  const immediate = readLatestDemoResetBroadcast();
  if (isBroadcastComplete(immediate, options?.afterStartedAt)) {
    return Promise.resolve(immediate);
  }

  return new Promise((resolve) => {
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === ATLAS_DEMO_RESET_BROADCAST_KEY &&
        event.newValue &&
        isBroadcastComplete(parseAtlasDemoResetBroadcast(event.newValue), options?.afterStartedAt)
      ) {
        window.removeEventListener('storage', onStorage);
        resolve(parseAtlasDemoResetBroadcast(event.newValue));
        return;
      }

      if (event.key === ATLAS_DEMO_RESET_OWNER_KEY && !event.newValue) {
        const broadcast = readLatestDemoResetBroadcast();
        if (isBroadcastComplete(broadcast, options?.afterStartedAt)) {
          window.removeEventListener('storage', onStorage);
          resolve(broadcast);
        }
      }
    };

    window.addEventListener('storage', onStorage);
  });
}
