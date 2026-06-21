import type {
  EconomicActionSetV1,
  EconomicEvaluationV1,
  EconomicPlanV1,
  EconomicPresentationV1,
  GraphContextV1,
  GraphExecutionStateV1,
} from '@/lib/product-contract';

export type EconomicRealityClientStateV1 = {
  loading: boolean;
  error: string | null;

  lastUpdated: string | null;
  deterministicHash: string | null;

  evaluation?: EconomicEvaluationV1;
  graph?: GraphContextV1;
  execution?: GraphExecutionStateV1;
  actionSet?: EconomicActionSetV1;
  plan?: EconomicPlanV1;
  presentation?: EconomicPresentationV1;
};

export const EMPTY_ECONOMIC_REALITY_CLIENT_STATE: EconomicRealityClientStateV1 = {
  loading: true,
  error: null,
  lastUpdated: null,
  deterministicHash: null,
};
