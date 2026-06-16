export type FTUStep = 'insight' | 'surface' | 'actions' | 'complete';

export type FTUState = {
  step: FTUStep;
  isFirstTime: boolean;
};

const STORAGE_KEY = 'arrival_atlas_ftu_v1';

const FTU_SNAPSHOT_INSIGHT: FTUState = { isFirstTime: true, step: 'insight' };
const FTU_SNAPSHOT_SURFACE: FTUState = { isFirstTime: true, step: 'surface' };
const FTU_SNAPSHOT_ACTIONS: FTUState = { isFirstTime: true, step: 'actions' };
const FTU_SNAPSHOT_COMPLETE: FTUState = { isFirstTime: false, step: 'complete' };

const FTU_SERVER_SNAPSHOT = FTU_SNAPSHOT_INSIGHT;

type StoredFTU = {
  completed: boolean;
  lastStep?: 'insight' | 'surface' | 'actions';
};

const ftuListeners = new Set<() => void>();

function notifyFTUListeners(): void {
  ftuListeners.forEach((listener) => listener());
}

export function subscribeFTUStore(listener: () => void): () => void {
  ftuListeners.add(listener);
  return () => ftuListeners.delete(listener);
}

export function getFTUServerSnapshot(): FTUState {
  return FTU_SERVER_SNAPSHOT;
}

function readFTUStateFromStorage(): FTUState {
  const stored = readStoredFTU();

  if (!stored) {
    return FTU_SNAPSHOT_INSIGHT;
  }

  if (stored.completed) {
    return FTU_SNAPSHOT_COMPLETE;
  }

  if (stored.lastStep === 'actions') {
    return FTU_SNAPSHOT_ACTIONS;
  }

  if (stored.lastStep === 'surface') {
    return FTU_SNAPSHOT_SURFACE;
  }

  return FTU_SNAPSHOT_INSIGHT;
}

let cachedClientSnapshot: FTUState = FTU_SERVER_SNAPSHOT;

function syncClientSnapshot(): FTUState {
  const next = readFTUStateFromStorage();
  if (next !== cachedClientSnapshot) {
    cachedClientSnapshot = next;
  }
  return cachedClientSnapshot;
}

export function getFTUSnapshot(): FTUState {
  if (typeof window !== 'undefined') {
    syncClientSnapshot();
  }
  return cachedClientSnapshot;
}

function readStoredFTU(): StoredFTU | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredFTU;
  } catch {
    return null;
  }
}

function writeStoredFTU(value: StoredFTU): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  syncClientSnapshot();
  notifyFTUListeners();
}

export function getFTUState(): FTUState {
  if (typeof window !== 'undefined') {
    return syncClientSnapshot();
  }

  return FTU_SERVER_SNAPSHOT;
}

export function advanceFTUStep(current: FTUState): FTUState {
  if (!current.isFirstTime || current.step === 'complete') {
    return current;
  }

  switch (current.step) {
    case 'insight':
      writeStoredFTU({ completed: false, lastStep: 'surface' });
      return FTU_SNAPSHOT_SURFACE;
    case 'surface':
      writeStoredFTU({ completed: false, lastStep: 'actions' });
      return FTU_SNAPSHOT_ACTIONS;
    case 'actions':
      markFTUComplete();
      return FTU_SNAPSHOT_COMPLETE;
    default:
      return current;
  }
}

export function markFTUComplete(): void {
  writeStoredFTU({ completed: true, lastStep: 'actions' });
}

export function getFTUStepNumber(step: FTUStep): number {
  switch (step) {
    case 'insight':
      return 1;
    case 'surface':
      return 2;
    case 'actions':
      return 3;
    default:
      return 3;
  }
}

export function getFTUCtaLabel(step: FTUStep): string {
  switch (step) {
    case 'insight':
      return 'Show my situation';
    case 'surface':
      return 'Show my next steps';
    case 'actions':
      return 'Explore modules';
    default:
      return 'Continue';
  }
}

export function getFTUStepDescription(step: FTUStep): string {
  switch (step) {
    case 'insight':
      return 'Understand why Arrive Atlas is recommending actions for your situation in Germany.';
    case 'surface':
      return 'See a concise snapshot of where you stand across registration, insurance, and benefits.';
    case 'actions':
      return 'Review your prioritized next steps before exploring individual modules.';
    default:
      return '';
  }
}
