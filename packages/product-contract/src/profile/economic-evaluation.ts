import { z } from 'zod';

export const ECONOMIC_EVALUATION_SCHEMA_VERSION = '1.0.0';

export const EconomicEvaluationSchemaVersionSchema = z.literal(ECONOMIC_EVALUATION_SCHEMA_VERSION);

export const EconomicStateIdSchema = z.enum([
  'self_sustained',
  'employment_active',
  'unemployment_transition',
  'benefits_jobcenter',
  'benefits_sozialamt',
  'application_pending',
  'financial_crisis',
]);

export type EconomicStateId = z.infer<typeof EconomicStateIdSchema>;

export const EconomicSupportSystemIdSchema = z.enum([
  'jobcenter',
  'sozialamt',
  'none',
  'pending',
]);

export type EconomicSupportSystemId = z.infer<typeof EconomicSupportSystemIdSchema>;

export const IncomeAxisSchema = z.enum(['none', 'low', 'stable']);

export type IncomeAxis = z.infer<typeof IncomeAxisSchema>;

export const EmploymentAxisSchema = z.enum(['unemployed', 'transition', 'employed']);

export type EmploymentAxis = z.infer<typeof EmploymentAxisSchema>;

export const InstitutionAxisSchema = z.enum(['none', 'jobcenter', 'sozialamt']);

export type InstitutionAxis = z.infer<typeof InstitutionAxisSchema>;

export const EconomicAxesV1Schema = z.object({
  incomeAxis: IncomeAxisSchema,
  employmentAxis: EmploymentAxisSchema,
  institutionAxis: InstitutionAxisSchema,
});

export type EconomicAxesV1 = z.infer<typeof EconomicAxesV1Schema>;

export const PlanConfidenceSchema = z.enum(['high', 'medium', 'low', 'none']);

export type PlanConfidence = z.infer<typeof PlanConfidenceSchema>;

export const EconomicRuleIdSchema = z.enum(['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7']);

export type EconomicRuleId = z.infer<typeof EconomicRuleIdSchema>;

export const EconomicBlockerIdSchema = z.enum([
  'SC-REG',
  'SC-ADDR',
  'SC-INS',
  'SC-DOC',
  'SC-LANG',
  'SC-HH',
  'SC-STATUS',
  'SC-REPORT',
]);

export type EconomicBlockerId = z.infer<typeof EconomicBlockerIdSchema>;

export const AppliedRuleSchema = z.object({
  id: EconomicRuleIdSchema,
  matched: z.boolean(),
  weight: z.number(),
  output: z
    .object({
      economicState: EconomicStateIdSchema.optional(),
      supportSystem: EconomicSupportSystemIdSchema.optional(),
    })
    .optional(),
  debugReason: z.string(),
});

export type AppliedRule = z.infer<typeof AppliedRuleSchema>;

export const EconomicEvaluationV1Schema = z.object({
  schemaVersion: EconomicEvaluationSchemaVersionSchema,
  economicState: EconomicStateIdSchema,
  supportSystem: EconomicSupportSystemIdSchema,
  axes: EconomicAxesV1Schema,
  confidenceScore: z.number().min(0).max(1),
  planConfidence: PlanConfidenceSchema,
  blockers: z.array(EconomicBlockerIdSchema),
  appliedRules: z.array(AppliedRuleSchema),
});

export type EconomicEvaluationV1 = z.infer<typeof EconomicEvaluationV1Schema>;

export function parseEconomicEvaluationV1(input: unknown): EconomicEvaluationV1 {
  return EconomicEvaluationV1Schema.parse(input);
}

export function safeParseEconomicEvaluationV1(input: unknown) {
  return EconomicEvaluationV1Schema.safeParse(input);
}
