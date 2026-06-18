import type { Recommendation } from '../types/Recommendation.js';
import {
  asRecord,
  mapFinancialPriority,
  readPayloadConfidenceFromRecord,
  stringsToFactors,
} from './shared.js';

export function normalizeFinancialRealityRecommendations(
  payload: unknown
): Recommendation[] {
  const record = asRecord(payload);
  if (!record) {
    return [];
  }

  const confidence = readPayloadConfidenceFromRecord(payload);
  const recommendations: Recommendation[] = [];

  const decisions = record.decisions;
  if (Array.isArray(decisions)) {
    decisions.forEach((entry, index) => {
      const decision = asRecord(entry);
      if (!decision) {
        return;
      }

      const title = typeof decision.title === 'string' ? decision.title : `Decision ${index + 1}`;
      const description =
        typeof decision.description === 'string' ? decision.description : title;
      const priority = mapFinancialPriority(
        typeof decision.priority === 'string' ? decision.priority : 'medium'
      );

      recommendations.push({
        id: `financial-decision-${index}`,
        title,
        description,
        priority,
        explanation: {
          summary: description,
          confidence,
          factors: stringsToFactors([description], `decision-${index}-summary`),
        },
      });
    });
  }

  const benefits = asRecord(record.benefits);
  const buergergeld = asRecord(benefits?.buergergeld);
  if (buergergeld?.eligible === true) {
    const reasoning = Array.isArray(buergergeld.reasoning)
      ? buergergeld.reasoning.filter((line): line is string => typeof line === 'string')
      : [];

    recommendations.push({
      id: 'financial-buergergeld-eligible',
      title: 'Potential Bürgergeld eligibility',
      description:
        reasoning[0] ??
        'Household income may qualify for Bürgergeld support based on current inputs.',
      priority: 'high',
      explanation: {
        summary:
          reasoning.join(' ') ||
          'Bürgergeld eligibility was detected from the current household calculation.',
        confidence,
        factors: stringsToFactors(reasoning, 'buergergeld-reasoning'),
        ruleIds: ['buergergeld_eligible'],
      },
      scopeRef: 'benefits.buergergeld',
    });
  }

  return recommendations;
}
