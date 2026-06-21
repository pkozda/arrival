import { describe, expect, it } from 'vitest';
import { EMPTY_ECONOMIC_FEEDBACK_SIGNALS } from '@arrival-atlas/product-contract';
import { ECONOMIC_FIXTURES } from '../fixtures.js';
import { evaluate } from './evaluate.js';
import { enrichSignalsWithFeedback } from './signal-enrichment.js';
import { computeEconomicSignals } from './axes.js';
import { mapEventsToFeedbackSignals } from '../../module-orchestration/feedback-mapper.js';

describe('signal enrichment EP-12', () => {
  it('enriches evaluation input without changing profile-backed base signals directly', () => {
    const fixture = ECONOMIC_FIXTURES.find((entry) => entry.id === 'EF03')!;
    const baseEvaluation = evaluate(fixture.userContext);
    expect(baseEvaluation.economicState).toBe('unemployment_transition');

    const feedback = mapEventsToFeedbackSignals([
      {
        schemaVersion: '1.0.0',
        type: 'ACTION_EXECUTED',
        actionId: 'profile-work-income',
        actionType: 'update_profile',
        profileKey: 'work-income',
        contextHash: 'hash',
        timestamp: 1,
      },
    ]);

    const enrichedEvaluation = evaluate(fixture.userContext, { feedbackSignals: feedback });
    expect(enrichedEvaluation.economicState).toBe('employment_active');
    expect(fixture.userContext.profile?.domains.employment?.employmentStatus).toBe('unemployed');
  });

  it('does not mutate signals when feedback is empty', () => {
    const fixture = ECONOMIC_FIXTURES[0]!;
    const baseSignals = computeEconomicSignals(fixture.userContext);
    const enriched = enrichSignalsWithFeedback(baseSignals, EMPTY_ECONOMIC_FEEDBACK_SIGNALS);
    expect(enriched).toEqual(baseSignals);
  });
});
