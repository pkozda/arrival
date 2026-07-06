import type { UserProfileViewV1 } from '@arrival-atlas/product-contract';
import { clusterBenefits } from './engine/cluster-engine.js';
import { buildImpactSummary, computeAllBenefits } from './engine/opportunity-engine.js';
import type { BenefitGraphStorePort } from './ingestion/pipeline.js';
import { adaptUserProfileView, profileCompletenessScore } from './profile/adapt-user-profile.js';
import type {
  BenefitsClustersResponse,
  BenefitsMaxResponse,
  BenefitsRecomputeRequest,
} from './types/api.js';
import type { MbdeUserProfile } from './types/user-profile.js';

export type MbdeServiceOptions = {
  includeProbabilistic?: boolean;
  minConfidence?: number;
};

export class MbdeService {
  constructor(private readonly store: BenefitGraphStorePort) {}

  recompute(
    profileInput: UserProfileViewV1 | MbdeUserProfile | null | undefined,
    request: BenefitsRecomputeRequest = {}
  ): BenefitsMaxResponse {
    const profile =
      profileInput && 'domains' in profileInput
        ? request.profile ?? adaptUserProfileView(profileInput)
        : request.profile ?? adaptUserProfileView(null);

    const opportunities = computeAllBenefits(profile, this.store.listActive(), {
      includeProbabilistic: request.includeProbabilistic ?? true,
      minConfidence: request.minConfidence ?? 0.35,
    });

    return {
      schemaVersion: '1.0.0',
      computedAt: new Date().toISOString(),
      profileCompleteness: profileCompletenessScore(profile),
      opportunities,
      impactSummary: buildImpactSummary(opportunities),
    };
  }

  getClusters(profileInput: UserProfileViewV1 | MbdeUserProfile | null | undefined): BenefitsClustersResponse {
    const result = this.recompute(profileInput);
    return {
      schemaVersion: '1.0.0',
      clusters: clusterBenefits(result.opportunities),
    };
  }

  getImpactSummary(profileInput: UserProfileViewV1 | MbdeUserProfile | null | undefined) {
    const result = this.recompute(profileInput);
    return {
      schemaVersion: '1.0.0' as const,
      impactSummary: result.impactSummary,
    };
  }
}
