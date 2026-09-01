import type {
  AiEvaluation,
  AiEvaluationTask,
  AiEvaluationTaskResult,
} from '../types/ai-evaluation.js';
import type { AiEvaluationPolicy } from '../types/strategy.js';
import type { EnginePolicy } from '../engine-policy.js';
import { resolveAiCostPolicy } from './ai-cost.js';

export type AiGateBlockReason =
  | 'FILTER_NOT_PASSED'
  | 'VERIFICATION_NOT_PASS'
  | 'AI_DISABLED_STRATEGY'
  | 'AI_DISABLED_ENGINE'
  | 'AI_BUDGET_EXHAUSTED'
  | 'AI_TOKEN_BUDGET_EXHAUSTED'
  | 'AI_ALREADY_EVALUATED'
  | 'NO_TASKS'
  | 'ADAPTER_MISSING';

export type AiGateDecision =
  | { allow: true; tasks: AiEvaluationTask[] }
  | { allow: false; reason: AiGateBlockReason };

/**
 * Formal AI gate (pipeline §6 + E2.4 + roadmap E6 cost/dedupe).
 * Verification establishes facts; AI may interpret only after PASS.
 * Budget exhaustion and dedupe are skips — not adapter failures.
 */
export function evaluateAiGate(input: {
  candidate: {
    deterministicFilterPassed: boolean;
    rejection?: unknown;
    verification?: { status: string };
  };
  strategyPolicy: AiEvaluationPolicy;
  enginePolicy: EnginePolicy;
  aiEvaluationsUsed: number;
  hasAdapter: boolean;
  /** When true, compatible evaluation already exists — skip provider */
  alreadyEvaluated?: boolean;
  estimatedInputTokensUsed?: number;
  estimatedOutputTokensUsed?: number;
  pendingEstimatedInputTokens?: number;
  pendingEstimatedOutputTokens?: number;
}): AiGateDecision {
  if (!input.candidate.deterministicFilterPassed || input.candidate.rejection) {
    return { allow: false, reason: 'FILTER_NOT_PASSED' };
  }

  if (
    input.candidate.verification?.status !== 'PASS' ||
    !input.candidate.deterministicFilterPassed
  ) {
    return { allow: false, reason: 'VERIFICATION_NOT_PASS' };
  }

  if (!input.enginePolicy.aiEnabled) {
    return { allow: false, reason: 'AI_DISABLED_ENGINE' };
  }

  if (!input.strategyPolicy.enabled) {
    return { allow: false, reason: 'AI_DISABLED_STRATEGY' };
  }

  if (input.alreadyEvaluated) {
    return { allow: false, reason: 'AI_ALREADY_EVALUATED' };
  }

  const cost = resolveAiCostPolicy(input.enginePolicy);

  if (input.aiEvaluationsUsed >= cost.maxEvaluationsPerRun) {
    return { allow: false, reason: 'AI_BUDGET_EXHAUSTED' };
  }

  const inputUsed = input.estimatedInputTokensUsed ?? 0;
  const outputUsed = input.estimatedOutputTokensUsed ?? 0;
  const pendingIn = input.pendingEstimatedInputTokens ?? 0;
  const pendingOut = input.pendingEstimatedOutputTokens ?? 0;

  if (
    cost.maxEstimatedInputTokensPerRun !== undefined &&
    inputUsed + pendingIn > cost.maxEstimatedInputTokensPerRun
  ) {
    return { allow: false, reason: 'AI_TOKEN_BUDGET_EXHAUSTED' };
  }

  if (
    cost.maxEstimatedOutputTokensPerRun !== undefined &&
    outputUsed + pendingOut > cost.maxEstimatedOutputTokensPerRun
  ) {
    return { allow: false, reason: 'AI_TOKEN_BUDGET_EXHAUSTED' };
  }

  if (!input.hasAdapter) {
    return { allow: false, reason: 'ADAPTER_MISSING' };
  }

  const tasks = [...input.strategyPolicy.tasks] as AiEvaluationTask[];
  if (tasks.length === 0) {
    return { allow: false, reason: 'NO_TASKS' };
  }

  return { allow: true, tasks };
}

