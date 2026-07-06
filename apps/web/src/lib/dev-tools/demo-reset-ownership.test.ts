import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ATLAS_DEMO_RESET_BROADCAST_KEY,
  ATLAS_DEMO_RESET_OWNER_KEY,
  ATLAS_DEMO_RESET_OWNER_TTL_MS,
  ATLAS_DEMO_RESET_TAB_ID_KEY,
  attemptAcquireResetOwnership,
  broadcastAtlasDemoReset,
  clearResetOwnershipLock,
  getDemoResetTabId,
  readLatestDemoResetBroadcast,
  readResetOwnershipLock,
  waitForDemoResetBroadcastCompletion,
} from '@/components/atlas-home/atlas-demo-state';

describe('demo reset ownership lock', () => {
  const local = new Map<string, string>();
  const session = new Map<string, string>();
  const listeners = new Map<string, Set<(event: StorageEvent) => void>>();

  beforeEach(() => {
    local.clear();
    session.clear();
    listeners.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-05T12:00:00.000Z'));

    vi.stubGlobal('localStorage', {
      getItem: (key: string) => local.get(key) ?? null,
      setItem: (key: string, value: string) => {
        local.set(key, value);
      },
      removeItem: (key: string) => {
        local.delete(key);
      },
    });

    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => session.get(key) ?? null,
      setItem: (key: string, value: string) => {
        session.set(key, value);
      },
      removeItem: (key: string) => {
        session.delete(key);
      },
    });

    vi.stubGlobal('window', {
      localStorage: globalThis.localStorage,
      sessionStorage: globalThis.sessionStorage,
      addEventListener: (type: string, listener: (event: StorageEvent) => void) => {
        if (!listeners.has(type)) {
          listeners.set(type, new Set());
        }
        listeners.get(type)!.add(listener);
      },
      removeEventListener: (type: string, listener: (event: StorageEvent) => void) => {
        listeners.get(type)?.delete(listener);
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function dispatchStorage(key: string, newValue: string | null): void {
    const event = {
      key,
      newValue,
    } as StorageEvent;
    listeners.get('storage')?.forEach((listener) => listener(event));
  }

  it('allows only one owner when two tabs attempt simultaneously', () => {
    expect(attemptAcquireResetOwnership('tab_a')).toBe(true);
    expect(attemptAcquireResetOwnership('tab_b')).toBe(false);
    expect(readResetOwnershipLock()?.ownerId).toBe('tab_a');
  });

  it('lets the second tab follow the owner broadcast without acquiring ownership', async () => {
    expect(attemptAcquireResetOwnership('tab_a')).toBe(true);
    const lock = readResetOwnershipLock();
    expect(attemptAcquireResetOwnership('tab_b')).toBe(false);

    const waitPromise = waitForDemoResetBroadcastCompletion({
      afterStartedAt: lock?.startedAt,
    });

    broadcastAtlasDemoReset('sess_owner');
    clearResetOwnershipLock();
    dispatchStorage(ATLAS_DEMO_RESET_BROADCAST_KEY, local.get(ATLAS_DEMO_RESET_BROADCAST_KEY)!);

    await expect(waitPromise).resolves.toEqual({
      at: expect.any(String),
      sessionId: 'sess_owner',
    });
    expect(readLatestDemoResetBroadcast()?.sessionId).toBe('sess_owner');
  });

  it('expires stale ownership locks so a future reset can proceed', () => {
    local.set(
      ATLAS_DEMO_RESET_OWNER_KEY,
      JSON.stringify({
        ownerId: 'tab_old',
        startedAt: Date.now() - ATLAS_DEMO_RESET_OWNER_TTL_MS - 1,
      })
    );

    expect(readResetOwnershipLock()).toBeNull();
    expect(local.has(ATLAS_DEMO_RESET_OWNER_KEY)).toBe(false);
    expect(attemptAcquireResetOwnership('tab_new')).toBe(true);
  });

  it('keeps a stable per-tab owner id for normal single-tab leave demo', () => {
    session.set(ATLAS_DEMO_RESET_TAB_ID_KEY, 'tab_stable');
    expect(getDemoResetTabId()).toBe('tab_stable');
    expect(getDemoResetTabId()).toBe('tab_stable');
    expect(attemptAcquireResetOwnership('tab_stable')).toBe(true);
  });
});
