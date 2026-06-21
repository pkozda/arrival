import type { EconomicFeedbackSignalsV1 } from '@arrival-atlas/product-contract';
import type { EconomicSignalBundle } from './axes.js';

const EMPLOYMENT_PROMOTION_THRESHOLD = 1;
const EMPLOYMENT_INCOME_NUDGE_THRESHOLD = 0.5;
const INSTITUTION_ENGAGEMENT_THRESHOLD = 0.5;
const CRISIS_ESCALATION_THRESHOLD = -0.5;

export function enrichSignalsWithFeedback(
  signals: EconomicSignalBundle,
  feedback: EconomicFeedbackSignalsV1
): EconomicSignalBundle {
  const enriched: EconomicSignalBundle = { ...signals };

  if (feedback.employmentSignalDelta >= EMPLOYMENT_INCOME_NUDGE_THRESHOLD && enriched.incomeAxis === 'none') {
    enriched.incomeAxis = 'low';
  }

  if (
    feedback.employmentSignalDelta >= EMPLOYMENT_PROMOTION_THRESHOLD &&
    enriched.employmentAxis === 'transition'
  ) {
    enriched.employmentAxis = 'employed';
  }

  if (
    feedback.institutionEngagementDelta >= INSTITUTION_ENGAGEMENT_THRESHOLD &&
    enriched.institutionAxis === 'none'
  ) {
    enriched.institutionAxis = 'jobcenter';
    if (enriched.supportSystem === 'none') {
      enriched.supportSystem = 'pending';
    }
  }

  if (feedback.crisisStabilityDelta <= CRISIS_ESCALATION_THRESHOLD) {
    enriched.survivalCrisis = true;
  }

  return enriched;
}
