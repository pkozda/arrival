import type {
  EconomicEvaluationV1,
  EconomicFeedbackSignalsV1,
  EconomicRealityEventV1,
  EconomicStateId,
} from '@arrival-atlas/product-contract';

export type EconomicRealityEventLogEntryV1 = {
  event: EconomicRealityEventV1;
  feedbackSignals: EconomicFeedbackSignalsV1;
  economicState?: EconomicStateId;
  deterministicHash?: string;
};

export function appendEconomicRealityEventLogEntry(
  log: EconomicRealityEventLogEntryV1[],
  entry: EconomicRealityEventLogEntryV1
): EconomicRealityEventLogEntryV1[] {
  return [...log, entry];
}

export function traceEconomicStateTransition(input: {
  previousState: EconomicStateId;
  nextState: EconomicStateId;
  feedbackSignals: EconomicFeedbackSignalsV1;
}): {
  changed: boolean;
  previousState: EconomicStateId;
  nextState: EconomicStateId;
  feedbackSignals: EconomicFeedbackSignalsV1;
} {
  return {
    changed: input.previousState !== input.nextState,
    previousState: input.previousState,
    nextState: input.nextState,
    feedbackSignals: input.feedbackSignals,
  };
}

export function summarizeEventLog(log: readonly EconomicRealityEventLogEntryV1[]): {
  eventCount: number;
  stateTransitions: number;
  lastEconomicState?: EconomicStateId;
} {
  let stateTransitions = 0;
  let previousState: EconomicStateId | undefined;

  for (const entry of log) {
    if (!entry.economicState) {
      continue;
    }
    if (previousState && previousState !== entry.economicState) {
      stateTransitions += 1;
    }
    previousState = entry.economicState;
  }

  return {
    eventCount: log.length,
    stateTransitions,
    lastEconomicState: previousState,
  };
}
