import { describe, expect, it } from 'vitest';
import type { MutationEvent, UserContextV1 } from '@arrival-atlas/product-contract';
import { interpretProfileInsights } from '../src/interpret-profile-insights.js';

const baseContext: UserContextV1 = {
  profile: {
    schemaVersion: '1.0.0',
    preferences: { preferredLanguage: 'en' },
    completeness: { score: 40, missingDomains: ['housing', 'healthInsurance'] },
    domains: {
      income: { grossMonthlyIncome: 2800 },
      employment: { employmentStatus: 'employed' },
    },
  },
};

function moduleEvent(moduleId: string, sequence: number): MutationEvent {
  return {
    eventId: `evt_${sequence}`,
    mutationId: `mut_${sequence}`,
    profileId: 'prof_test',
    sequence,
    revision: sequence,
    timestamp: '2026-06-01T10:00:00.000Z',
    committedAt: '2026-06-01T10:00:00.000Z',
    type: 'fact.update',
    intent: 'capture',
    domain: 'income',
    payload: {
      kind: 'domain_facts',
      domain: 'income',
      fields: { grossMonthlyIncome: 2800 },
    },
    fieldDeltas: [
      {
        fieldId: 'grossMonthlyIncome',
        before: null,
        after: 2800,
        operation: 'set',
      },
    ],
    source: { kind: 'module', moduleId },
    confidence: 1,
    reason: `Updated when you used ${moduleId}`,
  };
}

describe('interpretProfileInsights', () => {
  it('produces deterministic output for fixed fixtures', () => {
    const input = {
      userContext: baseContext,
      mutationEvents: [moduleEvent('financial-reality', 1)],
      executionMeta: {
        executionsByModuleId: {
          'financial-reality': [
            {
              moduleId: 'financial-reality',
              createdAt: '2026-06-01T10:00:00.000Z',
              moduleTitle: 'Financial Reality',
            },
          ],
        },
      },
      generatedAt: '2026-06-15T12:00:00.000Z',
    };

    const first = interpretProfileInsights(input);
    const second = interpretProfileInsights(input);

    expect(first).toEqual(second);
    expect(first.schemaVersion).toBe('1.0.0');
    expect(first.domainInsights.length).toBe(7);
  });

  it('limits missing context to 3 items', () => {
    const insights = interpretProfileInsights({
      userContext: {
        profile: {
          schemaVersion: '1.0.0',
          preferences: { preferredLanguage: 'en' },
          completeness: {
            score: 10,
            missingDomains: ['housing', 'healthInsurance', 'benefits', 'migration', 'household'],
          },
          domains: {},
        },
      },
      generatedAt: '2026-06-15T12:00:00.000Z',
    });

    expect(insights.missingContext.length).toBeLessThanOrEqual(3);
  });

  it('does not leak schema keys in provenance narratives', () => {
    const insights = interpretProfileInsights({
      userContext: baseContext,
      mutationEvents: [moduleEvent('financial-reality', 1)],
      executionMeta: {
        executionsByModuleId: {
          'financial-reality': [
            {
              moduleId: 'financial-reality',
              createdAt: '2026-06-01T10:00:00.000Z',
              moduleTitle: 'Financial Reality',
            },
          ],
        },
      },
      generatedAt: '2026-06-15T12:00:00.000Z',
    });

    const narratives = insights.domainInsights
      .map((insight) => insight.provenanceNarrative)
      .filter(Boolean)
      .join(' ');

    expect(narratives).not.toMatch(/grossMonthlyIncome/);
    expect(narratives).not.toMatch(/fact\./);
    expect(narratives).not.toMatch(/eventId/);
  });

  it('assigns high confidence when module and profile correction both contributed', () => {
    const correction: MutationEvent = {
      ...moduleEvent('financial-reality', 1),
      sequence: 2,
      revision: 2,
      type: 'fact.correct',
      intent: 'correction',
      source: { kind: 'profile_ui', domain: 'income' },
      reason: 'You updated this in Your situation',
    };

    const insights = interpretProfileInsights({
      userContext: baseContext,
      mutationEvents: [moduleEvent('financial-reality', 1), correction],
      executionMeta: {
        executionsByModuleId: {
          'financial-reality': [
            {
              moduleId: 'financial-reality',
              createdAt: '2026-06-01T10:00:00.000Z',
              moduleTitle: 'Financial Reality',
            },
          ],
        },
      },
      generatedAt: '2026-06-15T12:00:00.000Z',
    });

    const workIncome = insights.domainInsights.find((entry) => entry.mirrorSlug === 'work-income');
    expect(workIncome?.confidence.level).toBe('high');
  });
});
