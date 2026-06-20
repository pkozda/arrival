import type {
  ConfidenceLevel,
  LifeEventPlanV1,
  MissingContextHint,
  ProfileInsightViewV1,
} from '@/lib/product-contract';
import { buildCompletenessSummary } from '@/lib/profile-insights/selectors';

/**
 * LE-6 advisory overlay — pairs P4 insights with a plan reference without mutating plan fields.
 */
export type P4PlanOverlayV1 = {
  contextualHints: MissingContextHint[];
  metadata: {
    globalConfidence: 'high' | 'medium' | 'low' | null;
    planConfidence: ConfidenceLevel | null;
    completenessSummary: string | null;
  };
};

export function mergeP4WithPlan(
  plan: LifeEventPlanV1 | null,
  insights: ProfileInsightViewV1 | null
): P4PlanOverlayV1 {
  return {
    contextualHints: insights?.missingContext ?? [],
    metadata: {
      globalConfidence: insights?.globalConfidence ?? null,
      planConfidence: plan?.reasoning.planConfidence ?? null,
      completenessSummary: insights ? buildCompletenessSummary(insights) : null,
    },
  };
}
