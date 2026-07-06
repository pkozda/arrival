import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSION_STORAGE_KEY } from '@/lib/api';
import {
  ATLAS_DEMO_RESET_BROADCAST_KEY,
  attemptAcquireResetOwnership,
  broadcastAtlasDemoReset,
  clearResetOwnershipLock,
  parseAtlasDemoResetBroadcast,
} from '@/components/atlas-home/atlas-demo-state';
import {
  adoptAtlasSessionAfterDemoReset,
  resetAtlasSession,
} from '@/lib/dev-tools/reset-user-data';

const createSessionMock = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    createSession: (...args: unknown[]) => createSessionMock(...args),
  };
});

describe('demo reset cross-tab synchronization', () => {
  const local = new Map<string, string>();

  beforeEach(() => {
    local.clear();
    createSessionMock.mockReset();
    createSessionMock.mockImplementation(async () => {
      local.set(SESSION_STORAGE_KEY, 'sess_owner');
      return 'sess_owner';
    });

    vi.stubGlobal('localStorage', {
      getItem: (key: string) => local.get(key) ?? null,
      setItem: (key: string, value: string) => {
        local.set(key, value);
      },
      removeItem: (key: string) => {
        local.delete(key);
      },
    });
    vi.stubGlobal('window', {
      localStorage: globalThis.localStorage,
    });
    vi.stubGlobal('sessionStorage', {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    vi.stubGlobal('dispatchEvent', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('creates exactly one session when owner resets and follower adopts', async () => {
    local.set(SESSION_STORAGE_KEY, 'sess_stale');

    const ownerSessionId = await resetAtlasSession({
      sessionId: 'sess_stale',
      language: 'en',
      theme: 'dark',
    });
    const broadcast = broadcastAtlasDemoReset(ownerSessionId);
    const payload = parseAtlasDemoResetBroadcast(broadcast);

    expect(createSessionMock).toHaveBeenCalledTimes(1);
    expect(ownerSessionId).toBe('sess_owner');
    expect(payload?.sessionId).toBe('sess_owner');

    local.set(SESSION_STORAGE_KEY, 'sess_owner');
    const followerSessionId = adoptAtlasSessionAfterDemoReset(payload!.sessionId);

    expect(createSessionMock).toHaveBeenCalledTimes(1);
    expect(followerSessionId).toBe('sess_owner');
    expect(local.get(SESSION_STORAGE_KEY)).toBe('sess_owner');
    expect(local.get(ATLAS_DEMO_RESET_BROADCAST_KEY)).toBe(broadcast);
  });

  it('follower converges to owner session id when local storage is stale', () => {
    local.set(SESSION_STORAGE_KEY, 'sess_stale');

    const followerSessionId = adoptAtlasSessionAfterDemoReset('sess_owner');

    expect(createSessionMock).not.toHaveBeenCalled();
    expect(followerSessionId).toBe('sess_owner');
    expect(local.get(SESSION_STORAGE_KEY)).toBe('sess_owner');
  });

  it('creates only one session when two tabs attempt to become owner', async () => {
    local.set(SESSION_STORAGE_KEY, 'sess_stale');

    const acquiredA = attemptAcquireResetOwnership('tab_a');
    const acquiredB = attemptAcquireResetOwnership('tab_b');

    expect(acquiredA).toBe(true);
    expect(acquiredB).toBe(false);

    if (acquiredA) {
      const ownerSessionId = await resetAtlasSession({
        sessionId: 'sess_stale',
        language: 'en',
        theme: 'dark',
      });
      broadcastAtlasDemoReset(ownerSessionId);
      clearResetOwnershipLock();
    }

    const broadcast = parseAtlasDemoResetBroadcast(local.get(ATLAS_DEMO_RESET_BROADCAST_KEY)!);
    const followerSessionId = adoptAtlasSessionAfterDemoReset(broadcast!.sessionId);

    expect(createSessionMock).toHaveBeenCalledTimes(1);
    expect(followerSessionId).toBe('sess_owner');
  });
});
