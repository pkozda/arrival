import { mapEventsToFeedbackSignals } from '@arrival-atlas/modules/module-orchestration';
import type { EconomicFeedbackSignalsV1 } from '@arrival-atlas/product-contract';
import type { SystemState } from './system-state-types.js';

export function resolveEconomicFeedbackSignalsFromState(
  state: SystemState
): EconomicFeedbackSignalsV1 {
  return mapEventsToFeedbackSignals(state.economicRealityEvents ?? []);
}
