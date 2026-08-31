import type { RejectionReasonCode } from './rejection.js';

/**
 * Strategy-enabled AI tasks (AiEvaluationPolicy.tasks vocabulary).
 */
export type AiEvaluationTask =
  | 'CLASSIFY'
  | 'EXTRACT'
  | 'RELEVANCE'
  | 'PURCHASE_REQUIREMENT'
  | 'SENIORITY';

/**
 * Interpretation outcomes — not verification truth.
 * REJECT_RECOMMENDED may only map to strategy.rejectOn codes.
 */
export type AiInterpretationOutcome =
  | 'INTERPRETED'
  | 'INCONCLUSIVE'
  | 'REJECT_RECOMMENDED';

/**
 * One task result. Confidence is in the *interpretation*, not external-fact truth.
 */
export type AiEvaluationTaskResult = {
  task: AiEvaluationTask;
  outcome: AiInterpretationOutcome;
  /**
   * Confidence in the AI interpretation (0..1).
   * Must NOT be merged into Score.confidenceScore in E2.4.
   */
  interpretationConfidence?: number;
  details?: Record<string, string | number | boolean | null>;
  /** May only reference Evidence IDs already supplied to the AI stage */
  evidenceIds?: string[];
  /** Only valid when outcome is REJECT_RECOMMENDED and code ∈ rejectOn */
  recommendedRejection?: RejectionReasonCode;
};

/**
 * AI interpretation metadata. Never Evidence. Never VerificationResult.
 */
export type AiEvaluation = {
  tasks: AiEvaluationTaskResult[];
  evaluatedAt: string;
  /** Opaque diagnostic label — not a vendor SDK type */
  modelLabel?: string;
};
