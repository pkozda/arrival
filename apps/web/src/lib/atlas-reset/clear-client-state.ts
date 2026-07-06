import { spatialMemoryStore } from '@/lib/atlas-runtime/spatial-memory-store';
import { CELESTIAL_ARRIVAL_STORAGE_KEY } from '@/lib/celestial/arrival-storage';
import { clearJourneyGuideState } from '@/lib/journey-guide/storage';
import { clearStoredDisplayLanguage } from '@/lib/i18n/display-language';
import { resetRuntimeSessionState } from '@/lib/life-event/runtime/runtime-store';
import { ONBOARDING_DISMISS_STORAGE_KEY } from '@/lib/situation-utils';
import { clearLegacyThemeStorage } from '@/lib/api';

function removeLocalStorageKey(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    // ignore
  }
}

function removeSessionStorageKey(key: string): void {
  try {
    globalThis.sessionStorage?.removeItem(key);
  } catch {
    // ignore
  }
}

/** Clears all client-owned persisted state for the current demo session. */
export function clearAtlasClientPersistedState(): void {
  if (typeof globalThis.localStorage === 'undefined') {
    return;
  }

  clearJourneyGuideState();
  clearStoredDisplayLanguage();
  removeLocalStorageKey(ONBOARDING_DISMISS_STORAGE_KEY);
  clearLegacyThemeStorage();
  removeSessionStorageKey(CELESTIAL_ARRIVAL_STORAGE_KEY);
  resetRuntimeSessionState();
  spatialMemoryStore.reset();
}
