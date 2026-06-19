import { z } from 'zod';
import type { AppContext, Module, ModuleRegistration } from '@arrival-atlas/core';
import {
  calculateNetIncome,
  calculateBuergergeldEligibility,
  germanAdminRules,
  adaptLegacyInputToV2,
  adaptV2OutputToLegacy,
  financialPipeline,
  type LegacyFinancialInput,
} from '@arrival-atlas/shared-services';
import { resolveFinancialProfileContext } from './profile-context.js';

// ─── v1 schemas (unchanged contract) ─────────────────────────────────────────

export const FinancialRealityInputSchema = z.object({
  grossIncome: z.number().nonnegative(),
  taxClass: z.union([
    z.literal(1), z.literal(2), z.literal(3),
    z.literal(4), z.literal(5), z.literal(6),
  ]),
  churchTax: z.boolean().default(false),
  householdSize: z.number().int().positive().default(1),
  monthlyRent: z.number().nonnegative().default(0),
  employmentStatus: z.enum([
    'employed', 'self-employed', 'unemployed', 'part-time', 'student',
  ]).default('employed'),
  maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']).default('single'),
  proposedGrossIncome: z.number().nonnegative().optional(),
});

const LegacyDecisionSchema = z.object({
  title: z.string(),
  description: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
  action: z.string().optional(),
});

export const FinancialRealityOutputSchema = z.object({
  income: z.object({
    gross: z.number(),
    net: z.number(),
    deductions: z.object({
      incomeTax: z.number(),
      solidaritySurcharge: z.number(),
      churchTax: z.number(),
      socialContributions: z.number(),
    }),
    effectiveTaxRate: z.number(),
  }),
  benefits: z.object({
    buergergeld: z.object({
      eligible: z.boolean(),
      estimatedBenefit: z.number(),
      reasoning: z.array(z.string()),
    }),
  }),
  decisions: z.array(LegacyDecisionSchema),
  adminRules: z.array(z.string()),
  meta: z.object({
    engineVersion: z.string(),
    taxYear: z.number(),
    ruleSetVersion: z.string(),
    mode: z.string(),
    confidence: z.enum(['high', 'medium', 'low']),
    disclaimer: z.string(),
    calculatedAt: z.string(),
  }).optional(),
  verdict: z.object({
    isJobFinanciallyBeneficial: z.boolean().nullable(),
    summary: z.string(),
    householdDeltaMonthly: z.number().nullable(),
    effectiveGainFromWork: z.number().nullable(),
    marginalRetentionRate: z.number().nullable(),
  }).optional(),
  comparison: z.any().optional(),
  scenarios: z.any().optional(),
  expectedChanges: z.array(z.object({
    trigger: z.string(),
    obligations: z.array(z.string()),
    timeline: z.string().optional(),
  })).optional(),
});

export type FinancialRealityInput = z.infer<typeof FinancialRealityInputSchema>;
export type FinancialRealityOutput = z.infer<typeof FinancialRealityOutputSchema>;

// ─── v1 engine (legacy, used when advancedTaxScenarios flag is off) ─────────

