import { buildEconomicRealityPlan } from '@arrival-atlas/modules/economic-reality';
import type { EconomicRealityPlanResponseV1 } from '@arrival-atlas/product-contract';
import type { SystemState } from './system-state-types.js';
import { resolveUserContext } from './profile-mutation-state.js';
import { resolveEconomicFeedbackSignalsFromState } from './economic-reality-feedback-projection.js';

export function buildEconomicRealityPlanFromState(
  state: SystemState,
  requestId: string
): EconomicRealityPlanResponseV1 {
  const userContext = resolveUserContext(state);
  const feedbackSignals = resolveEconomicFeedbackSignalsFromState(state);

  return buildEconomicRealityPlan(userContext, {
    requestId,
    generatedAt: state.generatedAt,
    feedbackSignals,
  });
}
