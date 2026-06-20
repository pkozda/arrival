import { buildLifeEventPlan } from '@arrival-atlas/modules/life-event';
import type { LifeEventPlanV1 } from '@arrival-atlas/product-contract';
import type { SystemState } from './system-state-types.js';
import { resolveUserContext } from './profile-mutation-state.js';
import { buildProfileInsightsFromState } from './profile-insights-projection.js';

export function buildLifeEventPlanFromState(state: SystemState): LifeEventPlanV1 {
  const userContext = resolveUserContext(state);
  const profileInsights = buildProfileInsightsFromState(state);

  return buildLifeEventPlan({
    userContext,
    profileInsights,
    generatedAt: state.generatedAt,
  });
}
