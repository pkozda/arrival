import type { CurrentSituationSource, SurfacePriority } from './types';

export const DEFAULT_SURFACE_PRIORITIES: Record<CurrentSituationSource, SurfacePriority> = {
  'life-events': 100,
  economic: 80,
  profile: 60,
};

export function getDefaultSurfacePriority(surface: CurrentSituationSource): SurfacePriority {
  return DEFAULT_SURFACE_PRIORITIES[surface];
}

export function isKnownSurfacePriority(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}
