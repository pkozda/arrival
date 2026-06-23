import type { CelestialNodeId } from './types';

export const CELESTIAL_NODE_LABELS: Record<CelestialNodeId, string> = {
  center: 'You are here',
  registration: 'Registration',
  housing: 'Housing',
  healthcare: 'Healthcare',
  finance: 'Finance',
  work: 'Work & Growth',
  community: 'Community',
};

export function isCelestialNodeId(value: string | null | undefined): value is CelestialNodeId {
  return value != null && value in CELESTIAL_NODE_LABELS;
}
