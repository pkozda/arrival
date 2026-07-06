import type { ScoredBenefit } from './scoring.js';

export type BenefitCluster = {
  theme: string;
  benefitIds: string[];
  benefits: ScoredBenefit[];
  combinedValueMin: number;
  combinedValueMax: number;
  combinedValueExpected: number;
  stackable: boolean;
  tags: string[];
};
