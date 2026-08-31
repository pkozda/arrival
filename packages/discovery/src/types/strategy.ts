import type { DiscoveryCriteria } from './criteria.js';
import type {
  NormalizedCandidateData,
  RawCandidatePayload,
  SourceTrust,
} from './candidate.js';
import type { DiscoveryQuery } from './query.js';
import type { RejectionReasonCode } from './rejection.js';
import type { RankContext, Score, ScoreComputationInput } from './score.js';
import type { NoveltyPolicy } from './novelty.js';

export type ValidationResult =
  | { ok: true }
  | { ok: false; errors: Array<{ path: string; code: string }> };

export type FilterResult =
  | { action: 'PASS' }
  | {
      action: 'REJECT';
      reasonCode: RejectionReasonCode;
      details?: Record<string, string | number | boolean | null>;
    };

export type NormalizeContext = {
  runId: string;
  discoveredAt: string;
};

export type VerificationPolicy = {
  requireVerificationPass: boolean;
  requiredChecks: Array<{
    id: string;
    /** MVP: required checks must not treat UNKNOWN as pass */
    allowUnknown: false;
  }>;
  requireOfficialSource: boolean;
  acceptedSourceTrustForDiscovery: SourceTrust[];
};

/**
 * E1 Decision 2: rank() lives on ScoringPolicy (strategy-owned, pure).
 * E2.5: score() also lives on ScoringPolicy — engine does not apply a global
 * Match×Confidence×… product; strategies own dimension calculation.
 */
export type ScoringPolicy = {
  dimensions: Array<{
    id: string;
    weight: number;
    labelKey: string;
  }>;
  minConfidenceToNotify: number;
  minMatchToNotify: number;
  /** Produce Match + Confidence + breakdown. Pure. Strategy-owned. */
  score(input: ScoreComputationInput): Score;
  rank(score: Score, context: RankContext): number;
};

export type FreshnessPolicy = {
  reverifyEvery: 'EVERY_RUN' | 'DAILY' | 'ON_NOTIFY';
  expireWhen: Array<'DEADLINE_PASSED' | 'PAGE_GONE' | 'MARKED_CLOSED'>;
};

export type DeduplicationPolicy = {
  fingerprintFields: string[];
  preferSourceTrust: SourceTrust[];
};

export type AiEvaluationPolicy = {
  enabled: boolean;
  tasks: Array<
    'CLASSIFY' | 'EXTRACT' | 'RELEVANCE' | 'PURCHASE_REQUIREMENT' | 'SENIORITY'
  >;
  rejectOn: RejectionReasonCode[];
};

/**
 * Versioned registry metadata + pure strategy module.
 *
 * E1 Decision 1: Generics for strategy-authored modules; registry/pipeline use the
 * base bounds DiscoveryCriteria / RawCandidatePayload / NormalizedCandidateData
 * so orchestration stays strategy-agnostic.
 *
 * E1 Decision 4: normalize returns NormalizedCandidateData (patch/DTO), not DiscoveryCandidate.
 */
export interface DiscoveryStrategy<
  TCriteria extends DiscoveryCriteria = DiscoveryCriteria,
  TRaw extends RawCandidatePayload = RawCandidatePayload,
  TNormalized extends NormalizedCandidateData = NormalizedCandidateData,
> {
  readonly id: string;
  readonly version: string;
  readonly displayKey: string;

  validateCriteria(criteria: TCriteria): ValidationResult;
  buildQueries(criteria: TCriteria): DiscoveryQuery[];
  normalize(raw: TRaw, ctx: NormalizeContext): TNormalized;
  filter(candidate: TNormalized, criteria: TCriteria): FilterResult;

  verificationPolicy: VerificationPolicy;
  scoringPolicy: ScoringPolicy;
  freshnessPolicy: FreshnessPolicy;
  deduplicationPolicy: DeduplicationPolicy;
  aiEvaluationPolicy: AiEvaluationPolicy;
  noveltyPolicy: NoveltyPolicy;
}

/** Erased form used by StrategyRegistry / pipeline. */
export type DiscoveryStrategyModule = DiscoveryStrategy<
  DiscoveryCriteria,
  RawCandidatePayload,
  NormalizedCandidateData
>;

/** Descriptor view (id/version/policies) without requiring method calls. */
export type DiscoveryStrategyDescriptor = {
  id: string;
  version: string;
  displayKey: string;
  verificationPolicy: VerificationPolicy;
  scoringPolicy: ScoringPolicy;
  freshnessPolicy: FreshnessPolicy;
  deduplicationPolicy: DeduplicationPolicy;
  aiEvaluationPolicy: AiEvaluationPolicy;
  noveltyPolicy: NoveltyPolicy;
};

export function toStrategyDescriptor(
  strategy: DiscoveryStrategyModule
): DiscoveryStrategyDescriptor {
  return {
    id: strategy.id,
    version: strategy.version,
    displayKey: strategy.displayKey,
    verificationPolicy: strategy.verificationPolicy,
    scoringPolicy: strategy.scoringPolicy,
    freshnessPolicy: strategy.freshnessPolicy,
    deduplicationPolicy: strategy.deduplicationPolicy,
    aiEvaluationPolicy: strategy.aiEvaluationPolicy,
    noveltyPolicy: strategy.noveltyPolicy,
  };
}
