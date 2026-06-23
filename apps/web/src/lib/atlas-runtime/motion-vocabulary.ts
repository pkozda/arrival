import type { ArrivalTransitionType } from '@/lib/celestial/types';
import type { CelestialNodeId } from '@/lib/celestial/types';
import type { SpatialMotionPrimitive } from './types';

/** Legacy arrival transition types → canonical motion primitives. */
const LEGACY_ARRIVAL_TO_PRIMITIVE: Record<ArrivalTransitionType, SpatialMotionPrimitive> = {
  warp: 'expand-from-node',
  'fade-through-space': 'drift',
  'zoom-collapse': 'collapse-to-node',
};

/** Deprecated spatial type names → canonical motion primitives. */
const LEGACY_SPATIAL_TYPE_TO_PRIMITIVE: Record<string, SpatialMotionPrimitive> = {
  'zoom-through': 'expand-from-node',
  drift: 'drift',
  'orbit-focus': 'focus-in',
  'depth-fade': 'collapse-to-node',
  'focus-in': 'focus-in',
  'collapse-to-node': 'collapse-to-node',
  'expand-from-node': 'expand-from-node',
  'ambient-shift': 'ambient-shift',
};

const NODE_PRIMITIVE_OVERRIDE: Partial<Record<CelestialNodeId, SpatialMotionPrimitive>> = {
  healthcare: 'focus-in',
  community: 'focus-in',
  work: 'expand-from-node',
};

export function resolveMotionPrimitive(
  legacyType: ArrivalTransitionType,
  sourceNodeId: CelestialNodeId
): SpatialMotionPrimitive {
  return NODE_PRIMITIVE_OVERRIDE[sourceNodeId] ?? LEGACY_ARRIVAL_TO_PRIMITIVE[legacyType];
}

export function mapLegacySpatialTypeToPrimitive(legacyType: string): SpatialMotionPrimitive {
  return LEGACY_SPATIAL_TYPE_TO_PRIMITIVE[legacyType] ?? 'drift';
}

/** Homepage slide / ambient parallax maps to ambient-shift. */
export function ambientShiftPrimitive(): SpatialMotionPrimitive {
  return 'ambient-shift';
}

export const MOTION_PRIMITIVE_LABELS: Record<SpatialMotionPrimitive, string> = {
  drift: 'Drift',
  'focus-in': 'Focus In',
  'collapse-to-node': 'Collapse to Node',
  'expand-from-node': 'Expand from Node',
  'ambient-shift': 'Ambient Shift',
};
