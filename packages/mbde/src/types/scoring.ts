import type { BenefitNode } from './benefit-node.js';

export type ScoredBenefit = {
  benefit: BenefitNode;
  eligibilityConfidence: number;
  monetaryValueWeight: number;
  accessibilityWeight: number;
  effortCostPenalty: number;
  timeToReceiveFactor: number;
  totalScore: number;
  annualValueEur: number;
  matchedProbabilistically: boolean;
  missingFields: string[];
};

export type ImpactSummary = {
  totalOpportunities: number;
  highConfidenceCount: number;
  probabilisticCount: number;
  estimatedAnnualValueMin: number;
  estimatedAnnualValueMax: number;
  estimatedAnnualValueExpected: number;
  currency: 'EUR';
  byCategory: Record<string, { count: number; expectedValue: number }>;
};

export const DEFAULT_SCORING_WEIGHTS = {
  monetaryValue: 0.45,
  eligibilityConfidence: 0.35,
  accessibility: 0.15,
  effortPenalty: 0.25,
  timePenalty: 0.15,
} as const;
