import { z } from 'zod';
import { EconomicStateIdSchema } from './economic-evaluation.js';

export const ECONOMIC_GRAPH_CONTEXT_SCHEMA_VERSION = '1.0.0';

export const EconomicGraphContextSchemaVersionSchema = z.literal(
  ECONOMIC_GRAPH_CONTEXT_SCHEMA_VERSION
);

export const EconomicGraphIdSchema = z.enum(['G1', 'G2', 'G3', 'G4', 'G5', 'G6']);

export type EconomicGraphId = z.infer<typeof EconomicGraphIdSchema>;

export const EconomicGraphVariantSchema = z.enum(['A', 'B', 'C']);

export type EconomicGraphVariant = z.infer<typeof EconomicGraphVariantSchema>;

export const GraphContextReasoningSchema = z.object({
  primarySelector: z.string(),
  secondarySelector: z.string().optional(),
  ruleTrace: z.array(z.string()).min(1),
});

export type GraphContextReasoning = z.infer<typeof GraphContextReasoningSchema>;

export const GraphContextV1Schema = z.object({
  schemaVersion: EconomicGraphContextSchemaVersionSchema,
  graphId: EconomicGraphIdSchema,
  variant: EconomicGraphVariantSchema.optional(),
  entryNodeId: z.string().min(1),
  reasoning: GraphContextReasoningSchema,
});

export type GraphContextV1 = z.infer<typeof GraphContextV1Schema>;

export const STATE_TO_GRAPH_PRIMARY_SELECTOR: Record<
  z.infer<typeof EconomicStateIdSchema>,
  string
> = {
  self_sustained: 'economicState:E1',
  employment_active: 'economicState:E2',
  unemployment_transition: 'economicState:E3',
  benefits_jobcenter: 'economicState:E4',
  benefits_sozialamt: 'economicState:E5',
  application_pending: 'economicState:E6',
  financial_crisis: 'economicState:E7',
};

export function parseGraphContextV1(input: unknown): GraphContextV1 {
  return GraphContextV1Schema.parse(input);
}

export function safeParseGraphContextV1(input: unknown) {
  return GraphContextV1Schema.safeParse(input);
}
