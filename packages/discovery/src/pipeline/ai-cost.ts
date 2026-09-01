import type { EnginePolicy } from '../engine-policy.js';

/**
 * Provider-neutral AI cost policy (canonical roadmap E6).
 * Token figures are deterministic estimates — never billing-accurate provider usage.
 */
export type AiCostPolicy = {
  /** Max AI adapter invocations that may be attempted per DiscoveryRun. */
  maxEvaluationsPerRun: number;
  /**
   * Optional estimated input-token budget per run.
   * Undefined = unlimited (backward compatible).
   */
  maxEstimatedInputTokensPerRun?: number;
  /**
   * Optional estimated output-token budget per run.
   * Undefined = unlimited (backward compatible).
   */
  maxEstimatedOutputTokensPerRun?: number;
};

/** Reserved estimated output tokens before a call (task-count heuristic). */
export const DEFAULT_AI_OUTPUT_TOKEN_RESERVE_PER_TASK = 64;
export const DEFAULT_AI_OUTPUT_TOKEN_RESERVE_MIN = 128;

/**
 * Resolve cost policy from EnginePolicy without breaking existing fields.
 */
export function resolveAiCostPolicy(enginePolicy: EnginePolicy): AiCostPolicy {
  return {
    maxEvaluationsPerRun: enginePolicy.maxAiEvaluationsPerRun,
    maxEstimatedInputTokensPerRun: enginePolicy.maxEstimatedAiInputTokensPerRun,
    maxEstimatedOutputTokensPerRun: enginePolicy.maxEstimatedAiOutputTokensPerRun,
  };
}

/**
 * Deterministic token estimate from structured JSON payload size.
 * Uses ~4 UTF-8 chars ≈ 1 token. Never invents usage from missing data.
 */
export function estimateTokensFromStructuredPayload(value: unknown): number {
  if (value === undefined || value === null) return 0;
  const encoded = stableJsonStringify(value);
  if (encoded.length === 0) return 0;
  return Math.ceil(encoded.length / 4);
}

/**
 * Pre-call output reserve so budgets can be checked before the provider responds.
 */
export function estimateReservedOutputTokens(taskCount: number): number {
  const n = Math.max(0, taskCount);
  return Math.max(
    DEFAULT_AI_OUTPUT_TOKEN_RESERVE_MIN,
    n * DEFAULT_AI_OUTPUT_TOKEN_RESERVE_PER_TASK
  );
}

/**
 * Stable JSON for fingerprint / token accounting — sorted object keys, no undefined.
 */
export function stableJsonStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value === undefined ? null : value;
  }
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const v = obj[key];
    if (v === undefined) continue;
    out[key] = sortValue(v);
  }
  return out;
}
