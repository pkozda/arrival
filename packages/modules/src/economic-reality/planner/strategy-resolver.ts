import type { GraphExecutionStateV1, OrderingStrategy, UserContextV1 } from '@arrival-atlas/product-contract';
import { evaluateEconomicSatisfactionKeys } from '../execution/satisfaction-keys.js';

export function resolveOrderingStrategy(
  execution: GraphExecutionStateV1,
  userContext: UserContextV1
): { strategy: OrderingStrategy; path: string[] } {
  if (execution.graphId === 'G5') {
    return {
      strategy: 'CRISIS_FIRST',
      path: ['graphId:G5→CRISIS_FIRST'],
    };
  }

  const satisfaction = evaluateEconomicSatisfactionKeys(userContext);
  if (satisfaction.benefits_active_jobcenter || satisfaction.benefits_active_sozialamt) {
    const system =
      satisfaction.benefits_active_jobcenter ? 'benefits_active_jobcenter' : 'benefits_active_sozialamt';
    return {
      strategy: 'INSTITUTION_FIRST',
      path: [`satisfaction:${system}→INSTITUTION_FIRST`],
    };
  }

  return {
    strategy: 'PROGRESSION_FIRST',
    path: ['default→PROGRESSION_FIRST'],
  };
}
