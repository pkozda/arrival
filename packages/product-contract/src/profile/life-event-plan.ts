import { z } from 'zod';
import { ConfidenceLevelSchema } from './profile-insight-view.js';

export const LIFE_EVENT_PLAN_SCHEMA_VERSION = '1.0.0';

export const LifeEventPlanSchemaVersionSchema = z.literal(LIFE_EVENT_PLAN_SCHEMA_VERSION);

export const LifeStateIdSchema = z.enum([
  'arrival_unregistered',
  'arrival_stabilizing',
  'economic_setup_pending',
  'housing_instability',
  'insurance_gap',
  'benefits_exploration',
  'situation_stable',
]);

export type LifeStateId = z.infer<typeof LifeStateIdSchema>;

export const PlanningSeveritySchema = z.enum(['critical', 'high', 'medium', 'low']);

export type PlanningSeverity = z.infer<typeof PlanningSeveritySchema>;

export const SecondaryConditionIdSchema = z.enum([
  'registration_incomplete',
  'insurance_gap',
  'housing_data_missing',
  'housing_search_active',
  'employment_data_missing',
  'income_data_missing',
  'benefits_data_missing',
  'household_data_missing',
  'banking_not_established',
  're_registration_required',
  'life_transition_pending',
  'low_planning_confidence',
  'economic_setup_pending',
]);

export type SecondaryConditionId = z.infer<typeof SecondaryConditionIdSchema>;

export const LifeEventNodeCategorySchema = z.enum([
  'legal',
  'survival',
  'stabilization',
  'optimization',
  'life_transition',
]);

export type LifeEventNodeCategory = z.infer<typeof LifeEventNodeCategorySchema>;

export const LifeEventNodePrioritySchema = z.enum(['critical', 'high', 'medium', 'low']);

export type LifeEventNodePriority = z.infer<typeof LifeEventNodePrioritySchema>;

export const LifeActionKindSchema = z.enum(['open_module', 'correct_in_profile', 'explore_scenario']);

export type LifeActionKind = z.infer<typeof LifeActionKindSchema>;

export const LifeActionRefSchema = z.object({
  kind: LifeActionKindSchema,
  moduleId: z.string().optional(),
  profileMirrorSlug: z.string().optional(),
  scenarioEvent: z.string().optional(),
  href: z.string(),
  label: z.string(),
});

export type LifeActionRef = z.infer<typeof LifeActionRefSchema>;

export const LifeEventPlanNodeSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: LifeEventNodeCategorySchema,
  description: z.string(),
  priority: LifeEventNodePrioritySchema,
  phase: z.number().int().positive(),
  actions: z.array(LifeActionRefSchema),
  satisfied: z.boolean(),
  blocked: z.boolean(),
});

export type LifeEventPlanNode = z.infer<typeof LifeEventPlanNodeSchema>;

export const LifeEventReasoningSchema = z.object({
  whyThisNow: z.array(z.string()),
  whatIsBlocking: z.array(z.string()),
  planConfidence: ConfidenceLevelSchema,
});

export type LifeEventReasoning = z.infer<typeof LifeEventReasoningSchema>;

export const LifeEventPlanV1Schema = z.object({
  schemaVersion: LifeEventPlanSchemaVersionSchema,
  generatedAt: z.string().datetime(),
  moduleId: z.literal('life-event'),
  moduleVersion: z.string(),
  currentLifeState: LifeStateIdSchema,
  secondaryConditions: z.array(SecondaryConditionIdSchema),
  planningSeverity: PlanningSeveritySchema,
  currentFocus: LifeEventPlanNodeSchema,
  nextBestActions: z.array(LifeEventPlanNodeSchema),
  activeBlocks: z.array(LifeEventPlanNodeSchema),
  timeline: z.array(LifeEventPlanNodeSchema),
  reasoning: LifeEventReasoningSchema,
});

export type LifeEventPlanV1 = z.infer<typeof LifeEventPlanV1Schema>;

export function parseLifeEventPlanV1(input: unknown): LifeEventPlanV1 {
  return LifeEventPlanV1Schema.parse(input);
}

export function safeParseLifeEventPlanV1(input: unknown) {
  return LifeEventPlanV1Schema.safeParse(input);
}

export const PLANNING_SEVERITY_BY_STATE: Record<LifeStateId, PlanningSeverity> = {
  arrival_unregistered: 'critical',
  insurance_gap: 'critical',
  housing_instability: 'high',
  economic_setup_pending: 'high',
  arrival_stabilizing: 'high',
  benefits_exploration: 'medium',
  situation_stable: 'low',
};
