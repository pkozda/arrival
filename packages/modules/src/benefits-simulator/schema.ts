import { z } from 'zod';

export const TaxClassSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);

export const EmploymentSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }),
  z.object({
    type: z.literal('regular'),
    grossMonthly: z.number().nonnegative(),
    taxClass: TaxClassSchema,
    churchTax: z.boolean().optional(),
    hoursPerWeek: z.number().positive().max(80).optional(),
  }),
  z.object({
    type: z.literal('minijob'),
    grossMonthly: z.number().nonnegative(),
    rvOptIn: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('midijob'),
    grossMonthly: z.number().nonnegative(),
    taxClass: TaxClassSchema,
    churchTax: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('self-employed'),
    netMonthlyEstimate: z.number().nonnegative(),
  }),
]);

export const SimulatorEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('unemployment'), memberId: z.string().optional() }),
  z.object({
    type: z.literal('employment'),
    memberId: z.string().optional(),
    grossMonthly: z.number().nonnegative(),
    taxClass: TaxClassSchema,
    churchTax: z.boolean().optional(),
    hoursPerWeek: z.number().positive().max(80).optional(),
  }),
  z.object({
    type: z.literal('part-time-employment'),
    memberId: z.string().optional(),
    grossMonthly: z.number().nonnegative(),
    taxClass: TaxClassSchema,
    churchTax: z.boolean().optional(),
    hoursPerWeek: z.number().positive().max(30),
  }),
  z.object({
    type: z.literal('minijob'),
    memberId: z.string().optional(),
    grossMonthly: z.number().nonnegative().max(556),
    rvOptIn: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('midijob'),
    memberId: z.string().optional(),
    grossMonthly: z.number().nonnegative(),
    taxClass: TaxClassSchema,
    churchTax: z.boolean().optional(),
  }),
  z.object({ type: z.literal('child-added'), age: z.number().int().min(0).max(25) }),
  z.object({ type: z.literal('child-removed'), childIndex: z.number().int().min(0) }),
  z.object({
    type: z.literal('household-composition'),
    maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']),
    children: z.array(z.object({ age: z.number().int().min(0).max(25) })).max(10),
  }),
  z.object({
    type: z.literal('rent-change'),
    newColdRent: z.number().nonnegative(),
    newUtilities: z.number().nonnegative().optional(),
  }),
  z.object({
    type: z.literal('partner-employment-change'),
    employment: EmploymentSchema,
  }),
]);

export const PersonSchema = z.object({
  id: z.string(),
  role: z.enum(['applicant', 'partner', 'child']),
  age: z.number().int().min(0).max(120),
  taxClass: TaxClassSchema.optional(),
  churchTax: z.boolean().optional(),
});

export const SimulatorScenarioSchema = z.object({
  id: z.string().min(1).max(50),
  label: z.string().min(1).max(100),
  events: z.array(SimulatorEventSchema).min(1).max(3),
});

export const BenefitsSimulatorInputSchema = z.object({
  household: z.object({
    members: z.array(PersonSchema).min(1).max(12),
    housing: z.object({
      coldRent: z.number().nonnegative(),
      utilities: z.number().nonnegative().default(0),
      bundesland: z.string().length(2).default('BE'),
      cityMietstufe: z.number().int().min(1).max(7).optional(),
    }),
    currentBenefits: z
      .object({
        receivingBuergergeld: z.boolean().optional(),
        receivingAlg1: z.boolean().optional(),
        currentBuergergeldAmount: z.number().nonnegative().optional(),
      })
      .optional(),
  }),
  baselineEmployments: z.record(z.string(), EmploymentSchema),
  scenarios: z.array(SimulatorScenarioSchema).min(1).max(8),
  taxYear: z.number().int().default(2025),
});

const ScenarioSummarySchema = z.object({
  id: z.string(),
  label: z.string(),
  eventsApplied: z.array(z.string()),
  financialImpact: z.object({
    totalGross: z.number(),
    totalNet: z.number(),
    totalHouseholdResources: z.number(),
    deltaFromBaseline: z.number(),
  }),
  benefitChanges: z.object({
    buergergeld: z.object({
      before: z.number(),
      after: z.number(),
      delta: z.number(),
      eligible: z.boolean(),
      breakdown: z.object({
        regelbedarf: z.number(),
        kdu: z.number(),
        freibetragApplied: z.number(),
        kindergeld: z.number(),
      }),
    }),
    kindergeld: z.object({
      before: z.number(),
      after: z.number(),
      delta: z.number(),
    }),
  }),
  effectiveGainFromWork: z.number().nullable(),
  marginalRetentionRate: z.number().nullable(),
});

export const BenefitsSimulatorOutputSchema = z.object({
  meta: z.object({
    engineVersion: z.string(),
    taxYear: z.number(),
    ruleSetVersion: z.string(),
    confidence: z.enum(['high', 'medium', 'low']),
    disclaimer: z.string(),
    calculatedAt: z.string(),
    scenarioCount: z.number(),
    schemaVersion: z.string().default('1.0.0'),
  }),
  baseline: ScenarioSummarySchema,
  scenarios: z.array(ScenarioSummarySchema),
  comparison: z.object({
    bestScenarioId: z.string().nullable(),
    worstScenarioId: z.string().nullable(),
    maxHouseholdResources: z.number(),
    minHouseholdResources: z.number(),
    spread: z.number(),
  }),
  riskWarnings: z.array(
    z.object({
      id: z.string(),
      severity: z.enum(['critical', 'high', 'medium', 'low']),
      title: z.string(),
      description: z.string(),
      category: z.enum(['benefits', 'employment', 'housing', 'legal', 'financial']),
      action: z.string().optional(),
      institution: z.string().optional(),
    })
  ),
  recommendations: z.array(
    z.object({
      id: z.string(),
      scenarioId: z.string().optional(),
      title: z.string(),
      description: z.string(),
      priority: z.enum(['critical', 'high', 'medium', 'low']),
      rationale: z.string(),
    })
  ),
  summary: z.string(),
});

export type BenefitsSimulatorInput = z.infer<typeof BenefitsSimulatorInputSchema>;
export type BenefitsSimulatorOutput = z.infer<typeof BenefitsSimulatorOutputSchema>;

export const BENEFITS_SIMULATOR_SCHEMA_VERSION = '1.0.0';
