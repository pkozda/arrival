import type { CelestialNodeId } from './types';
import type { OriginNodeTransform } from './spatial-types';

/** Normalized star-map coordinates (matches atlas node layout, read-only reference). */
export const NODE_ORIGIN_TRANSFORMS: Record<CelestialNodeId, OriginNodeTransform> = {
  center: { x: 0, y: 0, scale: 1, blur: 0, glow: 0.45 },
  registration: { x: 0, y: -0.46, scale: 0.86, blur: 1.8, glow: 0.62 },
  housing: { x: -0.58, y: -0.11, scale: 0.9, blur: 1.4, glow: 0.52 },
  healthcare: { x: -0.53, y: 0.56, scale: 0.88, blur: 1.6, glow: 0.58 },
  finance: { x: 0, y: 0.73, scale: 0.87, blur: 1.5, glow: 0.55 },
  work: { x: 0.58, y: -0.11, scale: 0.89, blur: 1.4, glow: 0.54 },
  community: { x: 0.53, y: 0.56, scale: 0.88, blur: 1.5, glow: 0.5 },
};

export function getNodeOriginTransform(nodeId: CelestialNodeId): OriginNodeTransform {
  return NODE_ORIGIN_TRANSFORMS[nodeId];
}
