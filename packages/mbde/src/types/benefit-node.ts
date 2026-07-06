import { z } from 'zod';
import { RuleExpressionSchema } from './rules.js';

export const BenefitCategorySchema = z.enum([
  'federal',
  'state',
  'municipal',
  'insurance',
  'tax',
  'education',
  'health',
  'transport',
  'ngo',
  'retail',
  'financial',
]);

export type BenefitCategory = z.infer<typeof BenefitCategorySchema>;

export const BenefitTypeSchema = z.enum([
  'cash',
  'discount',
  'refund',
  'subsidy',
  'taxReduction',
  'freeService',
  'lowInterestProgram',
]);

export type BenefitType = z.infer<typeof BenefitTypeSchema>;

export const BenefitNodeStatusSchema = z.enum(['active', 'deprecated', 'replaced']);

export type BenefitNodeStatus = z.infer<typeof BenefitNodeStatusSchema>;

export const BenefitGeographySchema = z.object({
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
});

export const BenefitValueEstimateSchema = z.object({
  min: z.number(),
  max: z.number(),
  currency: z.literal('EUR').default('EUR'),
  period: z.enum(['once', 'monthly', 'yearly']).default('yearly'),
});

export const BenefitSourceSchema = z.object({
  authority: z.string(),
  url: z.string().url(),
  lastUpdated: z.string().datetime().optional(),
  ingestionLayer: z.enum(['official', 'scraped', 'curated', 'llm-normalized']).optional(),
});

export const BenefitScoringHintsSchema = z.object({
  accessibilityWeight: z.number().min(0).max(1).default(0.5),
  effortCostPenalty: z.number().min(0).max(1).default(0.3),
  timeToReceiveWeeks: z.number().min(0).default(8),
  retroactivePossible: z.boolean().default(false),
  stackableWith: z.array(z.string()).default([]),
});

export const BenefitNodeSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  category: BenefitCategorySchema,
  geography: BenefitGeographySchema,
  eligibilityRules: RuleExpressionSchema,
  benefitType: BenefitTypeSchema,
  valueEstimate: BenefitValueEstimateSchema,
  source: BenefitSourceSchema,
  tags: z.array(z.string()).default([]),
  clusterTheme: z.string().optional(),
  version: z.number().int().min(1).default(1),
  status: BenefitNodeStatusSchema.default('active'),
  replacedById: z.string().optional(),
  scoringHints: BenefitScoringHintsSchema.optional(),
  eligibilityConfidenceBaseline: z.number().min(0).max(1).default(0.85),
});

export type BenefitNode = z.infer<typeof BenefitNodeSchema>;

export const BenefitNodeVersionSchema = z.object({
  nodeId: z.string(),
  version: z.number().int().min(1),
  status: BenefitNodeStatusSchema,
  snapshot: BenefitNodeSchema,
  contentHash: z.string(),
  recordedAt: z.string().datetime(),
});

export type BenefitNodeVersion = z.infer<typeof BenefitNodeVersionSchema>;

export function matchesGeography(
  benefit: BenefitNode,
  location: { country?: string; state?: string; city?: string; district?: string }
): boolean {
  const geo = benefit.geography;
  if (geo.country && location.country && geo.country !== location.country) {
    return false;
  }
  if (geo.state && location.state && geo.state !== location.state) {
    return false;
  }
  if (geo.city && location.city && geo.city.toLowerCase() !== location.city.toLowerCase()) {
    return false;
  }
  if (geo.district && location.district && geo.district !== location.district) {
    return false;
  }
  return true;
}

export function annualizeValueEstimate(estimate: BenefitNode['valueEstimate']): number {
  switch (estimate.period) {
    case 'monthly':
      return ((estimate.min + estimate.max) / 2) * 12;
    case 'once':
      return (estimate.min + estimate.max) / 2;
    case 'yearly':
    default:
      return (estimate.min + estimate.max) / 2;
  }
}
