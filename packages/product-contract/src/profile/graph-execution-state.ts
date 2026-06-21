import { z } from 'zod';
import {
  EconomicGraphIdSchema,
  EconomicGraphVariantSchema,
} from './graph-context.js';

export const ECONOMIC_GRAPH_EXECUTION_SCHEMA_VERSION = '1.0.0';

export const EconomicGraphExecutionSchemaVersionSchema = z.literal(
  ECONOMIC_GRAPH_EXECUTION_SCHEMA_VERSION
);

export const EconomicSatisfactionKeySchema = z.enum([
  'registration_confirmed',
  'income_declared',
  'employment_status_known',
  'benefits_active_jobcenter',
  'benefits_active_sozialamt',
  'jobcenter_case_open',
  'sozialamt_case_open',
]);

export type EconomicSatisfactionKey = z.infer<typeof EconomicSatisfactionKeySchema>;

export const NodeStateStatusSchema = z.enum(['locked', 'active', 'completed', 'skipped']);

export type NodeStateStatus = z.infer<typeof NodeStateStatusSchema>;

export const NodeSatisfactionSchema = z.object({
  met: z.boolean(),
  keys: z.array(EconomicSatisfactionKeySchema),
});

export type NodeSatisfaction = z.infer<typeof NodeSatisfactionSchema>;

export const NodeStateV1Schema = z.object({
  nodeId: z.string().min(1),
  status: NodeStateStatusSchema,
  progress: z.number().min(0).max(1),
  satisfaction: NodeSatisfactionSchema,
  blockedBy: z.array(z.string()),
  lastEvaluatedAt: z.string().datetime().optional(),
});

export type NodeStateV1 = z.infer<typeof NodeStateV1Schema>;

export const GraphExecutionDerivedStateSchema = z.object({
  progressRatio: z.number().min(0).max(1),
  blockedNodeIds: z.array(z.string()),
  readyNodeIds: z.array(z.string()),
});

export type GraphExecutionDerivedState = z.infer<typeof GraphExecutionDerivedStateSchema>;

export const GraphExecutionReasoningSchema = z.object({
  initializedFrom: z.string().min(1),
  appliedRules: z.array(z.string()).min(1),
});

export type GraphExecutionReasoning = z.infer<typeof GraphExecutionReasoningSchema>;

export const GraphExecutionStateV1Schema = z.object({
  schemaVersion: EconomicGraphExecutionSchemaVersionSchema,
  graphId: EconomicGraphIdSchema,
  variant: EconomicGraphVariantSchema.optional(),
  entryNodeId: z.string().min(1),
  nodes: z.record(z.string(), NodeStateV1Schema),
  activeNodeIds: z.array(z.string()),
  completedNodeIds: z.array(z.string()),
  derivedState: GraphExecutionDerivedStateSchema,
  reasoning: GraphExecutionReasoningSchema,
});

export type GraphExecutionStateV1 = z.infer<typeof GraphExecutionStateV1Schema>;

export function parseGraphExecutionStateV1(input: unknown): GraphExecutionStateV1 {
  return GraphExecutionStateV1Schema.parse(input);
}

export function safeParseGraphExecutionStateV1(input: unknown) {
  return GraphExecutionStateV1Schema.safeParse(input);
}
