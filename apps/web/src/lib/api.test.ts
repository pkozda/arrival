import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SESSION_STORAGE_KEY,
  TOKEN_STORAGE_KEY,
  buildAuthHeaders,
  createSession,
  ensureSession,
  isSessionValid,
  readStoredToken,
  updateSessionLanguage,
  writeStoredSessionAuth,
} from './api.js';

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
}

describe('buildAuthHeaders', () => {
  beforeEach(() => {
    storage.clear();
    installBrowserStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('includes Bearer token when token exists', () => {
    writeStoredSessionAuth('sess_1', 'token_abc');

    expect(buildAuthHeaders()).toEqual({
      Authorization: 'Bearer token_abc',
      'x-session-id': 'sess_1',
    });
  });

  it('includes legacy session header when only sessionId exists', () => {
    storage.set(SESSION_STORAGE_KEY, 'sess_legacy');

    expect(buildAuthHeaders()).toEqual({
      'x-session-id': 'sess_legacy',
    });
  });

  it('accepts explicit overrides', () => {
    expect(
      buildAuthHeaders({ sessionId: 'sess_x', token: 'token_x' })
    ).toEqual({
      Authorization: 'Bearer token_x',
      'x-session-id': 'sess_x',
    });
  });
});

describe('session auth persistence', () => {
  beforeEach(() => {
    storage.clear();
    installBrowserStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('persists sessionId and token from createSession', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({ sessionId: 'sess_new', token: 'token_new' }),
      })
    );

    const sessionId = await createSession({ userProfile: { language: 'en' } });

    expect(sessionId).toBe('sess_new');
    expect(storage.get(SESSION_STORAGE_KEY)).toBe('sess_new');
    expect(storage.get(TOKEN_STORAGE_KEY)).toBe('token_new');
    expect(readStoredToken()).toBe('token_new');
  });
});

describe('authenticated session API calls', () => {
  beforeEach(() => {
    storage.clear();
    installBrowserStorage();
    writeStoredSessionAuth('sess_1', 'token_1');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('validates session with auth headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await expect(isSessionValid('sess_1')).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/sessions/sess_1',
      {
        headers: {
          Authorization: 'Bearer token_1',
          'x-session-id': 'sess_1',
        },
      }
    );
  });

  it('patches session with auth headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await updateSessionLanguage('sess_1', 'de');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/sessions/sess_1',
      expect.objectContaining({
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token_1',
          'x-session-id': 'sess_1',
        },
      })
    );
  });

  it('ensureSession reuses stored session when validation succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        json: async () => ({ sessionId: 'sess_new', token: 'token_new' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(ensureSession()).resolves.toEqual({
      sessionId: 'sess_1',
      outcome: 'existing',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/sessions/sess_1',
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer token_1',
          'x-session-id': 'sess_1',
        },
      })
    );
  });

  it('ensureSession creates a new session when validation fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        json: async () => ({ sessionId: 'sess_new', token: 'token_new' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(ensureSession()).resolves.toEqual({
      sessionId: 'sess_new',
      outcome: 'recreated',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(storage.get(SESSION_STORAGE_KEY)).toBe('sess_new');
    expect(storage.get(TOKEN_STORAGE_KEY)).toBe('token_new');
  });

  it('ensureSession creates a first session when none is stored', async () => {
    storage.clear();

    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ sessionId: 'sess_first', token: 'token_first' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(ensureSession()).resolves.toEqual({
      sessionId: 'sess_first',
      outcome: 'created',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
