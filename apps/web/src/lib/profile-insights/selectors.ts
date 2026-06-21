import type { ProfileInsightViewV1 } from '@/lib/product-contract';

export function buildCompletenessSummary(insights: ProfileInsightViewV1): string | null {
  if (insights.globalConfidence === 'high' && insights.missingContext.length <= 1) {
    return 'life-event.home.situationMostlyComplete';
  }

  return null;
}

export function resolvePrefillConfidenceMessage(
  insights: ProfileInsightViewV1 | null | undefined
): string {
  if (!insights) {
    return 'life-event.home.prefill.default';
  }

  switch (insights.globalConfidence) {
    case 'high':
      return 'life-event.home.prefill.high';
    case 'medium':
      return 'life-event.home.prefill.medium';
    case 'low':
    default:
      return 'life-event.home.prefill.low';
  }
}

export function findMirrorInsight(
  insights: ProfileInsightViewV1 | null | undefined,
  mirrorSlug: string
) {
  return insights?.domainInsights.find((entry) => entry.mirrorSlug === mirrorSlug);
}
