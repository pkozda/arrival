import type { LifeEventPlanV1 } from '@/lib/product-contract';
import { suggestModulesForLifeContext } from '@arrival-atlas/modules';

export function suggestEconomicModulesFromLifePlan(plan: LifeEventPlanV1) {
  return suggestModulesForLifeContext({
    lifeStateId: plan.currentLifeState,
    nodeIds: plan.nextBestActions.map((action) => action.id),
  });
}
