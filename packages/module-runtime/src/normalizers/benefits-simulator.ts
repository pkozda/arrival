import type { Recommendation } from '../types/Recommendation.js';
import {
  asRecord,
  rationaleToExplanation,
  readPayloadConfidenceFromRecord,
} from './shared.js';

function mapBenefitsPriority(
  priority: string
): Recommendation['priority'] {
  if (
    priority === 'critical' ||
    priority === 'high' ||
    priority === 'medium' ||
    priority === 'low'
  ) {
    return priority;
  }

  return 'medium';
}

export function normalizeBenefitsSimulatorRecommendations(
  payload: unknown
): Recommendation[] {
  const record = asRecord(payload);
  if (!record) {
    return [];
  }

  const confidence = readPayloadConfidenceFromRecord(payload);
  const recommendations: Recommendation[] = [];

  const legacyRecommendations = record.recommendations;
  if (Array.isArray(legacyRecommendations)) {
    legacyRecommendations.forEach((entry, index) => {
      const recommendation = asRecord(entry);
      if (!recommendation) {
        return;
      }

      const title =
        typeof recommendation.title === 'string'
          ? recommendation.title
          : `Recommendation ${index + 1}`;
      const description =
        typeof recommendation.description === 'string'
          ? recommendation.description
          : title;
      const rationale =
        typeof recommendation.rationale === 'string'
          ? recommendation.rationale
          : description;
      const id =
        typeof recommendation.id === 'string'
          ? recommendation.id
          : `benefits-recommendation-${index}`;

      recommendations.push({
        id,
        title,
        description,
        priority: mapBenefitsPriority(
          typeof recommendation.priority === 'string' ? recommendation.priority : 'medium'
        ),
        explanation: rationaleToExplanation(rationale, confidence),
        scopeRef:
          typeof recommendation.scenarioId === 'string'
            ? recommendation.scenarioId
            : undefined,
      });
    });
  }

  const riskWarnings = record.riskWarnings;
  if (Array.isArray(riskWarnings)) {
    riskWarnings.forEach((entry, index) => {
      const warning = asRecord(entry);
      if (!warning) {
        return;
      }

      const title =
        typeof warning.title === 'string' ? warning.title : `Risk warning ${index + 1}`;
      const description =
        typeof warning.description === 'string' ? warning.description : title;
      const id =
        typeof warning.id === 'string' ? warning.id : `benefits-risk-${index}`;
      const category =
        typeof warning.category === 'string' ? warning.category : 'financial';

      const factors = [
        {
          id: 'category',
          label: 'Category',
          value: category,
          source: 'rule' as const,
        },
      ];

      if (typeof warning.institution === 'string') {
        factors.push({
          id: 'institution',
          label: 'Institution',
          value: warning.institution,
          source: 'rule' as const,
        });
      }

      recommendations.push({
        id,
        title,
        description,
        priority: mapBenefitsPriority(
          typeof warning.severity === 'string' ? warning.severity : 'medium'
        ),
        explanation: {
          summary: description,
          confidence,
          factors,
          ruleIds: [id],
        },
      });
    });
  }

  return recommendations;
}
