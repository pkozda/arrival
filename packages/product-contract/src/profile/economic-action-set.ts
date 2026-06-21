import { z } from 'zod';
import { EconomicGraphIdSchema } from './graph-context.js';

export const ECONOMIC_ACTION_SET_SCHEMA_VERSION = '1.0.0';

export const EconomicActionSetSchemaVersionSchema = z.literal(ECONOMIC_ACTION_SET_SCHEMA_VERSION);

export const EconomicActionTypeSchema = z.enum([
  'open_module',
  'update_profile',
  'external_resource',
  'system_intent',
]);

export type EconomicActionType = z.infer<typeof EconomicActionTypeSchema>;

export const EconomicExternalSystemSchema = z.enum([
  'jobcenter',
  'sozialamt',
  'employment_agency',
]);

export type EconomicExternalSystem = z.infer<typeof EconomicExternalSystemSchema>;

export const EconomicSystemIntentSchema = z.enum([
  'start_jobcenter_process',
  'start_sozialamt_process',
  'report_income_change',
  'initiate_benefit_application',
]);

export type EconomicSystemIntent = z.infer<typeof EconomicSystemIntentSchema>;

export const EconomicActionPayloadSchema = z.object({
  href: z.string().optional(),
  moduleId: z.string().optional(),
  profileKey: z.string().optional(),
  externalSystem: EconomicExternalSystemSchema.optional(),
  systemIntent: EconomicSystemIntentSchema.optional(),
  intentKey: z.string().min(1).optional(),
  entrypoint: z.enum(['auto', 'CRISIS', 'OVERVIEW', 'PRIMARY']).optional(),
});

export type EconomicActionPayload = z.infer<typeof EconomicActionPayloadSchema>;

export const EconomicActionConstraintsSchema = z.object({
  blockedByExecutionState: z.boolean().optional(),
  requiresConfirmation: z.boolean().optional(),
});

export type EconomicActionConstraints = z.infer<typeof EconomicActionConstraintsSchema>;

export const EconomicActionOriginSchema = z.object({
  graphId: EconomicGraphIdSchema,
  nodeId: z.string().min(1),
});

export type EconomicActionOrigin = z.infer<typeof EconomicActionOriginSchema>;

export const EconomicActionV1Schema = z.object({
  id: z.string().min(1),
  sourceNodeId: z.string().min(1),
  labelKey: z.string().min(1),
  type: EconomicActionTypeSchema,
  payload: EconomicActionPayloadSchema,
  constraints: EconomicActionConstraintsSchema,
  origin: EconomicActionOriginSchema,
});

export type EconomicActionV1 = z.infer<typeof EconomicActionV1Schema>;

export const EconomicActionSetMetadataSchema = z.object({
  sourceExecutionId: z.string().min(1),
  derivedFromNodes: z.array(z.string()),
});

export type EconomicActionSetMetadata = z.infer<typeof EconomicActionSetMetadataSchema>;

export const EconomicActionSetV1Schema = z.object({
  schemaVersion: EconomicActionSetSchemaVersionSchema,
  graphId: EconomicGraphIdSchema,
  actions: z.array(EconomicActionV1Schema),
  metadata: EconomicActionSetMetadataSchema,
});

export type EconomicActionSetV1 = z.infer<typeof EconomicActionSetV1Schema>;

export function parseEconomicActionSetV1(input: unknown): EconomicActionSetV1 {
  return EconomicActionSetV1Schema.parse(input);
}

export function safeParseEconomicActionSetV1(input: unknown) {
  return EconomicActionSetV1Schema.safeParse(input);
}
