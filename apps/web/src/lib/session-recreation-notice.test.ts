import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acknowledgeSessionRecreatedNotice,
  markSessionRecreationNoticePending,
  readPendingSessionRecreationNoticeSessionId,
  resolveSessionRecreatedBroadcastFollow,
  shouldOpenSessionRecreatedNotice,
  shouldPresentSessionRecreatedNotice,
} from './session-recreation-notice.js';

const storage = new Map<string, string>();

function installBrowserStorage(): void {
  vi.stubGlobal('window', {} as Window);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
  });
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => storage.get(`session:${key}`) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(`session:${key}`, value);
    },
    removeItem: (key: string) => {
      storage.delete(`session:${key}`);
    },
  });
}

describe('session recreation notice', () => {
  beforeEach(() => {
    storage.clear();
    installBrowserStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('claims display for the first bootstrap in a recreation', () => {
    expect(shouldPresentSessionRecreatedNotice('sess_new')).toBe(true);
  });

  it('does not claim display twice for the same session id', () => {
    expect(shouldPresentSessionRecreatedNotice('sess_new')).toBe(true);
    expect(shouldPresentSessionRecreatedNotice('sess_new')).toBe(false);
  });

  it('does not present after acknowledgement in this tab', () => {
    markSessionRecreationNoticePending('sess_new');
    expect(shouldOpenSessionRecreatedNotice('sess_new', 'recreated')).toBe(true);

    acknowledgeSessionRecreatedNotice('sess_new');

    expect(shouldPresentSessionRecreatedNotice('sess_new')).toBe(false);
    expect(shouldOpenSessionRecreatedNotice('sess_new', 'existing')).toBe(false);
    expect(readPendingSessionRecreationNoticeSessionId()).toBeNull();
  });

  it('reopens after refresh before acknowledgement', () => {
    markSessionRecreationNoticePending('sess_new');
    expect(shouldOpenSessionRecreatedNotice('sess_new', 'recreated')).toBe(true);

    expect(shouldOpenSessionRecreatedNotice('sess_new', 'existing')).toBe(true);
    expect(readPendingSessionRecreationNoticeSessionId()).toBe('sess_new');
  });

  it('does not open on existing session without pending notice', () => {
    expect(shouldOpenSessionRecreatedNotice('sess_existing', 'existing')).toBe(false);
  });

  it('ignores duplicate session recreation broadcasts safely', () => {
    const serialized = JSON.stringify({ at: '1', sessionId: 'sess_new' });

    expect(
      resolveSessionRecreatedBroadcastFollow({
        broadcastValue: serialized,
        lastSeenBroadcastValue: serialized,
        currentSessionId: 'sess_old',
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
