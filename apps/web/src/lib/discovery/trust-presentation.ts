import type { DiscoveryResultUserView } from './types';

export type TrustProductStatus = 'passed' | 'failed' | 'unknown';

export type TrustCheckPresentation = {
  id: string;
  /** i18n key for check name */
  labelKey: string;
  outcome: 'TRUE' | 'FALSE' | 'UNKNOWN' | string;
  required: boolean;
  detail?: string;
};

export type TrustPresentation = {
  status: TrustProductStatus;
  /** Concise i18n key for the main trust line */
  summaryKey: string;
  sourceTrust?: string;
  sourceTrustLabelKey?: string;
  freshness?: string;
  freshnessLabelKey?: string;
  verifiedAt?: string;
  checks: TrustCheckPresentation[];
  /** Evidence statements already on the result (no invented text). */
  evidenceStatements: Array<{ id: string; statement: string; sourceUrl?: string }>;
  strategyKind: 'jobs' | 'giveaways' | 'unknown';
};

function asStrategyKind(strategyId: string | undefined): TrustPresentation['strategyKind'] {
  if (strategyId === 'job-discovery') return 'jobs';
  if (strategyId === 'giveaway-discovery') return 'giveaways';
  return 'unknown';
}

function mapStatus(status: string | undefined): TrustProductStatus {
  if (status === 'PASS') return 'passed';
  if (status === 'FAIL') return 'failed';
  return 'unknown';
}

function checkLabelKey(checkId: string): string {
  switch (checkId) {
    case 'official_source':
      return 'discovery.trust.check.officialSource';
    case 'free_participation':
      return 'discovery.trust.check.freeParticipation';
    case 'deadline_valid':
      return 'discovery.trust.check.deadlineValid';
    default:
      return 'discovery.trust.check.generic';
  }
}

function sourceTrustLabelKey(trust: string | undefined): string | undefined {
  if (!trust) return undefined;
  switch (trust) {
    case 'OFFICIAL':
      return 'discovery.trust.sourceTrust.official';
    case 'ESTABLISHED_THIRD_PARTY':
      return 'discovery.trust.sourceTrust.established';
    case 'AGGREGATOR':
      return 'discovery.trust.sourceTrust.aggregator';
    case 'COMMUNITY':
      return 'discovery.trust.sourceTrust.community';
    case 'UNKNOWN':
      return 'discovery.trust.sourceTrust.unknown';
    default:
      return undefined;
  }
}

function freshnessLabelKey(freshness: string | undefined): string | undefined {
  if (!freshness) return undefined;
  switch (freshness) {
    case 'CURRENT':
      return 'discovery.trust.freshness.current';
    case 'EXPIRED':
      return 'discovery.trust.freshness.expired';
    case 'STALE':
      return 'discovery.trust.freshness.stale';
    case 'UNKNOWN':
      return 'discovery.trust.freshness.unknown';
    default:
      return undefined;
  }
}

function outcomeLabelKey(outcome: string): string {
  switch (outcome) {
    case 'TRUE':
      return 'discovery.trust.outcome.true';
    case 'FALSE':
      return 'discovery.trust.outcome.false';
    default:
      return 'discovery.trust.outcome.unknown';
  }
}

export { outcomeLabelKey };

function hasRequiredCheck(
  checks: ReadonlyArray<{ id: string; outcome: string; required?: boolean }>,
  id: string,
  outcome: string
): boolean {
  return checks.some(
    (check) => check.id === id && check.outcome === outcome && check.required !== false
  );
}

/**
 * Choose the weakest truthful summary key from strategy + status + checks.
 * Does not invent checks that are absent from the result.
 */
export function resolveTrustSummaryKey(input: {
  strategyKind: TrustPresentation['strategyKind'];
  status: TrustProductStatus;
  checks: ReadonlyArray<{ id: string; outcome: string; required?: boolean }>;
}): string {
  if (input.status === 'failed') return 'discovery.trust.summary.failed';
  if (input.status === 'unknown') return 'discovery.trust.summary.unknown';

  if (input.strategyKind === 'jobs') {
    if (hasRequiredCheck(input.checks, 'official_source', 'TRUE')) {
      return 'discovery.trust.summary.jobsOfficialSource';
    }
    return 'discovery.trust.summary.checksPassed';
  }

  if (input.strategyKind === 'giveaways') {
    const freeOk = hasRequiredCheck(input.checks, 'free_participation', 'TRUE');
    const deadlineOk = hasRequiredCheck(input.checks, 'deadline_valid', 'TRUE');
    if (freeOk && deadlineOk) return 'discovery.trust.summary.giveawaysFreeAndDeadline';
    if (freeOk) return 'discovery.trust.summary.giveawaysFree';
    if (deadlineOk) return 'discovery.trust.summary.giveawaysDeadline';
    return 'discovery.trust.summary.checksPassed';
  }

  return 'discovery.trust.summary.checksPassed';
}

/**
 * Build trust presentation strictly from stored verification/evidence fields.
 */
export function buildTrustPresentation(result: {
  strategyId?: string;
  verification?: {
    status?: string;
    sourceTrust?: string;
    freshness?: string;
    verifiedAt?: string;
    checks?: Array<{
      id: string;
      outcome: string;
      required?: boolean;
      detail?: string;
    }>;
  };
  evidence?: Array<{
    id: string;
    statement?: string;
    sourceUrl?: string;
  }>;
  lastVerifiedAt?: string;
}): TrustPresentation {
  const strategyKind = asStrategyKind(result.strategyId);
  const status = mapStatus(result.verification?.status);
  const rawChecks = result.verification?.checks ?? [];
  const checks: TrustCheckPresentation[] = rawChecks.map((check) => ({
    id: check.id,
    labelKey: checkLabelKey(check.id),
    outcome: check.outcome,
    required: check.required !== false,
    detail: typeof check.detail === 'string' && check.detail.trim() ? check.detail.trim() : undefined,
  }));

  const sourceTrust = result.verification?.sourceTrust;
  const freshness = result.verification?.freshness;
  const verifiedAt =
    (typeof result.verification?.verifiedAt === 'string' && result.verification.verifiedAt) ||
    (typeof result.lastVerifiedAt === 'string' && result.lastVerifiedAt) ||
    undefined;

  const evidenceStatements = (result.evidence ?? [])
    .map((item) => {
      const statement = item.statement?.trim();
      if (!statement) return null;
      return {
        id: item.id,
        statement,
        sourceUrl: item.sourceUrl,
      };
    })
    .filter(
      (item): item is { id: string; statement: string; sourceUrl: string | undefined } => item != null
    );

  return {
    status,
    summaryKey: resolveTrustSummaryKey({ strategyKind, status, checks: rawChecks }),
    sourceTrust,
    sourceTrustLabelKey: sourceTrustLabelKey(sourceTrust),
    freshness,
    freshnessLabelKey: freshnessLabelKey(freshness),
    verifiedAt,
    checks,
    evidenceStatements,
    strategyKind,
  };
}

/** True only when backend status is PASS — never invent verified. */
export function isTrustPassed(presentation: TrustPresentation): boolean {
  return presentation.status === 'passed';
}

export function buildTrustPresentationFromResult(
  result: DiscoveryResultUserView
): TrustPresentation {
  return buildTrustPresentation(result);
}
