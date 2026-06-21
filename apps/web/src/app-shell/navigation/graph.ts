import { ECONOMIC_REALITY_MODULE_CATALOG_ENTRY } from '@/lib/product-contract';

export type AppNavigationGraphNodeId = 'home' | 'life-event' | 'economic-reality' | 'profile';

export type AppNavigationGraphEdge = {
  from: AppNavigationGraphNodeId;
  to: AppNavigationGraphNodeId;
  trigger?: 'catalog' | 'open_module' | 'always';
};

export const APP_NAVIGATION_GRAPH_NODES: AppNavigationGraphNodeId[] = [
  'home',
  'life-event',
  'economic-reality',
  'profile',
];

export const APP_NAVIGATION_GRAPH_EDGES: AppNavigationGraphEdge[] = [
  { from: 'home', to: 'economic-reality', trigger: 'catalog' },
  { from: 'life-event', to: 'economic-reality', trigger: 'open_module' },
  { from: 'profile', to: 'economic-reality', trigger: 'catalog' },
];

export function listOutgoingNavigationTargets(
  from: AppNavigationGraphNodeId
): AppNavigationGraphEdge[] {
  return APP_NAVIGATION_GRAPH_EDGES.filter((edge) => edge.from === from);
}

export function economicRealityGraphNode() {
  return {
    id: 'economic-reality' as const,
    route: ECONOMIC_REALITY_MODULE_CATALOG_ENTRY.entry.route,
    surface: ECONOMIC_REALITY_MODULE_CATALOG_ENTRY.entry.surface,
  };
}
