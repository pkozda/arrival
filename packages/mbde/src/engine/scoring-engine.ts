import { annualizeValueEstimate, type BenefitNode } from '../types/benefit-node.js';
import {
  DEFAULT_SCORING_WEIGHTS,
  type ScoredBenefit,
} from '../types/scoring.js';
import type { MbdeUserProfile } from '../types/user-profile.js';
import type { EligibilityEvaluation } from './eligibility-engine.js';

function normalizeMonetaryValue(annualValueEur: number): number {
  // Log-scaled weight: €100 → ~0.35, €1000 → ~0.65, €5000 → ~0.9
  if (annualValueEur <= 0) {
    return 0;
  }
  return Math.min(1, Math.log10(annualValueEur + 1) / 4);
}

function timeToReceiveFactor(weeks: number): number {
  return Math.max(0, 1 - weeks / 52);
}

export function scoreBenefit(
  benefit: BenefitNode,
  _profile: MbdeUserProfile,
  evaluation: EligibilityEvaluation
): ScoredBenefit {
  const hints = benefit.scoringHints ?? {
    accessibilityWeight: 0.5,
    effortCostPenalty: 0.3,
    timeToReceiveWeeks: 8,
    retroactivePossible: false,
    stackableWith: [],
  };

  const annualValueEur = annualizeValueEstimate(benefit.valueEstimate);
  const eligibilityConfidence = evaluation.eligible
    ? Math.max(evaluation.confidence, benefit.eligibilityConfidenceBaseline)
    : evaluation.partialMatch
      ? evaluation.confidence * 0.85
      : evaluation.confidence * 0.5;

  const monetaryValueWeight = normalizeMonetaryValue(annualValueEur);
  const accessibilityWeight = hints.accessibilityWeight;
  const effortCostPenalty = hints.effortCostPenalty;
  const timeFactor = timeToReceiveFactor(hints.timeToReceiveWeeks);

  const retroactiveBoost = hints.retroactivePossible ? 0.05 : 0;

  const totalScore =
    eligibilityConfidence * DEFAULT_SCORING_WEIGHTS.eligibilityConfidence +
    monetaryValueWeight * DEFAULT_SCORING_WEIGHTS.monetaryValue +
    accessibilityWeight * DEFAULT_SCORING_WEIGHTS.accessibility -
    effortCostPenalty * DEFAULT_SCORING_WEIGHTS.effortPenalty -
    (1 - timeFactor) * DEFAULT_SCORING_WEIGHTS.timePenalty +
    retroactiveBoost;

  return {
    benefit,
    eligibilityConfidence: Number(eligibilityConfidence.toFixed(3)),
    monetaryValueWeight: Number(monetaryValueWeight.toFixed(3)),
    accessibilityWeight,
    effortCostPenalty,
    timeToReceiveFactor: Number(timeFactor.toFixed(3)),
    totalScore: Number(totalScore.toFixed(4)),
    annualValueEur: Math.round(annualValueEur),
    matchedProbabilistically: !evaluation.eligible && evaluation.partialMatch,
    missingFields: evaluation.missingFields,
  };
}
