import type { Score, ScoreBreakdown } from '../types/score.js';
import type { ScoringPolicy } from '../types/strategy.js';

export type ScoreValidationResult =
  | { ok: true; score: Score }
  | { ok: false; reason: string };

type DimensionDef = ScoringPolicy['dimensions'][number];

/**
 * Validate strategy-produced Score. Does not silently clamp.
 */
export function validateScore(input: {
  score: Score;
  policyDimensions: readonly DimensionDef[];
  expectedStrategyVersion: string;
}): ScoreValidationResult {
  const { score } = input;

  if (score.strategyVersion !== input.expectedStrategyVersion) {
    return {
      ok: false,
      reason: `STRATEGY_VERSION_MISMATCH:${score.strategyVersion}!=${input.expectedStrategyVersion}`,
    };
  }

  if (!score.scoredAt?.trim()) {
    return { ok: false, reason: 'MISSING_SCORED_AT' };
  }

  if (!isScoreUnit(score.matchScore)) {
    return { ok: false, reason: `MATCH_SCORE_OUT_OF_RANGE:${score.matchScore}` };
  }
  if (!isScoreUnit(score.confidenceScore)) {
    return {
      ok: false,
      reason: `CONFIDENCE_SCORE_OUT_OF_RANGE:${score.confidenceScore}`,
    };
  }

  const breakdown = score.breakdown;
  if (!breakdown?.dimensions || !Array.isArray(breakdown.dimensions)) {
    return { ok: false, reason: 'MISSING_BREAKDOWN' };
  }

  if (breakdown.dimensions.length === 0) {
    return { ok: false, reason: 'EMPTY_BREAKDOWN' };
  }

  const policyById = new Map(input.policyDimensions.map((d) => [d.id, d]));
  if (breakdown.dimensions.length !== input.policyDimensions.length) {
    return {
      ok: false,
      reason: `BREAKDOWN_DIMENSION_COUNT:${breakdown.dimensions.length}!=${input.policyDimensions.length}`,
    };
  }

  for (const dim of breakdown.dimensions) {
    const policy = policyById.get(dim.id);
    if (!policy) {
      return { ok: false, reason: `UNKNOWN_DIMENSION:${dim.id}` };
    }
    if (dim.labelKey !== policy.labelKey) {
      return { ok: false, reason: `DIMENSION_LABEL_MISMATCH:${dim.id}` };
    }
    if (dim.weight !== policy.weight) {
      return { ok: false, reason: `DIMENSION_WEIGHT_MISMATCH:${dim.id}` };
    }
    if (!isScoreUnit(dim.value)) {
      return {
        ok: false,
        reason: `DIMENSION_VALUE_OUT_OF_RANGE:${dim.id}:${dim.value}`,
      };
    }
  }

  return {
    ok: true,
    score: {
      matchScore: score.matchScore,
      confidenceScore: score.confidenceScore,
      breakdown: cloneBreakdown(breakdown),
      scoredAt: score.scoredAt,
      strategyVersion: score.strategyVersion,
    },
  };
}

function isScoreUnit(value: number): boolean {
  return (
    typeof value === 'number' && !Number.isNaN(value) && value >= 0 && value <= 100
  );
}

function cloneBreakdown(breakdown: ScoreBreakdown): ScoreBreakdown {
  return {
    dimensions: breakdown.dimensions.map((d) => ({
      ...d,
      triStateInputs: d.triStateInputs ? { ...d.triStateInputs } : undefined,
    })),
  };
}

/** Weighted match helper for strategy stubs — not an engine ranking formula. */
export function weightedMatchFromDimensions(
  dimensions: Array<{ value: number; weight: number }>
): number {
  const weightSum = dimensions.reduce((s, d) => s + d.weight, 0);
  if (weightSum <= 0) return 0;
  const raw = dimensions.reduce((s, d) => s + d.value * d.weight, 0) / weightSum;
  return roundScore(raw);
}

export function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}
