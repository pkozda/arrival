import type { Domain, AnnotatedSyncPlan, EdgeSemantics, SyncGraph } from './domainSyncGraph';
import { incomingEdgesForDomain } from './domainSyncGraph';
import type { DomainStateMap } from './stateTransaction';

export type DomainSyncResultStatus = 'success' | 'failed' | 'skipped';

export type DomainSyncSkipReason =
  | 'dependency_failed'
  | 'invalidate_upstream_failed'
  | 'recompute_fallback_cached'
  | 'profile_not_ready';

export type DomainSyncResult = {
  domain: Domain;
  status: DomainSyncResultStatus;
  error?: string | null;
  domains?: DomainStateMap;
  skipped?: boolean;
  skipReason?: DomainSyncSkipReason;
  usedCachedSnapshot?: boolean;
};

export type DomainSyncResults = {
  plan: AnnotatedSyncPlan;
  results: DomainSyncResult[];
};

export type ConsistencyPolicy = 'satisfied' | 'degraded';

const BLOCKING_SEMANTICS: ReadonlySet<EdgeSemantics> = new Set(['dependency', 'invalidate']);

export function domainSyncResultSucceeded(result: DomainSyncResult): boolean {
  return result.status === 'success';
}

export function domainSyncResultFailed(result: DomainSyncResult): boolean {
  return result.status === 'failed';
}

export function buildDomainResultIndex(results: DomainSyncResult[]): Map<Domain, DomainSyncResult> {
  return new Map(results.map((result) => [result.domain, result]));
}

export function resolveDomainExecutionDecision(
  domain: Domain,
  graph: SyncGraph,
  completedResults: Map<Domain, DomainSyncResult>
): { execute: true } | { execute: false; skipReason: DomainSyncSkipReason; error: string } {
  const incoming = incomingEdgesForDomain(domain, graph);

  for (const edge of incoming) {
    const upstream = completedResults.get(edge.from);
    if (!upstream || upstream.status !== 'failed') {
      continue;
    }

    if (edge.reason === 'recompute') {
      return {
        execute: false,
        skipReason: 'recompute_fallback_cached',
        error: `Skipped ${domain} recompute because ${edge.from} failed`,
      };
    }

    if (BLOCKING_SEMANTICS.has(edge.reason)) {
      return {
        execute: false,
        skipReason:
          edge.reason === 'invalidate' ? 'invalidate_upstream_failed' : 'dependency_failed',
        error: `Blocked ${domain} because ${edge.from} failed`,
      };
    }
  }

  return { execute: true };
}

export function createSkippedDomainResult(
  domain: Domain,
  skipReason: DomainSyncSkipReason,
  error: string,
  cachedDomains?: DomainStateMap
): DomainSyncResult {
  return {
    domain,
    status: 'skipped',
    skipped: true,
    skipReason,
    error,
    domains: cachedDomains,
    usedCachedSnapshot: skipReason === 'recompute_fallback_cached',
  };
}

export function createFailedDomainResult(domain: Domain, error: string): DomainSyncResult {
  return {
    domain,
    status: 'failed',
    error,
  };
}

export function createSuccessfulDomainResult(
  domain: Domain,
  domains: DomainStateMap
): DomainSyncResult {
  return {
    domain,
    status: 'success',
    error: null,
    domains,
  };
}

export function mergeSuccessfulDomainStates(results: DomainSyncResults): DomainStateMap {
  const merged: DomainStateMap = {};

  for (const result of results.results) {
    if (result.status !== 'success' || !result.domains) {
      continue;
    }
    for (const [domain, state] of Object.entries(result.domains)) {
      const key = domain as Domain;
      merged[key] = { ...merged[key], ...state } as DomainStateMap[typeof key];
    }
  }

  return merged;
}

export function collectDomainErrors(results: DomainSyncResults): Partial<Record<Domain, string | null>> {
  const errors: Partial<Record<Domain, string | null>> = {};

  for (const result of results.results) {
    if (result.error) {
      errors[result.domain] = result.error;
    }
  }

  return errors;
}

export function evaluateConsistencyPolicy(results: DomainSyncResults): ConsistencyPolicy {
  const hasFailure = results.results.some(
    (result) =>
      result.status === 'failed' ||
      (result.status === 'skipped' &&
        !result.usedCachedSnapshot &&
        result.skipReason !== 'profile_not_ready')
  );

  return hasFailure ? 'degraded' : 'satisfied';
}

export function aggregateDomainFetchOutcome(
  domain: Domain,
  fetchResult: { domains: DomainStateMap; errors: Partial<Record<Domain, string | null>> }
): DomainSyncResult {
  const error = fetchResult.errors[domain] ?? null;

  if (error) {
    return createFailedDomainResult(domain, error);
  }

  return {
    domain,
    status: 'success',
    error: null,
    domains: fetchResult.domains,
  };
}
