import type {
  CandidateIdentity,
  ExtractedFacts,
  RawCandidatePayload,
  RawContentRef,
  SourceRef,
} from '../types/candidate.js';
import type { DiscoveryCriteria } from '../types/criteria.js';
import type { Evidence } from '../types/evidence.js';
import type { DiscoveryQuery } from '../types/query.js';
import type { DiscoveryRun } from '../types/run.js';
import type { VerificationPolicy } from '../types/strategy.js';
import type { VerificationResult } from '../types/verification.js';
import type {
  AiEvaluation,
  AiEvaluationTask,
} from '../types/ai-evaluation.js';

/**
 * Pipeline → adapter context.
 * Extends E2 shape with optional E3.1 cancellation / timeout / metadata.
 * No vendor SDK types.
 */
export type AdapterContext = {
  run: DiscoveryRun;
  now: () => string;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Non-sensitive string metadata only */
  metadata?: Record<string, string>;
};

/**
 * Adapter-neutral search port.
 * Implementations live outside domain I/O concerns; fakes used in tests.
 */
export interface SearchAdapter {
  search(
    queries: DiscoveryQuery[],
    context: AdapterContext
  ): Promise<RawCandidatePayload[]>;
}

export type FetchRequest = {
  url: string;
  candidateId: string;
};

export type FetchSuccess = {
  ok: true;
  content: RawContentRef;
  fetchedAt: string;
  /** Real source URL for attribution — never AI-fabricated */
  sourceUrl: string;
};

export type FetchFailure = {
  ok: false;
  reasonCode: 'FETCH_FAILED' | 'FETCH_TIMEOUT' | 'FETCH_CANCELLED';
  /** E3.1 adapter-neutral code when available (E3.3) */
  failureCode?: import('../adapter-infra/types.js').AdapterFailureCode;
  message: string;
  sourceUrl?: string;
};

export type FetchResult = FetchSuccess | FetchFailure;

/**
 * Adapter-neutral page/body fetch port.
 * Returns a RawContentRef — never embeds vendor HTTP response types.
 * Fetched content is untrusted input (EnginePolicy.externalContentUntrusted).
 */
export interface FetchAdapter {
  fetch(request: FetchRequest, context: AdapterContext): Promise<FetchResult>;
}

export type ExtractionContext = {
  run: DiscoveryRun;
  candidateId: string;
  now: () => string;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type ExtractionSuccess = {
  ok: true;
  extracted: ExtractedFacts;
};

export type ExtractionFailure = {
  ok: false;
  reasonCode: 'PARSE_FAILED';
  message: string;
};

export type ExtractionResult = ExtractionSuccess | ExtractionFailure;

/**
 * Adapter-neutral content → ExtractedFacts port.
 * Must NOT create Evidence, VerificationResult, or promote candidates.
 * Must NOT treat page text as engine instructions.
 */
export interface ContentExtractor {
  extract(
    content: RawContentRef,
    context: ExtractionContext
  ): Promise<ExtractionResult>;
}

export type VerificationRequest = {
  candidateId: string;
  identity: CandidateIdentity;
  source: SourceRef;
  canonicalUrl?: string;
  raw: RawContentRef;
  extracted: ExtractedFacts;
  verificationPolicy: VerificationPolicy;
  /** Optional freshness policy from strategy (E3.5) */
  freshnessPolicy?: import('../types/strategy.js').FreshnessPolicy;
  run: DiscoveryRun;
  now: () => string;
  signal?: AbortSignal;
  timeoutMs?: number;
};

/**
 * Adapter returns checks/evidence; pipeline re-derives status and enforces
 * official-source + Evidence attribution invariants.
 */
export type VerificationSuccess = {
  ok: true;
  /** Status optional — pipeline derives via deriveVerificationStatus */
  result: Omit<VerificationResult, 'status'> & {
    status?: VerificationResult['status'];
  };
  evidence: Evidence[];
};

export type VerificationFailure = {
  ok: false;
  reasonCode: 'VERIFY_ADAPTER_FAILED' | 'VERIFY_TIMEOUT' | 'VERIFY_CANCELLED';
  message: string;
};

export type VerificationAdapterResult = VerificationSuccess | VerificationFailure;

/**
 * Adapter-neutral verification port.
 * Must NOT call LLMs, invent Evidence URLs, or promote candidates.
 */
export interface VerificationAdapter {
  verify(request: VerificationRequest): Promise<VerificationAdapterResult>;
}

export type AiEvaluationRequest = {
  candidateId: string;
  identity: CandidateIdentity;
  extracted: ExtractedFacts;
  verification: VerificationResult;
  evidence: readonly Evidence[];
  criteria: DiscoveryCriteria;
  allowedTasks: readonly AiEvaluationTask[];
  /** Strategy rejectOn codes — used for adapter-side output validation (E3.6) */
  rejectOn?: readonly import('../types/rejection.js').RejectionReasonCode[];
  run: DiscoveryRun;
  now: () => string;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type AiEvaluationSuccess = {
  ok: true;
  evaluation: AiEvaluation;
};

export type AiEvaluationFailure = {
  ok: false;
  reasonCode:
    | 'AI_ADAPTER_FAILED'
    | 'AI_TIMEOUT'
    | 'AI_CANCELLED'
    | 'AI_OUTPUT_INVALID';
  message: string;
};

export type AiAdapterResult = AiEvaluationSuccess | AiEvaluationFailure;

/**
 * Adapter-neutral AI interpretation port.
 * Must NOT verify sources, fabricate Evidence, or mutate VerificationResult.
 */
export interface AiAdapter {
  evaluate(request: AiEvaluationRequest): Promise<AiAdapterResult>;
}

/** Optional ports — missing ports yield explicit stub diagnostics, not silent success. */
export type AdapterPorts = {
  search?: SearchAdapter;
  fetch?: FetchAdapter;
  extract?: ContentExtractor;
  verify?: VerificationAdapter;
  ai?: AiAdapter;
};

export class AdapterError extends Error {
  readonly adapter: string;

  constructor(adapter: string, message: string) {
    super(message);
    this.name = 'AdapterError';
    this.adapter = adapter;
  }
}

/** Search continued with some successful hits after provider failures. */
export class PartialSearchError extends Error {
  readonly adapter = 'search';
  readonly results: RawCandidatePayload[];
  readonly failures: string[];

  constructor(results: RawCandidatePayload[], failures: string[]) {
    super(`Partial search failure: ${failures.join('; ')}`);
    this.name = 'PartialSearchError';
    this.results = results;
    this.failures = failures;
  }
}

/** Build AdapterContext from pipeline fields (E3.1 wiring helper). */
export function toAdapterContext(input: {
  run: DiscoveryRun;
  now: () => string;
  signal?: AbortSignal;
  adapterTimeoutMs?: number;
  metadata?: Record<string, string>;
}): AdapterContext {
  return {
    run: input.run,
    now: input.now,
    signal: input.signal,
    timeoutMs: input.adapterTimeoutMs,
    metadata: input.metadata,
  };
}
