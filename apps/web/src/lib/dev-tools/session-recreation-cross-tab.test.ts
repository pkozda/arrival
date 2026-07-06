import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSION_STORAGE_KEY } from '@/lib/api';
import {
  broadcastSessionRecreated,
  parseSessionRecreatedBroadcast,
  resolveSessionRecreatedBroadcastFollow,
  SESSION_RECREATED_BROADCAST_KEY,
} from '@/lib/session-recreation-notice';
import { adoptRecreatedSessionId } from '@/lib/dev-tools/reset-user-data';

const createSessionMock = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    createSession: (...args: unknown[]) => createSessionMock(...args),
  };
});

describe('session recreation cross-tab synchronization', () => {
  const local = new Map<string, string>();

  beforeEach(() => {
    local.clear();
    createSessionMock.mockReset();

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
    vi.stubGlobal('dispatchEvent', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('broadcasts recreated session for follower adoption', () => {
    local.set(SESSION_STORAGE_KEY, 'sess_new');

    const serialized = broadcastSessionRecreated('sess_new');
    const payload = parseSessionRecreatedBroadcast(serialized);

    expect(payload).toEqual({
      at: expect.any(String),
      sessionId: 'sess_new',
    });
    expect(local.get(SESSION_RECREATED_BROADCAST_KEY)).toBe(serialized);
  });

  it('lets follower adopt owner session without creating another session', () => {
    local.set(SESSION_STORAGE_KEY, 'sess_stale');

    const serialized = broadcastSessionRecreated('sess_new');
    const payload = resolveSessionRecreatedBroadcastFollow({
      broadcastValue: serialized,
      lastSeenBroadcastValue: null,
      currentSessionId: 'sess_stale',
    });

    expect(payload?.sessionId).toBe('sess_new');
    expect(adoptRecreatedSessionId(payload!.sessionId)).toBe('sess_new');
    expect(createSessionMock).not.toHaveBeenCalled();
    expect(local.get(SESSION_STORAGE_KEY)).toBe('sess_new');
  });

  it('ignores duplicate broadcasts and already-adopted session ids', () => {
    const serialized = broadcastSessionRecreated('sess_new');

    expect(
      resolveSessionRecreatedBroadcastFollow({
        broadcastValue: serialized,
        lastSeenBroadcastValue: serialized,
        currentSessionId: 'sess_stale',
      })
    ).toBeNull();

    expect(
      resolveSessionRecreatedBroadcastFollow({
        broadcastValue: serialized,
        lastSeenBroadcastValue: null,
        currentSessionId: 'sess_new',
      })
    ).toBeNull();
  });
});
