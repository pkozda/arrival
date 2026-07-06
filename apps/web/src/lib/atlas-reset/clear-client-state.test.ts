import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAtlasClientPersistedState } from '@/lib/atlas-reset/clear-client-state';
import { JOURNEY_GUIDE_STORAGE_KEY } from '@/lib/journey-guide/storage';
import { DISPLAY_LANGUAGE_STORAGE_KEY } from '@/lib/i18n/display-language';
import { ONBOARDING_DISMISS_STORAGE_KEY } from '@/lib/situation-utils';
import { CELESTIAL_ARRIVAL_STORAGE_KEY } from '@/lib/celestial/arrival-storage';
import { spatialMemoryStore } from '@/lib/atlas-runtime/spatial-memory-store';

describe('clearAtlasClientPersistedState', () => {
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

    spatialMemoryStore.recordNavigation('/', '/profile', 'profile', 'forward');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    spatialMemoryStore.reset();
  });

  it('clears demo-owned persisted keys and runtime caches', () => {
    local.set(JOURNEY_GUIDE_STORAGE_KEY, '{"version":1}');
    local.set(DISPLAY_LANGUAGE_STORAGE_KEY, 'de');
    local.set(ONBOARDING_DISMISS_STORAGE_KEY, 'true');
    session.set(CELESTIAL_ARRIVAL_STORAGE_KEY, '{}');

    clearAtlasClientPersistedState();

    expect(local.has(JOURNEY_GUIDE_STORAGE_KEY)).toBe(false);
    expect(local.has(DISPLAY_LANGUAGE_STORAGE_KEY)).toBe(false);
    expect(local.has(ONBOARDING_DISMISS_STORAGE_KEY)).toBe(false);
    expect(session.has(CELESTIAL_ARRIVAL_STORAGE_KEY)).toBe(false);
    expect(spatialMemoryStore.getSnapshot().routeStack).toEqual([]);
  });
});
