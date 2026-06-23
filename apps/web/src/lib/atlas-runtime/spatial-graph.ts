import type { CelestialNodeId } from '@/lib/celestial/types';
import { CELESTIAL_NODE_LABELS } from '@/lib/celestial/node-labels';

export type SpatialGraphNode = {
  id: CelestialNodeId;
  label: string;
  paths: string[];
};

export type SpatialGraph = {
  nodes: SpatialGraphNode[];
  resolveNodeForPath: (pathname: string) => CelestialNodeId;
};

const ROUTE_NODE_DEFAULTS: Array<{ match: (path: string) => boolean; nodeId: CelestialNodeId }> = [
  { match: (path) => path === '/profile' || path.startsWith('/profile/'), nodeId: 'housing' },
  { match: (path) => path.startsWith('/modules/life-event'), nodeId: 'registration' },
  { match: (path) => path.startsWith('/modules/economic-reality'), nodeId: 'finance' },
  { match: (path) => path.startsWith('/modules/'), nodeId: 'work' },
];

function resolveNodeForPath(pathname: string): CelestialNodeId {
  const hit = ROUTE_NODE_DEFAULTS.find((entry) => entry.match(pathname));
  return hit?.nodeId ?? 'center';
}

const NODE_PATHS: Record<CelestialNodeId, string[]> = {
  center: ['/'],
  registration: ['/modules/life-event'],
  housing: ['/profile'],
  healthcare: [],
  finance: ['/modules/economic-reality'],
  work: ['/modules'],
  community: [],
};

export const SPATIAL_GRAPH: SpatialGraph = {
  nodes: (Object.keys(CELESTIAL_NODE_LABELS) as CelestialNodeId[]).map((id) => ({
    id,
    label: CELESTIAL_NODE_LABELS[id],
    paths: NODE_PATHS[id],
  })),
  resolveNodeForPath,
};
