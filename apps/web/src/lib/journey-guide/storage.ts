import type { AssistanceStage, JourneyGuideMode, JourneyGuidePersistedState } from './types';

export const JOURNEY_GUIDE_STORAGE_KEY = 'arrival-atlas-journey-guide-v1';

const DEFAULT_STATE: JourneyGuidePersistedState = {
  version: 1,
  hasChosenMode: false,
  mode: 'guided',
  assistanceStage: 1,
  completedMissionIds: [],
  lockedClickCount: 0,
  lastActiveAt: null,
  dismissedWelcomeSurfaces: [],
};

export function readJourneyGuideState(): JourneyGuidePersistedState {
  if (typeof window === 'undefined') {
    return DEFAULT_STATE;
  }

  try {
    const raw = window.localStorage.getItem(JOURNEY_GUIDE_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_STATE;
    }
    const parsed = JSON.parse(raw) as Partial<JourneyGuidePersistedState>;
    return {
      ...DEFAULT_STATE,
      ...parsed,
      version: 1,
      completedMissionIds: parsed.completedMissionIds ?? [],
      dismissedWelcomeSurfaces: parsed.dismissedWelcomeSurfaces ?? [],
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function writeJourneyGuideState(state: JourneyGuidePersistedState): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(JOURNEY_GUIDE_STORAGE_KEY, JSON.stringify(state));
}

export function persistGuideMode(mode: JourneyGuideMode): JourneyGuidePersistedState {
  const next = {
    ...readJourneyGuideState(),
    hasChosenMode: true,
    mode,
    lastActiveAt: new Date().toISOString(),
  };
  writeJourneyGuideState(next);
  return next;
}

export function persistWelcomeDismissed(surfaceId: string): JourneyGuidePersistedState {
  const current = readJourneyGuideState();
  const dismissed = new Set(current.dismissedWelcomeSurfaces);
  dismissed.add(surfaceId);
  const next = {
    ...current,
    dismissedWelcomeSurfaces: [...dismissed],
    lastActiveAt: new Date().toISOString(),
  };
  writeJourneyGuideState(next);
  return next;
}

export function persistMissionCompleted(nodeId: string): JourneyGuidePersistedState {
  const current = readJourneyGuideState();
  const completed = new Set(current.completedMissionIds);
  completed.add(nodeId);
  const next = {
    ...current,
    completedMissionIds: [...completed],
    lastActiveAt: new Date().toISOString(),
  };
  writeJourneyGuideState(next);
  return next;
}

export function persistLockedClick(): JourneyGuidePersistedState {
  const next = {
    ...readJourneyGuideState(),
    lockedClickCount: readJourneyGuideState().lockedClickCount + 1,
    lastActiveAt: new Date().toISOString(),
  };
  writeJourneyGuideState(next);
  return next;
}

export function deriveAssistanceStage(state: JourneyGuidePersistedState): AssistanceStage {
  const completed = state.completedMissionIds.length;
  if (!state.hasChosenMode || state.mode === 'independent') {
    return 4;
  }
  if (completed >= 8) {
    return 4;
  }
  if (completed >= 4) {
    return 3;
  }
  if (completed >= 1) {
    return 2;
  }
  return 1;
}
