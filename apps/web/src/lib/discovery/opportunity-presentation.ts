import type { DiscoveryExecutionLifecycle, DiscoveryResultUserView } from './types';
import { companyFromResult, formatMatchPercent } from './helpers';

export { formatMatchPercent };

/** Safe external opportunity action — only when verification + URL exist. */
export type OpportunitySourceAction = {
  kind: 'external_open';
  href: string;
};

export type OpportunityPresentation = {
  id: string;
  profileId: string;
  title: string;
  summary?: string;
  organization?: string;
  salary?: string;
  discoveredAt: string;
  lastChangedAt: string;
  matchScore: number;
  confidenceScore: number;
  verificationStatus: string;
  fromCurrentRun: boolean;
  sourceAction: OpportunitySourceAction | null;
  sourceTrust?: string;
};

function trimUrl(value: string | undefined | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Resolve the best existing opportunity URL without inventing one.
 * Preference: presentation primaryUrl → identity canonicalUrl → source.url.
 */
export function resolveOpportunityUrl(result: {
  canonicalPresentation?: { primaryUrl?: string };
  identity?: { canonicalUrl?: string };
  source?: { url?: string };
}): string | null {
  return (
    trimUrl(result.canonicalPresentation?.primaryUrl) ??
    trimUrl(result.identity?.canonicalUrl) ??
    trimUrl(result.source?.url) ??
    null
  );
}

/**
 * Actionable external open only when verification PASS and a URL exists.
 * Does not claim Apply or that Arrival Atlas completed an application.
 */
export function resolveOpportunitySourceAction(result: {
  verification?: { status?: string };
  canonicalPresentation?: { primaryUrl?: string };
  identity?: { canonicalUrl?: string };
  source?: { url?: string };
}): OpportunitySourceAction | null {
  if (result.verification?.status !== 'PASS') return null;
  const href = resolveOpportunityUrl(result);
  if (!href) return null;
  return { kind: 'external_open', href };
}

export function salaryFromResult(result: {
  materialFields?: Record<string, string | number | boolean | null>;
}): string | null {
  const salary = result.materialFields?.salary;
  if (typeof salary === 'string' && salary.trim()) return salary.trim();
  if (typeof salary === 'number' && Number.isFinite(salary)) return String(salary);
  return null;
}

export function buildOpportunityPresentation(
  result: DiscoveryResultUserView,
  opts?: { currentRunId?: string | null }
): OpportunityPresentation {
  const organization = companyFromResult(result) ?? undefined;
  const salary = salaryFromResult(result) ?? undefined;
  const summary = result.canonicalPresentation.summary?.trim() || undefined;

  return {
    id: result.id,
    profileId: result.profileId,
    title: result.canonicalPresentation.title,
    summary,
    organization,
    salary,
    discoveredAt: result.firstSeenAt,
    lastChangedAt: result.lastChangedAt,
    matchScore: result.score.matchScore,
    confidenceScore: result.score.confidenceScore,
    verificationStatus: result.verification.status,
    fromCurrentRun: Boolean(
      opts?.currentRunId && result.promotedFromRunId === opts.currentRunId
    ),
    sourceAction: resolveOpportunitySourceAction(result),
    sourceTrust: result.source?.trust || result.verification.sourceTrust,
  };
}

export function isNoResultsPresentation(
  lifecycle: DiscoveryExecutionLifecycle | null | undefined
): boolean {
  return lifecycle === 'NO_RESULTS';
}

export function isActiveRunPresentation(
  lifecycle: DiscoveryExecutionLifecycle | null | undefined
): boolean {
  return lifecycle === 'QUEUED' || lifecycle === 'RUNNING';
}

export function isErrorPresentation(
  lifecycle: DiscoveryExecutionLifecycle | null | undefined
): boolean {
  return lifecycle === 'ERROR';
}

/**
 * Current-run opportunities first; otherwise preserve relative order.
 * Not a ranking algorithm — only groups by run association.
 */
export function orderOpportunitiesForDisplay<T extends { fromCurrentRun: boolean }>(
  items: readonly T[]
): T[] {
  const current: T[] = [];
  const prior: T[] = [];
  for (const item of items) {
    if (item.fromCurrentRun) current.push(item);
    else prior.push(item);
  }
  return [...current, ...prior];
}
