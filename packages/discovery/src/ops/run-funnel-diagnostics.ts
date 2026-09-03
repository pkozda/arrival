import type { PipelineExecuteResult } from '../pipeline/execute.js';
import type { PipelineBatch } from '../pipeline/types.js';
import type { DiscoveryCandidate } from '../types/candidate.js';
import type { DiscoveryRunStatus } from '../types/run.js';

/** Max candidates persisted in funnel metadata (deterministic truncation). */
export const MAX_FUNNEL_CANDIDATES = 20;

export const FUNNEL_METADATA_KEY = 'funnel';

export type DiscoveryRunFunnelDiagnostics = {
  queries: Array<{
    id: string;
    text: string;
  }>;
  stats: {
    candidatesFound: number;
    candidatesRejected: number;
    candidatesVerified: number;
    resultsCreated: number;
    resultsUpdated: number;
  };
  status: DiscoveryRunStatus;
  partialFailureCount: number;
  stages: Array<{
    stage: string;
    outcome: string;
    message?: string;
  }>;
  discovered: Array<{
    candidateId: string;
    url?: string;
    title?: string;
    sourceLabel?: string;
  }>;
  rejected: Array<{
    candidateId: string;
    url?: string;
    title?: string;
    atStage: string;
    reasonCode: string;
    message?: string;
  }>;
  promoted: {
    created: number;
    updated: number;
    denied: number;
    unchanged: number;
  };
};

/**
 * Pure projection of an completed pipeline run into compact funnel diagnostics.
 *
 * `candidatesFound` counts search hits. After the pipeline, each hit appears exactly
 * once in either `batch.active` or `batch.rejected` (mutually exclusive).
 */
export function buildDiscoveryRunFunnelDiagnostics(
  result: PipelineExecuteResult
): DiscoveryRunFunnelDiagnostics {
  const { run, batch, queries, stageDiagnostics } = result;

  const partialFailureCount =
    run.diagnostics?.filter((d) => d.code === 'PARTIAL_ADAPTER_FAILURE').length ?? 0;

  const promotionCounts = countPromotionOutcomes(batch);

  const ordered = orderCandidatesByDiscoveryIndex(batch);

  const discovered = ordered.slice(0, MAX_FUNNEL_CANDIDATES).map(toDiscoveredEntry);

  const rejected = batch.rejected
    .slice()
    .sort(
      (a, b) =>
        candidateDiscoveryIndex(a.candidate) - candidateDiscoveryIndex(b.candidate)
    )
    .slice(0, MAX_FUNNEL_CANDIDATES)
    .map(({ candidate, rejection }) => ({
      candidateId: candidate.id,
      url: candidateUrl(candidate),
      title: candidateTitle(candidate),
      atStage: rejection.atStage,
      reasonCode: rejection.reasonCode,
      ...(rejection.message ? { message: rejection.message } : {}),
    }));

  const stages = stageDiagnostics
    .filter((d) => !d.candidateId)
    .map((d) => ({
      stage: d.stage,
      outcome: d.outcome,
      ...(d.message ? { message: d.message } : {}),
    }));

  return {
    queries: queries.map((q) => ({ id: q.id, text: q.text })),
    stats: { ...run.stats },
    status: run.status,
    partialFailureCount,
    stages,
    discovered,
    rejected,
    promoted: {
      created: run.stats.resultsCreated,
      updated: run.stats.resultsUpdated,
      denied: promotionCounts.denied,
      unchanged: promotionCounts.unchanged,
    },
  };
}

export function serializeDiscoveryRunFunnelDiagnostics(
  funnel: DiscoveryRunFunnelDiagnostics
): string {
  return JSON.stringify(funnel);
}

export function parseDiscoveryRunFunnelDiagnostics(
  raw: string | undefined
): DiscoveryRunFunnelDiagnostics | undefined {
  if (!raw) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as DiscoveryRunFunnelDiagnostics;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.queries)) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

function countPromotionOutcomes(batch: PipelineBatch): {
  denied: number;
  unchanged: number;
} {
  let denied = 0;
  let unchanged = 0;
  for (const candidate of batch.active) {
    if (candidate.persistOutcome === 'DENIED') {
      denied += 1;
    } else if (candidate.persistOutcome === 'UNCHANGED') {
      unchanged += 1;
    }
  }
  return { denied, unchanged };
}

function orderCandidatesByDiscoveryIndex(
  batch: PipelineBatch
): DiscoveryCandidate[] {
  const seen = new Map<string, DiscoveryCandidate>();
  for (const { candidate } of batch.rejected) {
    seen.set(candidate.id, candidate);
  }
  for (const candidate of batch.active) {
    seen.set(candidate.id, candidate);
  }
  return [...seen.values()].sort(
    (a, b) => candidateDiscoveryIndex(a) - candidateDiscoveryIndex(b)
  );
}

function candidateDiscoveryIndex(candidate: DiscoveryCandidate): number {
  const suffix = candidate.id.split(':cand:')[1];
  const index = suffix !== undefined ? Number.parseInt(suffix, 10) : Number.NaN;
  return Number.isFinite(index) ? index : 0;
}

function candidateUrl(candidate: DiscoveryCandidate): string | undefined {
  const url = candidate.identity.canonicalUrl?.trim();
  return url || undefined;
}

function candidateTitle(candidate: DiscoveryCandidate): string | undefined {
  const fromExtracted = candidate.extracted.fields.title;
  if (fromExtracted != null && String(fromExtracted).trim()) {
    return String(fromExtracted);
  }
  const fromFp = candidate.identity.fingerprintMaterial.title;
  if (fromFp != null && String(fromFp).trim()) {
    return String(fromFp);
  }
  return undefined;
}

function candidateSourceLabel(candidate: DiscoveryCandidate): string | undefined {
  return candidate.source.label ?? candidate.source.trust;
}

function toDiscoveredEntry(candidate: DiscoveryCandidate): {
  candidateId: string;
  url?: string;
  title?: string;
  sourceLabel?: string;
} {
  const entry: {
    candidateId: string;
    url?: string;
    title?: string;
    sourceLabel?: string;
  } = { candidateId: candidate.id };
  const url = candidateUrl(candidate);
  const title = candidateTitle(candidate);
  const sourceLabel = candidateSourceLabel(candidate);
  if (url) entry.url = url;
  if (title) entry.title = title;
  if (sourceLabel) entry.sourceLabel = sourceLabel;
  return entry;
}
