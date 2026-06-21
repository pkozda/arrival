import type { EconomicFeedbackSignalsV1, UserContextV1, EconomicEvaluationV1 } from '@arrival-atlas/product-contract';

const ECONOMIC_EVALUATION_SCHEMA_VERSION = '1.0.0' as const;
import { computeEconomicSignals } from './axes.js';
import {
  computeConfidenceScore,
  detectEconomicBlockers,
  mapPlanConfidence,
} from './confidence.js';
import { buildEvaluationFromRules } from './rules.js';
import { enrichSignalsWithFeedback } from './signal-enrichment.js';

export type EvaluateOptions = {
  feedbackSignals?: EconomicFeedbackSignalsV1;
};

export function evaluate(context: UserContextV1, options?: EvaluateOptions): EconomicEvaluationV1 {
  const baseSignals = computeEconomicSignals(context);
  const signals = options?.feedbackSignals
    ? enrichSignalsWithFeedback(baseSignals, options.feedbackSignals)
    : baseSignals;
  const blockers = detectEconomicBlockers(context);
  const confidenceScore = computeConfidenceScore(context, blockers);
  const planConfidence = mapPlanConfidence(confidenceScore);
  const core = buildEvaluationFromRules(signals, blockers, confidenceScore, planConfidence);

  return {
    schemaVersion: ECONOMIC_EVALUATION_SCHEMA_VERSION,
    ...core,
    confidenceScore,
    planConfidence,
    blockers,
  };
}

export function classifyEconomicState(context: UserContextV1, options?: EvaluateOptions) {
  return evaluate(context, options).economicState;
}
