import { describe, expect, it } from 'vitest';
import { clusterBenefits, findHiddenBenefitClusters } from './cluster-engine.js';
import { GERMANY_SEED_BENEFITS } from '../ingestion/seeds/germany-seed-benefits.js';
import { MbdeUserProfileSchema } from '../types/user-profile.js';
import { computeAllBenefits } from './opportunity-engine.js';

describe('cluster-engine', () => {
  const profile = MbdeUserProfileSchema.parse({
    location: { country: 'DE' },
    health: {
      insuranceType: 'public',
      disabilityDegree: 60,
      mobilityLimitations: 'limited walking',
      chronicConditions: ['arthritis'],
    },
    housing: { type: 'rented', monthlyRent: 900 },
    financial: { netMonthlyIncome: 1100, benefitsAlreadyReceiving: [] },
    employment: { status: 'employed' },
  });

  it('clusters stackable health mobility benefits', () => {
    const opportunities = computeAllBenefits(profile, GERMANY_SEED_BENEFITS);
    const clusters = clusterBenefits(opportunities);
    const healthCluster = clusters.find((cluster) => cluster.theme.includes('health'));

    expect(healthCluster).toBeDefined();
    expect(healthCluster!.benefits.length).toBeGreaterThanOrEqual(2);
  });

  it('finds hidden clusters with retroactive or probabilistic items', () => {
    const opportunities = computeAllBenefits(profile, GERMANY_SEED_BENEFITS);
    const hidden = findHiddenBenefitClusters(opportunities);
    expect(hidden.length).toBeGreaterThan(0);
  });
});
