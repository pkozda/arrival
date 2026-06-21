import type {
  EconomicEvaluationV1,
  EconomicFeedbackSignalsV1,
  EconomicStateId,
} from '@arrival-atlas/product-contract';

export type LifeEventFeedbackHintType =
  | 'economic_stability'
  | 'economic_urgency'
  | 'economic_setup_progress';

export type LifeEventFeedbackHintV1 = {
  hintType: LifeEventFeedbackHintType;
  sourceModuleId: 'economic-reality';
  advisoryOnly: true;
  economicState: EconomicStateId;
  messageKey: string;
};

const CRISIS_STATES = new Set<EconomicStateId>(['financial_crisis', 'application_pending']);
const STABILITY_STATES = new Set<EconomicStateId>(['self_sustained', 'employment_active']);

export function deriveLifeEventFeedbackHints(input: {
  evaluation: EconomicEvaluationV1;
  feedbackSignals: EconomicFeedbackSignalsV1;
}): LifeEventFeedbackHintV1[] {
  const hints: LifeEventFeedbackHintV1[] = [];
  const { evaluation, feedbackSignals } = input;

  if (CRISIS_STATES.has(evaluation.economicState) || feedbackSignals.crisisStabilityDelta < 0) {
    hints.push({
      hintType: 'economic_urgency',
      sourceModuleId: 'economic-reality',
      advisoryOnly: true,
      economicState: evaluation.economicState,
      messageKey: 'life-event.feedback.economic_urgency',
    });
  }

  if (STABILITY_STATES.has(evaluation.economicState) || feedbackSignals.employmentSignalDelta > 0) {
    hints.push({
      hintType: 'economic_stability',
      sourceModuleId: 'economic-reality',
      advisoryOnly: true,
      economicState: evaluation.economicState,
      messageKey: 'life-event.feedback.economic_stability',
    });
  }

  if (
    feedbackSignals.institutionEngagementDelta > 0 ||
    evaluation.economicState === 'benefits_jobcenter' ||
    evaluation.economicState === 'benefits_sozialamt'
  ) {
    hints.push({
      hintType: 'economic_setup_progress',
      sourceModuleId: 'economic-reality',
      advisoryOnly: true,
      economicState: evaluation.economicState,
      messageKey: 'life-event.feedback.economic_setup_progress',
    });
  }

  return hints;
}
