import { z } from 'zod';
import type { AppContext, Module, ModuleRegistration } from '@arrivalos/core';
import {
  calculateNetIncome,
  calculateBuergergeldEligibility,
  germanAdminRules,
} from '@arrivalos/shared-services';

export const FinancialRealityInputSchema = z.object({
  grossIncome: z.number().positive(),
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
  decisions: z.array(z.object({
    title: z.string(),
    description: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
    action: z.string().optional(),
  })),
  adminRules: z.array(z.string()),
});

export type FinancialRealityInput = z.infer<typeof FinancialRealityInputSchema>;
export type FinancialRealityOutput = z.infer<typeof FinancialRealityOutputSchema>;

export const financialRealityModule: Module<FinancialRealityInput, FinancialRealityOutput> = {
  id: 'financial-reality',
  name: 'Financial Reality Module',
  version: '1.0.0',
  description: 'Transforms gross income into net reality, benefit eligibility, and actionable financial decisions',
  inputSchema: FinancialRealityInputSchema,
  outputSchema: FinancialRealityOutputSchema,

  async execute(input, context: AppContext): Promise<FinancialRealityOutput> {
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

    const ruleData = {
      netIncome: taxResult.netIncome,
      employmentStatus: input.employmentStatus,
      maritalStatus: input.maritalStatus,
      taxClass: input.taxClass,
      hasHealthInsurance: context.systemState?.insurance?.hasCoverage ?? true,
      daysInGermany: context.systemState?.benefits?.daysInGermany ?? 0,
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

    if (input.grossIncome < 1500 && input.employmentStatus === 'employed') {
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
  },
};

export const financialRealityRegistration: ModuleRegistration = {
  ...financialRealityModule,
  enabled: true,
  featureFlags: { advancedTaxScenarios: false },
  module: financialRealityModule,
};