export type AiEvaluationValidationResult =
  | { ok: true; evaluation: AiEvaluation }
  | { ok: false; reason: string };

const FORBIDDEN_DETAIL_KEYS = new Set([
  'verificationStatus',
  'verification',
  'officialSource',
  'evidence',
  'sourceUrl',
  'fabricatedUrl',
  'aiVerified',
  'aiEvidence',
  'aiOfficialSource',
  'aiConfirmed',
]);

/**
 * Pure validation of AI adapter output.
 * Does not trust adapter blindly.
 */
export function validateAiEvaluation(input: {
  evaluation: AiEvaluation;
  allowedTasks: readonly AiEvaluationTask[];
  rejectOn: readonly string[];
  knownEvidenceIds: ReadonlySet<string>;
}): AiEvaluationValidationResult {
  const allowed = new Set(input.allowedTasks);
  const rejectOn = new Set(input.rejectOn);
  const tasks: AiEvaluationTaskResult[] = [];

  if (!Array.isArray(input.evaluation.tasks)) {
    return { ok: false, reason: 'INVALID_TASKS_SHAPE' };
  }

  if (!input.evaluation.evaluatedAt?.trim()) {
    return { ok: false, reason: 'MISSING_EVALUATED_AT' };
  }

  for (const taskResult of input.evaluation.tasks) {
    if (!allowed.has(taskResult.task)) {
      return { ok: false, reason: `UNSUPPORTED_TASK:${taskResult.task}` };
    }

    if (
      taskResult.outcome !== 'INTERPRETED' &&
      taskResult.outcome !== 'INCONCLUSIVE' &&
      taskResult.outcome !== 'REJECT_RECOMMENDED'
    ) {
      return { ok: false, reason: `INVALID_OUTCOME:${String(taskResult.outcome)}` };
    }

    if (taskResult.interpretationConfidence !== undefined) {
      const c = taskResult.interpretationConfidence;
      if (typeof c !== 'number' || Number.isNaN(c) || c < 0 || c > 1) {
        return { ok: false, reason: 'INVALID_INTERPRETATION_CONFIDENCE' };
      }
    }

    if (taskResult.evidenceIds) {
      for (const id of taskResult.evidenceIds) {
        if (!input.knownEvidenceIds.has(id)) {
          return { ok: false, reason: `UNKNOWN_EVIDENCE_ID:${id}` };
        }
      }
    }

    if (taskResult.details) {
      for (const key of Object.keys(taskResult.details)) {
        if (FORBIDDEN_DETAIL_KEYS.has(key)) {
          return { ok: false, reason: `FORBIDDEN_DETAIL_KEY:${key}` };
        }
      }
      // Reject fabricated URL claims in details
      for (const [key, value] of Object.entries(taskResult.details)) {
        if (
          typeof value === 'string' &&
          (key.toLowerCase().includes('url') || key.toLowerCase().includes('evidence'))
        ) {
          return { ok: false, reason: `FORBIDDEN_URL_DETAIL:${key}` };
        }
      }
    }

    if (taskResult.outcome === 'REJECT_RECOMMENDED') {
      const code = taskResult.recommendedRejection;
      if (!code) {
        return { ok: false, reason: 'MISSING_RECOMMENDED_REJECTION' };
      }
      if (!rejectOn.has(code)) {
        return { ok: false, reason: `REJECTION_NOT_PERMITTED:${code}` };
      }
    } else if (taskResult.recommendedRejection) {
      return { ok: false, reason: 'REJECTION_WITHOUT_REJECT_OUTCOME' };
    }

    tasks.push({
      task: taskResult.task,
      outcome: taskResult.outcome,
      interpretationConfidence: taskResult.interpretationConfidence,
      details: taskResult.details ? { ...taskResult.details } : undefined,
      evidenceIds: taskResult.evidenceIds
        ? [...taskResult.evidenceIds]
        : undefined,
      recommendedRejection: taskResult.recommendedRejection,
    });
  }

  return {
    ok: true,
    evaluation: {
      tasks,
      evaluatedAt: input.evaluation.evaluatedAt,
      modelLabel: input.evaluation.modelLabel,
      inputFingerprint: input.evaluation.inputFingerprint,
    },
  };
}
