import type { EconomicRealityPlanMeta } from '@arrival-atlas/product-contract';
import type { EconomicRealityPlanResponseV1 } from '@arrival-atlas/product-contract';

const ECONOMIC_REALITY_API_VERSION = '1.0' as const;
import type { PipelineBuildResult } from './types.js';

export function buildEconomicRealityPlanResponse(input: {
  pipeline: PipelineBuildResult;
  meta: EconomicRealityPlanMeta;
}): EconomicRealityPlanResponseV1 {
  return {
    version: ECONOMIC_REALITY_API_VERSION,
    evaluation: input.pipeline.evaluation,
    graph: input.pipeline.graph,
    execution: input.pipeline.execution,
    actionSet: input.pipeline.actionSet,
    plan: input.pipeline.plan,
    presentation: input.pipeline.presentation,
    meta: input.meta,
  };
}
