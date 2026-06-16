import type { UxPayload } from './api';

type UxStoreState = {
  byModule: Record<string, UxPayload>;
  lastUpdated: Record<string, number>;
};

let state: UxStoreState = {
  byModule: {},
  lastUpdated: {},
};

let version = 0;
const listeners = new Set<() => void>();

function notify(): void {
  version += 1;
  listeners.forEach((listener) => listener());
}

export function subscribeUxStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getUxStoreVersion(): number {
  return version;
}

export function setUx(moduleId: string, ux?: UxPayload): void {
  if (ux?.actions) {
    state.byModule[moduleId] = ux;
    state.lastUpdated[moduleId] = Date.now();
  } else {
    delete state.byModule[moduleId];
    delete state.lastUpdated[moduleId];
  }
  notify();
}

export function getUx(moduleId: string): UxPayload | null {
  return state.byModule[moduleId] ?? null;
}

export function getLastUpdated(moduleId: string): number | null {
  return state.lastUpdated[moduleId] ?? null;
}

export function getAllUx(): UxPayload[] {
  return Object.values(state.byModule);
}

export function getAllUxByModule(): Array<{ moduleId: string; ux: UxPayload }> {
  return Object.entries(state.byModule).map(([moduleId, ux]) => ({ moduleId, ux }));
}

export function clearUx(): void {
  state = { byModule: {}, lastUpdated: {} };
  notify();
}

export function recordModuleUx(
  moduleId: string,
  result: { ux?: UxPayload }
): void {
  setUx(moduleId, result.ux);
}
