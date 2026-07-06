import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  JOURNEY_GUIDE_RESET_EVENT,
  JOURNEY_GUIDE_STORAGE_KEY,
  clearJourneyGuideState,
  readJourneyGuideState,
} from '@/lib/journey-guide/storage';

describe('clearJourneyGuideState', () => {
  const storage = new Map<string, string>();
  const listeners = new Map<string, Set<EventListener>>();

  beforeEach(() => {
    storage.clear();
    listeners.clear();

    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    });

    vi.stubGlobal('window', {
      localStorage: globalThis.localStorage,
      dispatchEvent: (event: Event) => {
        const set = listeners.get(event.type);
        set?.forEach((listener) => listener(event));
      },
      addEventListener: (type: string, listener: EventListener) => {
        if (!listeners.has(type)) {
          listeners.set(type, new Set());
        }
        listeners.get(type)!.add(listener);
      },
      removeEventListener: (type: string, listener: EventListener) => {
        listeners.get(type)?.delete(listener);
      },
    });

    vi.stubGlobal('dispatchEvent', (event: Event) => {
      window.dispatchEvent(event);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('removes persisted guide state and dispatches reset event', () => {
    storage.set(
      JOURNEY_GUIDE_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        hasChosenMode: true,
        mode: 'guided',
        completedMissionIds: ['a'],
      })
    );

    let resetCount = 0;
    window.addEventListener(JOURNEY_GUIDE_RESET_EVENT, () => {
      resetCount += 1;
    });

    clearJourneyGuideState();

    expect(storage.has(JOURNEY_GUIDE_STORAGE_KEY)).toBe(false);
    expect(readJourneyGuideState().hasChosenMode).toBe(false);
    expect(resetCount).toBe(1);
  });
});
