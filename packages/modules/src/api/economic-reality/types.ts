import type {
  EconomicActionSetV1,
  EconomicEvaluationV1,
  EconomicPlanV1,
  EconomicPresentationV1,
  GraphContextV1,
  GraphExecutionStateV1,
} from '@arrival-atlas/product-contract';

export type PipelineBuildResult = {
  evaluation: EconomicEvaluationV1;
  graph: GraphContextV1;
  execution: GraphExecutionStateV1;
  actionSet: EconomicActionSetV1;
  plan: EconomicPlanV1;
  presentation: EconomicPresentationV1;
};
