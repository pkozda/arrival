import type { CandidateStage, RejectionRecord } from './rejection.js';
import type { Evidence } from './evidence.js';
import type { VerificationResult } from './verification.js';
import type { AiEvaluation } from './ai-evaluation.js';
import type { Score } from './score.js';
import type { NoveltyDecision } from './novelty.js';
import type { DiscoveryResult } from './result.js';

export type SourceTrust =
  | 'OFFICIAL'
  | 'ESTABLISHED_THIRD_PARTY'
  | 'AGGREGATOR'
  | 'COMMUNITY'
  | 'UNKNOWN';

export type SourceRef = {
  trust: SourceTrust;
  label?: string;
  url?: string;
};

export type CandidateIdentity = {
  externalIds: Record<string, string>;
  canonicalUrl?: string;
  fingerprintMaterial: Record<string, string | number | boolean | null>;
};

/**
 * Structured guesses during collection/normalization/AI extraction.
 * NOT Evidence — may be incomplete or wrong.
 */
export type ExtractedFacts = {
  fields: Record<string, string | number | boolean | null>;
};

/**
 * Opaque pointer to stored raw payload.
 * Never embeds vendor HTTP/scraper response objects or giant HTML bodies.
 * Payload bytes live behind an adapter/content-store boundary.
 */
export type RawContentRef = {
  /** Opaque storage key (hash, blob id, fixture id, …) */
  ref: string;
  contentType?: string;
  sourceUrl?: string;
  contentHash?: string;
  capturedAt?: string;
};

/**
 * Adapter-neutral raw discovery hit before normalize.
 * Strategies may interpret `payload` keys they own; engine treats it as opaque JSON data.
 */
export type RawCandidatePayload = {
  discoveredUrl?: string;
  title?: string;
  snippet?: string;
  source?: SourceRef;
  /** Strategy-owned JSON-serializable bag — no SDK types */
  data?: Record<string, string | number | boolean | null>;
};

/**
 * E1 Decision 4: normalize() returns this DTO/patch — NOT a full DiscoveryCandidate.
 * Pipeline owns constructing/updating DiscoveryCandidate immutably from this output.
 */
export type NormalizedCandidateData = {
  identity: CandidateIdentity;
  extracted: ExtractedFacts;
  sourceHints?: Partial<SourceRef>;
};

export type DiscoveryCandidate = {
  id: string;
  runId: string;
  identity: CandidateIdentity;
  source: SourceRef;
  discoveredAt: string;
  raw: RawContentRef;
  extracted: ExtractedFacts;
  /** Optional strategy bag after normalize — still not Evidence */
  normalized?: NormalizedCandidateData;
  stage: CandidateStage;
  rejection?: RejectionRecord;
  /** True after deterministic filter PASS in this run */
  deterministicFilterPassed: boolean;
  /** Set by Verify stage — ExtractedFacts ≠ VerificationResult */
  verification?: VerificationResult;
  /** Attributable Evidence produced during verification (optional) */
  evidence?: Evidence[];
  /**
   * AI interpretation metadata (E2.4).
   * Not Evidence; does not modify VerificationResult.
   */
  aiEvaluation?: AiEvaluation;
  /** Strategy-produced Score (E2.5) */
  score?: Score;
  /** Strategy scoringPolicy.rank() result for later digest */
  rankValue?: number;
  /** E2.6 pre-persistence novelty / state / notify decision */
  noveltyDecision?: NoveltyDecision;
  /** Set after successful Persist + Promote (E2.7) */
  promotedResult?: DiscoveryResult;
  /** Persist outcome for diagnostics / E2.8 digest */
  persistOutcome?: 'CREATED' | 'UPDATED' | 'UNCHANGED' | 'DENIED' | 'PERSIST_FAILED';
};
