import type { DiscoveryCandidate } from '../types/candidate.js';
import type { DiscoveryResult } from '../types/result.js';
import type { NoveltyDecision, NoveltyStatus } from '../types/novelty.js';
import type {
  DigestEntry,
  DiscoveryDigest,
  DigestSummary,
} from '../types/digest.js';

export type DigestCandidateSource = {
  candidate: DiscoveryCandidate;
  /** Snapshot for immutability tests — builder must not mutate */
  promotedResult: DiscoveryResult;
  noveltyDecision: NoveltyDecision;
  rankValue: number;
};

export type BuildDiscoveryDigestInput = {
  runId: string;
  profileId: string;
  strategyId: string;
  strategyVersion: string;
  generatedAt: string;
  periodFrom: string;
  sources: readonly DigestCandidateSource[];
};

/**
 * Pure digest builder. Read-only over inputs.
 * Consumes novelty shouldNotify — does not re-verify or re-score.
 */
export function buildDiscoveryDigest(
  input: BuildDiscoveryDigestInput
): DiscoveryDigest {
  const eligible: Array<{
    result: DiscoveryResult;
    novelty: NoveltyDecision;
    rankValue: number;
  }> = [];

  for (const source of input.sources) {
    if (!isDigestEligible(source)) continue;
    eligible.push({
      result: source.promotedResult,
      novelty: source.noveltyDecision,
      rankValue: source.rankValue,
    });
  }

  eligible.sort(compareDigestSources);

  const entries: DigestEntry[] = eligible.map((item, index) => ({
    resultId: item.result.id,
    rank: index + 1,
    rankValue: item.rankValue,
    novelty: item.novelty.novelty,
    userState: item.result.userState,
    lifecycle: item.result.lifecycle,
    shouldNotify: item.novelty.shouldNotify,
  }));

  const resultIds = entries.map((e) => e.resultId);
  const newResultIds = entries
    .filter((e) => e.novelty === 'NEW')
    .map((e) => e.resultId);
  const updatedResultIds = entries
    .filter((e) => e.novelty === 'UPDATED')
    .map((e) => e.resultId);

  // Counts among eligible digest entries + observed sources for unchanged
  const summary = buildSummary(input.sources, entries);

  return {
    id: `digest:${input.runId}`,
    runId: input.runId,
    profileId: input.profileId,
    strategyId: input.strategyId,
    strategyVersion: input.strategyVersion,
    generatedAt: input.generatedAt,
    period: { from: input.periodFrom, to: input.generatedAt },
    resultIds: [...resultIds],
    entries,
    newResultIds: [...newResultIds],
    updatedResultIds: [...updatedResultIds],
    summary,
  };
}

/**
 * Digest eligibility — consumes novelty shouldNotify; engine safety excludes
 * DISMISSED / EXPIRED / REMOVED / unverified / non-promoted.
 */
export function isDigestEligible(source: DigestCandidateSource): boolean {
  const { candidate, promotedResult, noveltyDecision } = source;

  if (candidate.stage !== 'PROMOTED') return false;
  if (
    candidate.persistOutcome === 'DENIED' ||
    candidate.persistOutcome === 'PERSIST_FAILED'
  ) {
    return false;
  }
  if (!candidate.promotedResult) return false;
  if (!noveltyDecision) return false;

  if (!noveltyDecision.shouldNotify) return false;

  if (
    promotedResult.userState === 'DISMISSED' ||
    promotedResult.userState === 'EXPIRED'
  ) {
    return false;
  }
  if (
    promotedResult.lifecycle === 'EXPIRED' ||
    promotedResult.lifecycle === 'REMOVED'
  ) {
    return false;
  }

  if (promotedResult.verification.status !== 'PASS') return false;
  if (!promotedResult.score) return false;

  return true;
}

function compareDigestSources(
  a: { result: DiscoveryResult; novelty: NoveltyDecision; rankValue: number },
  b: { result: DiscoveryResult; novelty: NoveltyDecision; rankValue: number }
): number {
  if (b.rankValue !== a.rankValue) {
    return b.rankValue - a.rankValue;
  }
  const noveltyPri = (n: NoveltyStatus) =>
    n === 'NEW' ? 2 : n === 'UPDATED' ? 1 : 0;
  const np = noveltyPri(b.novelty.novelty) - noveltyPri(a.novelty.novelty);
  if (np !== 0) return np;
  if (a.result.firstSeenAt !== b.result.firstSeenAt) {
    return a.result.firstSeenAt < b.result.firstSeenAt ? 1 : -1;
  }
  return a.result.id.localeCompare(b.result.id);
}

function buildSummary(
  sources: readonly DigestCandidateSource[],
  entries: DigestEntry[]
): DigestSummary {
  let unchangedObserved = 0;
  for (const s of sources) {
    if (s.noveltyDecision.novelty === 'UNCHANGED') {
      unchangedObserved += 1;
    }
  }
  return {
    totalResults: entries.length,
    newResults: entries.filter((e) => e.novelty === 'NEW').length,
    updatedResults: entries.filter((e) => e.novelty === 'UPDATED').length,
    unchangedResults: unchangedObserved,
    notifiedResults: entries.filter((e) => e.shouldNotify).length,
  };
}
