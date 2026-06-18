import { describe, expect, it } from 'vitest';
import { normalizeFinancialRealityRecommendations } from './normalizers/financial-reality.js';
import { normalizeBenefitsSimulatorRecommendations } from './normalizers/benefits-simulator.js';
import { normalizeRecommendations } from './normalizers/normalizeRecommendations.js';

describe('normalizeFinancialRealityRecommendations', () => {
  it('maps decisions[] into canonical Recommendation objects', () => {
    const recommendations = normalizeFinancialRealityRecommendations({
      meta: { confidence: 'high' },
      decisions: [
        {
          title: 'Rent exceeds net income',
          description: 'Housing costs consume more than net income.',
          priority: 'high',
          action: 'Apply for Wohngeld',
        },
      ],
      benefits: {
        buergergeld: {
          eligible: false,
          estimatedBenefit: 0,
          reasoning: [],
        },
      },
      adminRules: ['wohngeld_eligible'],
    });

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]).toMatchObject({
      id: 'financial-decision-0',
      title: 'Rent exceeds net income',
      priority: 'high',
      explanation: {
        summary: 'Housing costs consume more than net income.',
        confidence: 'high',
      },
    });
    expect(recommendations[0]?.explanation.factors.length).toBeGreaterThan(0);
  });

  it('adds a Bürgergeld recommendation from reasoning[] when eligible', () => {
    const recommendations = normalizeFinancialRealityRecommendations({
      meta: { confidence: 'medium' },
      decisions: [],
      benefits: {
        buergergeld: {
          eligible: true,
          estimatedBenefit: 250,
          reasoning: ['Net income below household need.', 'KdU threshold exceeded.'],
        },
      },
      adminRules: [],
    });

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]?.id).toBe('financial-buergergeld-eligible');
    expect(recommendations[0]?.explanation.factors).toHaveLength(2);
  });
});

describe('normalizeBenefitsSimulatorRecommendations', () => {
  it('maps legacy recommendations and riskWarnings into canonical recommendations', () => {
    const recommendations = normalizeBenefitsSimulatorRecommendations({
      meta: { confidence: 'medium' },
      recommendations: [
        {
          id: 'rec-1',
          title: 'Consider part-time transition',
          description: 'A gradual transition may preserve benefits longer.',
          priority: 'medium',
          rationale: 'Marginal retention remains below 60%.',
          scenarioId: 'part-time',
        },
      ],
      riskWarnings: [
        {
          id: 'warn-legal',
          severity: 'critical',
          title: 'Legal review required',
          description: 'Employment change may affect residence permit conditions.',
          category: 'legal',
          institution: 'Ausländerbehörde',
        },
      ],
      summary: 'Scenario comparison complete.',
    });

    expect(recommendations).toHaveLength(2);
    expect(recommendations[0]?.scopeRef).toBe('part-time');
    expect(recommendations[1]?.priority).toBe('critical');
    expect(recommendations[1]?.explanation.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'category', value: 'legal' }),
        expect.objectContaining({ id: 'institution', value: 'Ausländerbehörde' }),
      ])
    );
  });
});

describe('normalizeRecommendations', () => {
  it('returns an empty list for unknown modules', () => {
    expect(
      normalizeRecommendations({
        moduleId: 'unknown-module',
        payload: { decisions: [{ title: 'x' }] },
      })
    ).toEqual([]);
  });
});
