import type { RuntimeReactionInputEvent } from './runtimeReactionBus';
import type { SyncScope } from './syncScope';

export type Domain = 'PROFILE' | 'ECONOMIC' | 'LIFE_EVENT' | 'SNAPSHOT';

export type EdgeSemantics = 'cascade' | 'dependency' | 'invalidate' | 'recompute';

export type SyncEdge = {
  from: Domain;
  to: Domain;
  reason: EdgeSemantics;
};

export type SyncGraph = {
  domains: readonly Domain[];
  edges: readonly SyncEdge[];
};

export type SyncPlanStep = {
  domain: Domain;
  reasons: EdgeSemantics[];
};

export type AnnotatedSyncPlan = SyncPlanStep[];

/** Domain execution order — use syncPlanDomains() to extract from AnnotatedSyncPlan */
export type SyncPlan = Domain[];

export type ConsistencyCurrentState = {
  syncedDomains: ReadonlySet<Domain>;
};

export const DOMAIN_SYNC_GRAPH: SyncGraph = {
  domains: ['PROFILE', 'LIFE_EVENT', 'ECONOMIC', 'SNAPSHOT'],
  edges: [
    { from: 'PROFILE', to: 'ECONOMIC', reason: 'cascade' },
    { from: 'PROFILE', to: 'LIFE_EVENT', reason: 'cascade' },
    { from: 'LIFE_EVENT', to: 'ECONOMIC', reason: 'dependency' },
    { from: 'ECONOMIC', to: 'SNAPSHOT', reason: 'recompute' },
  ],
};

const DOMAIN_ORDER: Record<Domain, number> = {
  PROFILE: 0,
  LIFE_EVENT: 1,
  ECONOMIC: 2,
  SNAPSHOT: 3,
};

export function syncPlanDomains(plan: AnnotatedSyncPlan): SyncPlan {
  return plan.map((step) => step.domain);
}

export function mapEventToInitialDomains(event: RuntimeReactionInputEvent): Domain[] {
  switch (event.type) {
    case 'PROFILE_MUTATED':
      return ['PROFILE'];
    case 'ECONOMIC_ACTION_EXECUTED':
      return ['ECONOMIC'];
    case 'SESSION_SYNC_REQUESTED':
      return mapSyncScopeToInitialDomains(event.scope ?? 'FULL');
    default: {
      const exhaustive: never = event;
      return exhaustive;
    }
  }
}

export function mapSyncScopeToInitialDomains(scope: SyncScope): Domain[] {
  switch (scope) {
    case 'PROFILE':
      return ['PROFILE'];
    case 'ECONOMIC':
      return ['ECONOMIC'];
    case 'FULL':
      return [...DOMAIN_SYNC_GRAPH.domains];
    default: {
      const exhaustive: never = scope;
      return exhaustive;
    }
  }
}

function expandDomains(initial: Domain[], graph: SyncGraph): Set<Domain> {
  const expanded = new Set<Domain>(initial);

  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of graph.edges) {
      if (expanded.has(edge.from) && !expanded.has(edge.to)) {
        expanded.add(edge.to);
        changed = true;
      }
    }
  }

  return expanded;
}

function annotateStepReasons(domain: Domain, expanded: Set<Domain>, graph: SyncGraph): EdgeSemantics[] {
  const reasons = graph.edges
    .filter((edge) => edge.to === domain && expanded.has(edge.from))
    .map((edge) => edge.reason);

  if (reasons.length === 0 && expanded.has(domain)) {
    return ['cascade'];
  }

  return [...new Set(reasons)].sort(
    (left, right) => semanticsOrder(left) - semanticsOrder(right)
  );
}

function semanticsOrder(reason: EdgeSemantics): number {
  switch (reason) {
    case 'dependency':
      return 0;
    case 'invalidate':
      return 1;
    case 'recompute':
      return 2;
    case 'cascade':
      return 3;
    default: {
      const exhaustive: never = reason;
      return exhaustive;
    }
  }
}

function topologicalSort(domains: Set<Domain>, graph: SyncGraph): AnnotatedSyncPlan {
  const domainList = [...domains];
  const incoming = new Map<Domain, number>();
  const outgoing = new Map<Domain, Domain[]>();

  for (const domain of domainList) {
    incoming.set(domain, 0);
    outgoing.set(domain, []);
  }

  for (const edge of graph.edges) {
    if (!domains.has(edge.from) || !domains.has(edge.to)) {
      continue;
    }
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    outgoing.get(edge.from)?.push(edge.to);
  }

  const queue = domainList
    .filter((domain) => (incoming.get(domain) ?? 0) === 0)
    .sort((left, right) => DOMAIN_ORDER[left] - DOMAIN_ORDER[right]);

  const ordered: Domain[] = [];

  while (queue.length > 0) {
    queue.sort((left, right) => DOMAIN_ORDER[left] - DOMAIN_ORDER[right]);
    const next = queue.shift();
    if (!next) {
      break;
    }
    ordered.push(next);

    for (const target of outgoing.get(next) ?? []) {
      const nextIncoming = (incoming.get(target) ?? 0) - 1;
      incoming.set(target, nextIncoming);
      if (nextIncoming === 0) {
        queue.push(target);
      }
    }
  }

  const sortedDomains =
    ordered.length !== domainList.length
      ? [...domainList].sort((left, right) => DOMAIN_ORDER[left] - DOMAIN_ORDER[right])
      : ordered;

  return sortedDomains.map((domain) => ({
    domain,
    reasons: annotateStepReasons(domain, domains, graph),
  }));
}

export function buildAnnotatedSyncPlan(
  event: RuntimeReactionInputEvent,
  graph: SyncGraph = DOMAIN_SYNC_GRAPH,
  _currentState: ConsistencyCurrentState = { syncedDomains: new Set() }
): AnnotatedSyncPlan {
  const initial = mapEventToInitialDomains(event);
  const expanded = expandDomains(initial, graph);
  return topologicalSort(expanded, graph);
}

export function buildSyncPlan(
  event: RuntimeReactionInputEvent,
  graph: SyncGraph = DOMAIN_SYNC_GRAPH,
  currentState: ConsistencyCurrentState = { syncedDomains: new Set() }
): SyncPlan {
  return syncPlanDomains(buildAnnotatedSyncPlan(event, graph, currentState));
}

export function loadingFlagsForDomains(
  domains: readonly Domain[],
  loading: boolean
): Partial<Record<Domain, boolean>> {
  const flags: Partial<Record<Domain, boolean>> = {};
  for (const domain of domains) {
    flags[domain] = loading;
  }
  return flags;
}

export function incomingEdgesForDomain(domain: Domain, graph: SyncGraph): SyncEdge[] {
  return graph.edges.filter((edge) => edge.to === domain);
}
