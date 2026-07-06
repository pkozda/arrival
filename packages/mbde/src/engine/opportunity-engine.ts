import type { BenefitNode } from '../types/benefit-node.js';
import { annualizeValueEstimate, matchesGeography } from '../types/benefit-node.js';
import type { ScoredBenefit } from '../types/scoring.js';
import type { MbdeUserProfile } from '../types/user-profile.js';
import { flattenMbdeProfile } from '../types/user-profile.js';
import { evaluateEligibility } from './eligibility-engine.js';
import { scoreBenefit } from './scoring-engine.js';

export type OpportunityEngineOptions = {
  includeProbabilistic?: boolean;
  minConfidence?: number;
  minAnnualValueEur?: number;
};

export function enrichWithImpact(benefit: BenefitNode, profile: MbdeUserProfile, evaluation: ReturnType<typeof evaluateEligibility>): ScoredBenefit {
  return scoreBenefit(benefit, profile, evaluation);
}

export function computeAllBenefits(
  userProfile: MbdeUserProfile,
  benefitGraph: BenefitNode[],
  options: OpportunityEngineOptions = {}
): ScoredBenefit[] {
  const {
    includeProbabilistic = true,
    minConfidence = 0.35,
    minAnnualValueEur = 0,
  } = options;

  const flatProfile = flattenMbdeProfile(userProfile);
  const activeBenefits = benefitGraph.filter((node) => node.status === 'active');

  const scored = activeBenefits
    .filter((benefit) => matchesGeography(benefit, userProfile.location))
    .filter(
      (benefit) =>
        !userProfile.financial.benefitsAlreadyReceiving.includes(benefit.id)
    )
    .map((benefit) => {
      const evaluation = evaluateEligibility(benefit.eligibilityRules, flatProfile);
      return enrichWithImpact(benefit, userProfile, evaluation);
    })
    .filter((item) => {
      if (item.eligibilityConfidence < minConfidence) {
        return false;
      }
      if (!includeProbabilistic && item.matchedProbabilistically) {
        return false;
      }
      if (!item.matchedProbabilistically && item.eligibilityConfidence < 0.55) {
        return false;
      }
      return item.annualValueEur >= minAnnualValueEur;
    })
    .sort((a, b) => b.totalScore - a.totalScore);

  return scored;
}

export function buildImpactSummary(opportunities: ScoredBenefit[]): import('../types/scoring.js').ImpactSummary {
  const byCategory: Record<string, { count: number; expectedValue: number }> = {};

  let minTotal = 0;
  let maxTotal = 0;
  let expectedTotal = 0;

  for (const item of opportunities) {
    const benefit = item.benefit;
    const annualMid = item.annualValueEur;
    const annualMin = annualizeValueEstimate({ ...benefit.valueEstimate, max: benefit.valueEstimate.min });
    const annualMax = annualizeValueEstimate({ ...benefit.valueEstimate, min: benefit.valueEstimate.max });

    minTotal += annualMin * item.eligibilityConfidence;
    maxTotal += annualMax * item.eligibilityConfidence;
    expectedTotal += annualMid * item.eligibilityConfidence;

    const bucket = byCategory[benefit.category] ?? { count: 0, expectedValue: 0 };
    bucket.count += 1;
    bucket.expectedValue += annualMid * item.eligibilityConfidence;
    byCategory[benefit.category] = bucket;
  }

  return {
    totalOpportunities: opportunities.length,
    highConfidenceCount: opportunities.filter((o) => o.eligibilityConfidence >= 0.75).length,
    probabilisticCount: opportunities.filter((o) => o.matchedProbabilistically).length,
    estimatedAnnualValueMin: Math.round(minTotal),
    estimatedAnnualValueMax: Math.round(maxTotal),
    estimatedAnnualValueExpected: Math.round(expectedTotal),
    currency: 'EUR',
    byCategory,
  };
}
