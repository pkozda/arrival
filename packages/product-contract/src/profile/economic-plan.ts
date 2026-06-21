import { z } from 'zod';
import { EconomicGraphIdSchema } from './graph-context.js';
import { EconomicActionV1Schema } from './economic-action-set.js';

export const ECONOMIC_PLAN_SCHEMA_VERSION = '1.0.0';

export const EconomicPlanSchemaVersionSchema = z.literal(ECONOMIC_PLAN_SCHEMA_VERSION);

export const OrderingStrategySchema = z.enum([
  'CRISIS_FIRST',
  'INSTITUTION_FIRST',
  'PROGRESSION_FIRST',
]);

export type OrderingStrategy = z.infer<typeof OrderingStrategySchema>;

export const EconomicPlanTrackV1Schema = z.object({
  trackId: z.string().min(1),
  actions: z.array(EconomicActionV1Schema),
  priority: z.number().min(0).max(100),
});

export type EconomicPlanTrackV1 = z.infer<typeof EconomicPlanTrackV1Schema>;

export const EconomicPlanReasoningSchema = z.object({
  appliedRules: z.array(z.string()).min(1),
  prioritizationPath: z.array(z.string()).min(1),
});

export type EconomicPlanReasoning = z.infer<typeof EconomicPlanReasoningSchema>;

export const EconomicPlanV1Schema = z.object({
  schemaVersion: EconomicPlanSchemaVersionSchema,
  planId: z.string().min(1),
  graphId: EconomicGraphIdSchema,
  primaryTrack: EconomicPlanTrackV1Schema,
  secondaryTrack: EconomicPlanTrackV1Schema.optional(),
  systemTrack: EconomicPlanTrackV1Schema,
  orderingStrategy: OrderingStrategySchema,
  reasoning: EconomicPlanReasoningSchema,
});

export type EconomicPlanV1 = z.infer<typeof EconomicPlanV1Schema>;

export function parseEconomicPlanV1(input: unknown): EconomicPlanV1 {
  return EconomicPlanV1Schema.parse(input);
}

export function safeParseEconomicPlanV1(input: unknown) {
  return EconomicPlanV1Schema.safeParse(input);
}

export const TRACK_PRIORITY_BY_STRATEGY: Record<
  OrderingStrategy,
  { primary: number; secondary: number; system: number }
> = {
  CRISIS_FIRST: { primary: 100, secondary: 35, system: 20 },
  INSTITUTION_FIRST: { primary: 90, secondary: 45, system: 20 },
  PROGRESSION_FIRST: { primary: 80, secondary: 40, system: 20 },
};
