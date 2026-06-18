import type { DataProvenanceEntry } from '@arrivalos/core';
import type { ExplanationFactor, ModuleExplanation } from '../types/ModuleExplanation.js';
import type { RecommendationPriority } from '../types/Recommendation.js';
import { readPayloadConfidence } from '../adapters/read-payload-confidence.js';

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export function stringsToFactors(
  strings: string[],
  prefix: string,
  source: ExplanationFactor['source'] = 'rule'
): ExplanationFactor[] {
  return strings.map((value, index) => ({
    id: `${prefix}-${index}`,
    label: 'Reasoning',
    value,
    source,
  }));
}

export function rationaleToExplanation(
  rationale: string,
  confidence: ModuleExplanation['confidence']
): ModuleExplanation {
  return {
    summary: rationale,
    confidence,
    factors: [
      {
        id: 'rationale',
        label: 'Rationale',
        value: rationale,
        source: 'rule',
      },
    ],
  };
}

export function mapFinancialPriority(
  priority: string
): RecommendationPriority {
  if (priority === 'high' || priority === 'medium' || priority === 'low') {
    return priority;
  }

  return 'medium';
}

export function provenanceToFactors(
  provenance: readonly DataProvenanceEntry[]
): ExplanationFactor[] {
  return provenance.map((entry, index) => ({
    id: `provenance-${index}`,
    label: entry.field,
    value: entry.source,
    source:
      entry.source === 'profile'
        ? 'profile'
        : entry.source === 'input' || entry.source === 'override'
          ? 'input'
          : 'default',
  }));
}

export function readPayloadSummary(payload: unknown): string | undefined {
  const record = asRecord(payload);
  if (!record) {
    return undefined;
  }

  if (typeof record.summary === 'string' && record.summary.length > 0) {
    return record.summary;
  }

  const verdict = asRecord(record.verdict);
  if (typeof verdict?.summary === 'string' && verdict.summary.length > 0) {
    return verdict.summary;
  }

  return undefined;
}

export function readPayloadRuleIds(payload: unknown): string[] {
  const record = asRecord(payload);
  if (!record) {
    return [];
  }

  const adminRules = record.adminRules;
  if (!Array.isArray(adminRules)) {
    return [];
  }

  return adminRules.filter((rule): rule is string => typeof rule === 'string');
}

export function readPayloadConfidenceFromRecord(
  payload: unknown
): ModuleExplanation['confidence'] {
  return readPayloadConfidence(payload);
}
