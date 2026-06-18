import type { ModuleRuntimeContext } from '../types/ModuleRuntimeContext.js';
import type { ModuleExplanation } from '../types/ModuleExplanation.js';
import type { Recommendation } from '../types/Recommendation.js';
import {
  asRecord,
  provenanceToFactors,
  readPayloadConfidenceFromRecord,
  readPayloadRuleIds,
  readPayloadSummary,
  stringsToFactors,
} from './shared.js';

export type GenerateModuleExplanationParams = {
  moduleId: string;
  payload: unknown;
  recommendations: readonly Recommendation[];
  runtimeContext?: ModuleRuntimeContext;
  mergedInput?: Record<string, unknown>;
};

function profileSliceToFactors(
  runtimeContext?: ModuleRuntimeContext
): ModuleExplanation['factors'] {
  const slice = runtimeContext?.profileSlice;
  if (!slice) {
    return [];
  }

  const factors: ModuleExplanation['factors'][number][] = [];
  const entries: Array<[string, unknown]> = [
    ['preferredLanguage', slice.preferredLanguage],
    ['employment.status', slice.employment?.status],
    ['employment.grossMonthlyIncome', slice.employment?.grossMonthlyIncome],
    ['household.size', slice.household?.size],
    ['housing.monthlyColdRent', slice.housing?.monthlyColdRent],
    ['insurance.hasCoverage', slice.insurance?.hasCoverage],
    ['benefits.daysInGermany', slice.benefits?.daysInGermany],
  ];

  for (const [label, value] of entries) {
    if (value === undefined) {
      continue;
    }

    factors.push({
      id: `profile-${label.replace(/\./g, '-')}`,
      label,
      value: value as string | number | boolean,
      source: 'profile',
    });
  }

  return factors;
}

function mergedInputToFactors(
  mergedInput?: Record<string, unknown>
): ModuleExplanation['factors'] {
  if (!mergedInput) {
    return [];
  }

  return Object.entries(mergedInput)
    .filter(([, value]) => value !== undefined)
    .map(([key, value], index) => ({
      id: `input-${index}`,
      label: key,
      value:
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
          ? value
          : JSON.stringify(value),
      source: 'input' as const,
    }));
}

function resolveSummary(
  payload: unknown,
  recommendations: readonly Recommendation[]
): string {
  const payloadSummary = readPayloadSummary(payload);
  if (payloadSummary) {
    return payloadSummary;
  }

  if (recommendations.length > 0) {
    return recommendations[0]!.explanation.summary || recommendations[0]!.title;
  }

  return 'Execution completed successfully';
}

function resolveConfidence(
  payload: unknown,
  runtimeContext?: ModuleRuntimeContext
): ModuleExplanation['confidence'] {
  const payloadConfidence = readPayloadConfidenceFromRecord(payload);

  if (!runtimeContext?.profileId || !runtimeContext.profileSlice) {
    return payloadConfidence === 'high' ? 'medium' : payloadConfidence;
  }

  return payloadConfidence;
}

function collectRecommendationFactors(
  recommendations: readonly Recommendation[]
): ModuleExplanation['factors'] {
  const factors: ModuleExplanation['factors'][number][] = [];

  for (const recommendation of recommendations) {
    for (const factor of recommendation.explanation.factors) {
      factors.push(factor);
    }
  }

  return factors;
}

function readBuergergeldReasoning(payload: unknown): string[] {
  const record = asRecord(payload);
  const benefits = asRecord(record?.benefits);
  const buergergeld = asRecord(benefits?.buergergeld);
  const reasoning = buergergeld?.reasoning;

  if (!Array.isArray(reasoning)) {
    return [];
  }

  return reasoning.filter((line): line is string => typeof line === 'string');
}

export function generateModuleExplanation(
  params: GenerateModuleExplanationParams
): ModuleExplanation {
  const buergergeldReasoning = stringsToFactors(
    readBuergergeldReasoning(params.payload),
    'buergergeld'
  );

  const factors = [
    ...provenanceToFactors(params.runtimeContext?.dataProvenance ?? []),
    ...profileSliceToFactors(params.runtimeContext),
    ...mergedInputToFactors(params.mergedInput),
    ...buergergeldReasoning,
    ...collectRecommendationFactors(params.recommendations),
  ];

  const ruleIds = [
    ...readPayloadRuleIds(params.payload),
    ...params.recommendations.flatMap(
      (recommendation) => recommendation.explanation.ruleIds ?? []
    ),
  ];

  const uniqueRuleIds = [...new Set(ruleIds)];

  return {
    summary: resolveSummary(params.payload, params.recommendations),
    confidence: resolveConfidence(params.payload, params.runtimeContext),
    factors,
    ...(uniqueRuleIds.length > 0 ? { ruleIds: uniqueRuleIds } : {}),
  };
}
