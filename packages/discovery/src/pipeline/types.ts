import type { DiscoveryCandidate } from '../types/candidate.js';
import type { DiscoveryDigest } from '../types/digest.js';
import type { DiscoveryProfile } from '../types/profile.js';
import type { DiscoveryQuery } from '../types/query.js';
import type { RejectionRecord } from '../types/rejection.js';
import type { DiscoveryRun } from '../types/run.js';
import type { DiscoveryStrategyModule } from '../types/strategy.js';
import type { EnginePolicy } from '../engine-policy.js';
import type { TelemetryEmitter } from '../telemetry/emitter.js';
import type { AdapterPorts } from './adapters.js';
import type { AiEvaluationCache } from './ai-evaluation-cache.js';
import type { ResultStore } from './result-store.js';
import type { ResultWriter } from './result-writer.js';

export type StageId =
  | 'resolve_snapshot'
  | 'build_queries'
  | 'search'
  | 'collect'
  | 'parse'
  | 'normalize'
  | 'deduplicate'
  | 'filter'
  | 'verify'
  | 'ai_evaluate'
  | 'score'
  | 'novelty_state'
  | 'persist_promote'
  | 'digest';

/** Canonical pipeline order (pipeline contract §3). */
export const CANONICAL_STAGE_ORDER: readonly StageId[] = [
  'resolve_snapshot',
  'build_queries',
  'search',
  'collect',
  'parse',
  'normalize',
  'deduplicate',
  'filter',
  'verify',
  'ai_evaluate',
  'score',
  'novelty_state',
  'persist_promote',
  'digest',
] as const;

export type StageResult<T> =
  | { ok: true; value: T }
  | { ok: false; rejection: RejectionRecord };

export type RejectedCandidate = {
  readonly candidate: DiscoveryCandidate;
  readonly rejection: RejectionRecord;
};

export type PipelineBatch = {
  readonly active: ReadonlyArray<DiscoveryCandidate>;
  readonly rejected: ReadonlyArray<RejectedCandidate>;
};

export type StageDiagnostic = {
  runId: string;
  stage: StageId;
  candidateId?: string;
  durationMs: number;
  outcome: 'ok' | 'reject' | 'error' | 'partial' | 'stub';
  reasonCode?: string;
  adapter?: string;
  /** Adapter operation name (E3.1 observability) */
  operation?: string;
  /** Attempt number when retries exist (E3.1 boundary; no auto-retry yet) */
  attempt?: number;
  costUnits?: number;
  message?: string;
};

export type PipelineContext = {
  run: DiscoveryRun;
  profile: DiscoveryProfile;
  strategy: DiscoveryStrategyModule;
  enginePolicy: EnginePolicy;
  adapters: AdapterPorts;
  queries: DiscoveryQuery[];
  now: () => string;
  /** AI evaluations consumed in this run (count cost gate) */
  aiEvaluationsUsed: number;
  /** Estimated AI input tokens consumed this run (deterministic; not billing) */
  aiEstimatedInputTokensUsed: number;
  /** Estimated AI output tokens consumed this run (deterministic; not billing) */
  aiEstimatedOutputTokensUsed: number;
  /** Run-scoped AI evaluation dedupe cache (roadmap E6) */
  aiEvaluationCache: AiEvaluationCache;
  /** Optional side-channel telemetry (E5.5) */
  telemetry?: TelemetryEmitter;
  /** Read-only Result lookup for Novelty / State (E2.6) */
  resultStore?: ResultStore;
  /** Result persistence writer (E2.7) */
  resultWriter?: ResultWriter;
  /** Digest produced by E2.8 (optional until digest stage runs) */
  digest?: DiscoveryDigest;
  /** Optional AbortSignal for adapter I/O (E3.1) */
  signal?: AbortSignal;
  /** Optional default adapter timeout ms (E3.1) — infrastructure, not strategy */
  adapterTimeoutMs?: number;
};

export function emptyBatch(): PipelineBatch {
  return { active: [], rejected: [] };
}

export function withActive(
  batch: PipelineBatch,
  active: readonly DiscoveryCandidate[]
): PipelineBatch {
  return { active: [...active], rejected: [...batch.rejected] };
}

export function withRejection(
  batch: PipelineBatch,
  candidate: DiscoveryCandidate,
  rejection: RejectionRecord
): PipelineBatch {
  const rejectedCandidate: DiscoveryCandidate = {
    ...candidate,
    stage: 'REJECTED',
    rejection,
  };
  return {
    active: batch.active.filter((c) => c.id !== candidate.id),
    rejected: [
      ...batch.rejected,
      { candidate: rejectedCandidate, rejection },
    ],
  };
}

export function appendActive(
  batch: PipelineBatch,
  candidates: readonly DiscoveryCandidate[]
): PipelineBatch {
  return {
    active: [...batch.active, ...candidates],
    rejected: [...batch.rejected],
  };
}
