import { createHash } from 'node:crypto';
import type {
  EconomicActionSetV1,
  EconomicEvaluationV1,
  EconomicPlanV1,
  EconomicPresentationV1,
  GraphContextV1,
  GraphExecutionStateV1,
} from '@arrival-atlas/product-contract';

export function computePipelineDeterministicHash(input: {
  evaluation: EconomicEvaluationV1;
  graph: GraphContextV1;
  execution: GraphExecutionStateV1;
  actionSet: EconomicActionSetV1;
  plan: EconomicPlanV1;
  presentation: EconomicPresentationV1;
}): string {
  const payload = JSON.stringify({
    evaluation: input.evaluation,
    graph: input.graph,
    execution: input.execution,
    actionSet: input.actionSet,
    plan: input.plan,
    presentation: input.presentation,
  });

  return createHash('sha256').update(payload).digest('hex');
}
