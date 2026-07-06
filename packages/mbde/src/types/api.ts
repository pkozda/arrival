import type { BenefitCluster } from './cluster.js';
import type { ImpactSummary, ScoredBenefit } from './scoring.js';
import type { MbdeUserProfile } from './user-profile.js';

export type BenefitsMaxResponse = {
  schemaVersion: '1.0.0';
  computedAt: string;
  profileCompleteness: number;
  opportunities: ScoredBenefit[];
  impactSummary: ImpactSummary;
};

export type BenefitsClustersResponse = {
  schemaVersion: '1.0.0';
  clusters: BenefitCluster[];
};

export type BenefitsRecomputeRequest = {
  profile?: MbdeUserProfile;
  includeProbabilistic?: boolean;
  minConfidence?: number;
};

export type BenefitsRecomputeResponse = BenefitsMaxResponse;

export type BenefitsImpactSummaryResponse = {
  schemaVersion: '1.0.0';
  impactSummary: ImpactSummary;
};
