import { z } from 'zod';
import { EconomicEvaluationV1Schema } from './economic-evaluation.js';
import { GraphContextV1Schema } from './graph-context.js';
import { GraphExecutionStateV1Schema } from './graph-execution-state.js';
import { EconomicActionSetV1Schema } from './economic-action-set.js';
import { EconomicPlanV1Schema } from './economic-plan.js';
import { EconomicPresentationV1Schema } from './economic-presentation.js';

export const ECONOMIC_REALITY_API_VERSION = '1.0';

export const EconomicRealityApiVersionSchema = z.literal(ECONOMIC_REALITY_API_VERSION);

export const EconomicRealityPlanErrorCodeSchema = z.enum([
  'ECONOMIC_CONTEXT_INVALID',
  'GRAPH_RESOLUTION_FAILED',
  'EXECUTION_BUILD_FAILED',
  'ACTION_SET_EMPTY',
  'PLAN_BUILD_FAILED',
  'PRESENTATION_BUILD_FAILED',
]);

export type EconomicRealityPlanErrorCode = z.infer<typeof EconomicRealityPlanErrorCodeSchema>;

export const EconomicRealityPlanMetaSchema = z.object({
  requestId: z.string().min(1),
  generatedAt: z.string().datetime(),
  pipelineVersion: z.string().min(1),
  deterministicHash: z.string().min(1),
});

export type EconomicRealityPlanMeta = z.infer<typeof EconomicRealityPlanMetaSchema>;

export const EconomicRealityPlanResponseV1Schema = z.object({
  version: EconomicRealityApiVersionSchema,
  evaluation: EconomicEvaluationV1Schema,
  graph: GraphContextV1Schema,
  execution: GraphExecutionStateV1Schema,
  actionSet: EconomicActionSetV1Schema,
  plan: EconomicPlanV1Schema,
  presentation: EconomicPresentationV1Schema,
  meta: EconomicRealityPlanMetaSchema,
});

export type EconomicRealityPlanResponseV1 = z.infer<typeof EconomicRealityPlanResponseV1Schema>;

export const ECONOMIC_REALITY_PIPELINE_VERSION = 'ep1-ep6-v1';

export function parseEconomicRealityPlanResponseV1(input: unknown): EconomicRealityPlanResponseV1 {
  return EconomicRealityPlanResponseV1Schema.parse(input);
}

export function safeParseEconomicRealityPlanResponseV1(input: unknown) {
  return EconomicRealityPlanResponseV1Schema.safeParse(input);
}
