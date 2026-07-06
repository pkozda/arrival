import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ATLAS_DEMO_LEGACY_SESSION_KEY,
  ATLAS_DEMO_RESET_BROADCAST_KEY,
  ATLAS_DEMO_STORAGE_KEY,
  broadcastAtlasDemoReset,
  parseAtlasDemoResetBroadcast,
  readAtlasDemoActive,
  writeAtlasDemoActive,
} from './atlas-demo-state';

describe('atlas-demo-state', () => {
  const local = new Map<string, string>();
  const session = new Map<string, string>();

  beforeEach(() => {
    local.clear();
    session.clear();
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads inactive when storage is empty', () => {
    expect(readAtlasDemoActive()).toBe(false);
  });

  it('reads active from localStorage', () => {
    local.set(ATLAS_DEMO_STORAGE_KEY, '1');
    expect(readAtlasDemoActive()).toBe(true);
  });

  it('migrates legacy sessionStorage flag to localStorage', () => {
    session.set(ATLAS_DEMO_LEGACY_SESSION_KEY, '1');
    expect(readAtlasDemoActive()).toBe(true);
    expect(local.get(ATLAS_DEMO_STORAGE_KEY)).toBe('1');
    expect(session.has(ATLAS_DEMO_LEGACY_SESSION_KEY)).toBe(false);
  });

  it('writeAtlasDemoActive clears legacy session key', () => {
    session.set(ATLAS_DEMO_LEGACY_SESSION_KEY, '1');
    writeAtlasDemoActive(false);
    expect(local.has(ATLAS_DEMO_STORAGE_KEY)).toBe(false);
    expect(session.has(ATLAS_DEMO_LEGACY_SESSION_KEY)).toBe(false);
  });

  it('broadcasts owner session id for follower adoption', () => {
    const serialized = broadcastAtlasDemoReset('sess_owner');

    expect(JSON.parse(serialized)).toEqual({
      at: expect.any(String),
      sessionId: 'sess_owner',
    });
    expect(local.get(ATLAS_DEMO_RESET_BROADCAST_KEY)).toBe(serialized);
    expect(parseAtlasDemoResetBroadcast(serialized)).toEqual({
      at: expect.any(String),
      sessionId: 'sess_owner',
    });
  });
});
