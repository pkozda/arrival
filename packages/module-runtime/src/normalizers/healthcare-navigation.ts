import type { Recommendation } from '../types/Recommendation.js';
import { asRecord, stringsToFactors } from './shared.js';

type HealthcareStep = {
  order?: number;
  title?: string;
  description?: string;
  institution?: string;
};

type HealthcareDecision = {
  title?: string;
  options?: Array<{ label?: string }>;
};

/**
 * Maps healthcare domain payload into MRC recommendations.
 * Preserves semantic honesty: MORE_INFO / NO_APPLICABLE yield no fabricated recommendations.
 */
export function normalizeHealthcareNavigationRecommendations(
  payload: unknown
): Recommendation[] {
  const record = asRecord(payload);
  if (!record) {
    return [];
  }

  const outcome = typeof record.outcome === 'string' ? record.outcome : undefined;
  if (outcome === 'MORE_INFO_REQUIRED' || outcome === 'NO_APPLICABLE_RESULT') {
    return [];
  }

  const recommendations: Recommendation[] = [];
  const steps = Array.isArray(record.steps) ? record.steps : [];

  steps.forEach((entry, index) => {
    const step = asRecord(entry) as HealthcareStep | null;
    if (!step || typeof step.title !== 'string' || step.title.length === 0) {
      return;
    }

    const description =
      typeof step.description === 'string' && step.description.length > 0
        ? step.description
        : step.title;
    const institution =
      typeof step.institution === 'string' && step.institution.length > 0
        ? step.institution
        : undefined;

    recommendations.push({
      id: `healthcare-step-${typeof step.order === 'number' ? step.order : index + 1}`,
      title: step.title,
      description,
      priority: index === 0 ? 'high' : 'medium',
      explanation: {
        summary: description,
        confidence: 'medium',
        factors: stringsToFactors(
          [description, institution].filter((value): value is string => Boolean(value)),
          `healthcare-step-${index}`
        ),
      },
      scopeRef: 'healthcare.steps',
    });
  });

  const decisions = Array.isArray(record.decisions) ? record.decisions : [];
  decisions.forEach((entry, index) => {
    const decision = asRecord(entry) as HealthcareDecision | null;
    if (!decision || typeof decision.title !== 'string' || decision.title.length === 0) {
      return;
    }

    const optionLabels = Array.isArray(decision.options)
      ? decision.options
          .map((option) => asRecord(option)?.label)
          .filter((label): label is string => typeof label === 'string' && label.length > 0)
      : [];

    const description =
      optionLabels.length > 0
        ? `Consider: ${optionLabels.join('; ')}`
        : decision.title;

    recommendations.push({
      id: `healthcare-decision-${index + 1}`,
      title: decision.title,
      description,
      priority: 'medium',
      explanation: {
        summary: description,
        confidence: 'medium',
        factors: stringsToFactors([description], `healthcare-decision-${index}`),
      },
      scopeRef: 'healthcare.decisions',
    });
  });

  return recommendations;
}