async function executeV1(
  input: FinancialRealityInput,
  context: AppContext
): Promise<FinancialRealityOutput> {
  const taxResult = calculateNetIncome({
    grossIncome: input.grossIncome,
    taxClass: input.taxClass,
    churchTax: input.churchTax,
  });

  const buergergeld = calculateBuergergeldEligibility(
    taxResult.netIncome,
    input.householdSize,
    input.monthlyRent
  );

  const { hasHealthInsurance, daysInGermany } = resolveFinancialProfileContext(
    context,
    input as Record<string, unknown>
  );

  const ruleData = {
    netIncome: taxResult.netIncome,
    employmentStatus: input.employmentStatus,
    maritalStatus: input.maritalStatus,
    taxClass: input.taxClass,
    hasHealthInsurance,
    daysInGermany,
  };

  const rules = germanAdminRules.evaluate(ruleData);
  const decisions: FinancialRealityOutput['decisions'] = [];

  if (taxResult.effectiveTaxRate > 35) {
    decisions.push({
      title: 'High tax burden detected',
      description: `Your effective tax rate is ${taxResult.effectiveTaxRate}%. Consider reviewing Steuerklasse options.`,
      priority: 'medium',
      action: 'Consult Finanzamt about Steuerklassenwechsel',
    });
  }

  if (buergergeld.eligible) {
    decisions.push({
      title: 'Potential Bürgergeld eligibility',
      description: `Estimated gap of €${buergergeld.estimatedBenefit}/month between income and need.`,
      priority: 'high',
      action: 'Contact local Jobcenter for Beratungsgespräch',
    });
  }

  if (input.grossIncome > 0 && input.grossIncome < 1500 && input.employmentStatus === 'employed') {
    decisions.push({
      title: 'Low income — check Werkstudent/Mini-job rules',
      description: 'Your income may qualify for reduced social contributions or additional support.',
      priority: 'medium',
      action: 'Review Minijob-Grenze (€556/month) and Midijob rules',
    });
  }

  if (taxResult.netIncome > 0 && taxResult.netIncome < input.monthlyRent) {
    decisions.push({
      title: 'Rent exceeds net income',
      description: 'Housing costs consume more than your net income — explore Wohngeld or social housing.',
      priority: 'high',
      action: 'Apply for Wohngeld at local Wohngeldstelle',
    });
  }

  return {
    income: {
      gross: input.grossIncome,
      net: taxResult.netIncome,
      deductions: {
        incomeTax: taxResult.incomeTax,
        solidaritySurcharge: taxResult.solidaritySurcharge,
        churchTax: taxResult.churchTax,
        socialContributions: taxResult.socialContributions.total,
      },
      effectiveTaxRate: taxResult.effectiveTaxRate,
    },
    benefits: { buergergeld },
    decisions,
    adminRules: [...rules.conclusions, ...rules.recommendations],
  };
}

// ─── v2 engine (Phase M1) ───────────────────────────────────────────────────

async function executeV2(
  input: FinancialRealityInput,
  context: AppContext
): Promise<FinancialRealityOutput> {
  const legacyInput: LegacyFinancialInput = {
    grossIncome: input.grossIncome,
    taxClass: input.taxClass,
    churchTax: input.churchTax,
    householdSize: input.householdSize,
    monthlyRent: input.monthlyRent,
    employmentStatus: input.employmentStatus,
    maritalStatus: input.maritalStatus,
    proposedGrossIncome: input.proposedGrossIncome,
  };

  const { hasHealthInsurance, daysInGermany } = resolveFinancialProfileContext(
    context,
    input as Record<string, unknown>
  );

  const ruleData = {
    netIncome: input.grossIncome,
    employmentStatus: input.employmentStatus,
    maritalStatus: input.maritalStatus,
    taxClass: input.taxClass,
    hasHealthInsurance,
    daysInGermany,
  };
  const rules = germanAdminRules.evaluate(ruleData);

  const engineInput = adaptLegacyInputToV2(legacyInput);
  const v2Result = financialPipeline.run(engineInput);
  return adaptV2OutputToLegacy(v2Result, [...rules.conclusions, ...rules.recommendations]);
}

// ─── Module registration ─────────────────────────────────────────────────────

let useV2Engine = true;

export const financialRealityModule: Module<FinancialRealityInput, FinancialRealityOutput> = {
  id: 'financial-reality',
  name: 'Financial Reality Module',
  version: '2.0.0',
  description: 'Household financial decision engine — Brutto/Netto, Bürgergeld, scenario comparison',
  inputSchema: FinancialRealityInputSchema,
  outputSchema: FinancialRealityOutputSchema,

  async execute(input, context): Promise<FinancialRealityOutput> {
    if (useV2Engine) {
      return executeV2(input, context);
    }
    return executeV1(input, context);
  },
};

export const financialRealityRegistration: ModuleRegistration = {
  ...financialRealityModule,
  enabled: true,
  featureFlags: { advancedTaxScenarios: true },
  module: financialRealityModule,
};

/** Called by registry or tests to toggle engine version */
export function setAdvancedTaxScenarios(enabled: boolean): void {
  useV2Engine = enabled;
  financialRealityRegistration.featureFlags.advancedTaxScenarios = enabled;
}

export function isAdvancedTaxScenariosEnabled(): boolean {
  return useV2Engine;
}
