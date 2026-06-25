import type { GalaxyNodeState, GalaxyOrbitRing, SpatialGraphNode } from './types';

export type GalaxyLayoutNodeInput = {
  id: string;
  status: GalaxyNodeState;
};

/** Shifted left so the constellation breathes around the right-side HUD. */
export const GALAXY_CENTER = { x: 42, y: 40 } as const;

/** Elliptical rings — fit inside the stage safe zone. */
export const GALAXY_ORBIT_RADII: GalaxyOrbitRing[] = [
  { rx: 18, ry: 30 },
  { rx: 24, ry: 34 },
  { rx: 28, ry: 36 },
  { rx: 30, ry: 38 },
];

const RING = {
  primary: { rx: 18, ry: 30 },
  blocked: { rx: 24, ry: 34 },
  completed: { rx: 22, ry: 32 },
  secondary: { rx: 28, ry: 36 },
  contextual: { rx: 30, ry: 38 },
} as const;

const SAFE_MARGIN = {
  top: 14,
  bottom: 16,
  left: 8,
  right: 30,
} as const;

const ORBIT_ARC_START = 58;
const ORBIT_ARC_END = 302;

function spreadOnArc(count: number, startDeg: number, endDeg: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [(startDeg + endDeg) / 2];
  const step = (endDeg - startDeg) / (count - 1);
  return Array.from({ length: count }, (_, index) => startDeg + step * index);
}

export function distributeOrbitAngles(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [178];
  return spreadOnArc(count, ORBIT_ARC_START, ORBIT_ARC_END);
}

function angleJitter(id: string, spread = 2.5): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 997;
  }
  return ((hash / 997) - 0.5) * spread * 2;
}

function clampPosition(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.min(100 - SAFE_MARGIN.right, Math.max(SAFE_MARGIN.left, x)),
    y: Math.min(100 - SAFE_MARGIN.bottom, Math.max(SAFE_MARGIN.top, y)),
  };
}

function maxRadiusX(angleDeg: number, cx = GALAXY_CENTER.x): number {
  const cos = Math.cos((angleDeg * Math.PI) / 180);
  if (cos > 0.08) return (100 - SAFE_MARGIN.right - cx) / cos;
  if (cos < -0.08) return (cx - SAFE_MARGIN.left) / -cos;
  return 34;
}

function maxRadiusY(angleDeg: number, cy = GALAXY_CENTER.y): number {
  const sin = Math.sin((angleDeg * Math.PI) / 180);
  if (sin > 0.08) return (100 - SAFE_MARGIN.bottom - cy) / sin;
  if (sin < -0.08) return (cy - SAFE_MARGIN.top) / -sin;
  return 38;
}

function polarElliptical(
  cx: number,
  cy: number,
  radiusX: number,
  radiusY: number,
  angleDeg: number
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return clampPosition(cx + radiusX * Math.cos(rad), cy + radiusY * Math.sin(rad));
}

function placeOnRing(
  id: string,
  ring: { rx: number; ry: number },
  angleDeg: number,
  ringIndex = 0
): { x: number; y: number } {
  const laneOffsetX = (ringIndex % 2 === 0 ? 0 : 1.6) + angleJitter(`${id}-lane`, 0.6);
  const laneOffsetY = (ringIndex % 2 === 0 ? 0 : 1.8) + angleJitter(`${id}-lane-y`, 0.7);
  const jittered = angleDeg + angleJitter(id, 2);
  const radialJitterX = angleJitter(`${id}-rx`, 0.8);
  const radialJitterY = angleJitter(`${id}-ry`, 0.8);

  const radiusX = Math.min(ring.rx + laneOffsetX + radialJitterX, maxRadiusX(jittered) - 1);
  const radiusY = Math.min(ring.ry + laneOffsetY + radialJitterY, maxRadiusY(jittered) - 1);

  return polarElliptical(GALAXY_CENTER.x, GALAXY_CENTER.y, Math.max(8, radiusX), Math.max(8, radiusY), jittered);
}

type SatelliteSlot = {
  id: string;
  status: GalaxyNodeState;
  ring: { rx: number; ry: number };
};

function interleaveSatellites(buckets: SatelliteSlot[][]): SatelliteSlot[] {
  const merged: SatelliteSlot[] = [];
  const maxLength = Math.max(0, ...buckets.map((bucket) => bucket.length));

  for (let index = 0; index < maxLength; index += 1) {
    for (const bucket of buckets) {
      const slot = bucket[index];
      if (slot) merged.push(slot);
    }
  }

  return merged;
}

export type GalaxyLayoutInput<TPayload> = {
  primary?: GalaxyLayoutNodeInput & { payload: TPayload | null };
  blocked: Array<GalaxyLayoutNodeInput & { payload: TPayload | null }>;
  completed: Array<GalaxyLayoutNodeInput & { payload: TPayload | null }>;
  secondary: Array<GalaxyLayoutNodeInput & { payload: TPayload | null }>;
  contextual: Array<GalaxyLayoutNodeInput & { payload: TPayload | null }>;
};

export function layoutGalaxyGraphNodes<TPayload>({
  primary,
  blocked,
  completed,
  secondary,
  contextual,
}: GalaxyLayoutInput<TPayload>): SpatialGraphNode<TPayload>[] {
  const nodes: SpatialGraphNode<TPayload>[] = [
    {
      id: '__journey__',
      x: GALAXY_CENTER.x,
      y: GALAXY_CENTER.y,
      status: 'core',
      payload: null,
    },
  ];

  const primarySlots: SatelliteSlot[] = primary
    ? [{ id: primary.id, status: primary.status, ring: RING.primary }]
    : [];

  const blockedSlots = blocked.map((node) => ({
    id: node.id,
    status: node.status,
    ring: RING.blocked,
  }));

  const completedSlots = completed.map((node) => ({
    id: node.id,
    status: node.status,
    ring: RING.completed,
  }));

  const secondarySlots = secondary.map((node) => ({
    id: node.id,
    status: node.status,
    ring: RING.secondary,
  }));

  const contextualSlots = contextual.map((node) => ({
    id: node.id,
    status: node.status,
    ring: RING.contextual,
  }));

  const satellites = interleaveSatellites([
    primarySlots,
    blockedSlots,
    completedSlots,
    secondarySlots,
    contextualSlots,
  ]);

  const payloadById = new Map<string, TPayload | null>();
  if (primary) payloadById.set(primary.id, primary.payload);
  blocked.forEach((node) => payloadById.set(node.id, node.payload));
  completed.forEach((node) => payloadById.set(node.id, node.payload));
  secondary.forEach((node) => payloadById.set(node.id, node.payload));
  contextual.forEach((node) => payloadById.set(node.id, node.payload));

  const angles = distributeOrbitAngles(satellites.length);

  satellites.forEach((slot, index) => {
    const pos = placeOnRing(slot.id, slot.ring, angles[index] ?? 180, index);
    nodes.push({
      id: slot.id,
      x: pos.x,
      y: pos.y,
      status: slot.status,
      payload: payloadById.get(slot.id) ?? null,
    });
  });

  return nodes;
}

export function galaxyEdgePath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  curvatureOffset = 0
): string {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy) || 1;
  const bend = Math.min(distance * 0.22, 9) + curvatureOffset;
  const controlX = midX + (-dy / distance) * bend;
  const controlY = midY + (dx / distance) * bend;
  return `M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`;
}
