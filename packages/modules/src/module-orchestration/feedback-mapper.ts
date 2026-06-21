import type {
  EconomicFeedbackSignalsV1,
  EconomicRealityEventV1,
} from '@arrival-atlas/product-contract';
import { EMPTY_ECONOMIC_FEEDBACK_SIGNALS } from '@arrival-atlas/product-contract';

const INCOME_PROFILE_DELTA = 1;
const INSTITUTION_INTENT_DELTA = 0.5;
const CRISIS_ESCALATION_DELTA = -0.75;
const EXTERNAL_RESOURCE_REPEAT_THRESHOLD = 2;

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clampSigned(value: number): number {
  return Math.min(1, Math.max(-1, value));
}

function isIncomeProfileEvent(event: EconomicRealityEventV1): boolean {
  return (
    event.profileKey === 'work-income' &&
    (event.type === 'ACTION_EXECUTED' || event.type === 'INTENT_TRIGGERED')
  );
}

function isJobcenterIntentEvent(event: EconomicRealityEventV1): boolean {
  return (
    event.systemIntent === 'start_jobcenter_process' &&
    (event.type === 'ACTION_EXECUTED' || event.type === 'INTENT_TRIGGERED')
  );
}

function isExternalResourceEvent(event: EconomicRealityEventV1): boolean {
  return event.actionType === 'external_resource' && event.type === 'ACTION_EXECUTED';
}

function isFailedIntentEvent(event: EconomicRealityEventV1): boolean {
  return event.type === 'ACTION_FAILED' && event.actionType === 'system_intent';
}

export function mapEventsToFeedbackSignals(
  events: readonly EconomicRealityEventV1[]
): EconomicFeedbackSignalsV1 {
  if (events.length === 0) {
    return { ...EMPTY_ECONOMIC_FEEDBACK_SIGNALS };
  }

  let employmentSignalDelta = 0;
  let institutionEngagementDelta = 0;
  let crisisStabilityDelta = 0;

  let externalResourceCount = 0;
  let failedIntentCount = 0;

  for (const event of events) {
    if (isIncomeProfileEvent(event)) {
      employmentSignalDelta = clampUnit(employmentSignalDelta + INCOME_PROFILE_DELTA);
    }

    if (isJobcenterIntentEvent(event)) {
      institutionEngagementDelta = clampUnit(
        institutionEngagementDelta + INSTITUTION_INTENT_DELTA
      );
    }

    if (isExternalResourceEvent(event)) {
      externalResourceCount += 1;
    }

    if (isFailedIntentEvent(event)) {
      failedIntentCount += 1;
    }
  }

  if (
    externalResourceCount >= EXTERNAL_RESOURCE_REPEAT_THRESHOLD ||
    (externalResourceCount > 0 && failedIntentCount > 0)
  ) {
    crisisStabilityDelta = clampSigned(crisisStabilityDelta + CRISIS_ESCALATION_DELTA);
  }

  return {
    schemaVersion: EMPTY_ECONOMIC_FEEDBACK_SIGNALS.schemaVersion,
    employmentSignalDelta,
    institutionEngagementDelta,
    crisisStabilityDelta,
  };
}
