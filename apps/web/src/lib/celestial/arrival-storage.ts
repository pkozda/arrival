import type { ArrivalContext, ArrivalContextInput } from './types';

export const CELESTIAL_ARRIVAL_STORAGE_KEY = 'arrival_celestial_pending_v1';

export function persistArrivalIntent(input: ArrivalContextInput): void {
  if (typeof sessionStorage === 'undefined') {
    return;
  }

  const payload: ArrivalContext = {
    ...input,
    entryAnimationState: input.entryAnimationState ?? 'pending',
    capturedAt: Date.now(),
  };

  sessionStorage.setItem(CELESTIAL_ARRIVAL_STORAGE_KEY, JSON.stringify(payload));
}

export function peekArrivalIntent(destinationPath: string): boolean {
  if (typeof sessionStorage === 'undefined') {
    return false;
  }

  const raw = sessionStorage.getItem(CELESTIAL_ARRIVAL_STORAGE_KEY);
  if (!raw) {
    return false;
  }

  try {
    const parsed = JSON.parse(raw) as ArrivalContext;
    return parsed.destinationPath === destinationPath;
  } catch {
    return false;
  }
}

export function consumeArrivalIntent(destinationPath: string): ArrivalContext | null {
  if (typeof sessionStorage === 'undefined') {
    return null;
  }

  const raw = sessionStorage.getItem(CELESTIAL_ARRIVAL_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as ArrivalContext;
    if (parsed.destinationPath !== destinationPath) {
      return null;
    }

    sessionStorage.removeItem(CELESTIAL_ARRIVAL_STORAGE_KEY);
    return parsed;
  } catch {
    sessionStorage.removeItem(CELESTIAL_ARRIVAL_STORAGE_KEY);
    return null;
  }
}
