import { describe, expect, it } from 'vitest';
import { normalizeHealthcareNavigationRecommendations } from './healthcare-navigation.js';
import { normalizeRecommendations } from './normalizeRecommendations.js';

describe('PD-003 healthcare recommendation normalizer', () => {
  it('F — maps steps into recommendations for RECOMMENDATIONS outcome', () => {
    const recommendations = normalizeHealthcareNavigationRecommendations({
      outcome: 'RECOMMENDATIONS',
      insuranceAssumption: 'insured',
      scenario: 'Finding a doctor',
      steps: [
        {
          order: 1,
          title: 'Search for Hausarzt',
          description: 'Find doctors accepting patients.',
        },
      ],
      decisions: [],
      warnings: [],
      missing: [],
    });

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]?.title).toBe('Search for Hausarzt');
  });

  it('B — MORE_INFO_REQUIRED does not fabricate recommendations', () => {
    const recommendations = normalizeRecommendations({
      moduleId: 'healthcare-navigation',
      payload: {
        outcome: 'MORE_INFO_REQUIRED',
        insuranceAssumption: 'unknown',
        scenario: 'Additional insurance context required',
        steps: [],
        decisions: [],
        warnings: [],
        missing: [{ field: 'insurance', reasonKey: 'healthcare.missing.insurance' }],
      },
    });

    expect(recommendations).toEqual([]);
  });

  it('D — NO_APPLICABLE_RESULT yields empty recommendations intentionally', () => {
    const recommendations = normalizeHealthcareNavigationRecommendations({
      outcome: 'NO_APPLICABLE_RESULT',
      insuranceAssumption: 'insured',
      scenario: 'Evaluated with no guidance',
      steps: [],
      decisions: [],
      warnings: [],
      missing: [],
    });

    expect(recommendations).toEqual([]);
  });
});
