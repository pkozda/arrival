import type { ProfileInsightViewV1 } from '@/lib/product-contract';

export function buildCompletenessSummary(insights: ProfileInsightViewV1): string | null {
  if (insights.globalConfidence === 'high' && insights.missingContext.length <= 1) {
    return 'Your situation is mostly complete.';
  }

  return null;
}

export function resolvePrefillConfidenceMessage(
  insights: ProfileInsightViewV1 | null | undefined
): string {
  if (!insights) {
    return 'Using information from your situation';
  }

  switch (insights.globalConfidence) {
    case 'high':
      return 'Using reliable information from your situation';
    case 'medium':
      return 'Using your situation — some details may need review';
    case 'low':
    default:
      return 'Using your situation — some information may be outdated';
  }
}

export function findMirrorInsight(
  insights: ProfileInsightViewV1 | null | undefined,
  mirrorSlug: string
) {
  return insights?.domainInsights.find((entry) => entry.mirrorSlug === mirrorSlug);
}
