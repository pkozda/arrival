import { describe, expect, it } from 'vitest';
import { mapEventsToFeedbackSignals } from '../../module-orchestration/feedback-mapper.js';
import { buildEconomicRealityPlan } from '../../api/economic-reality/pipeline.js';
import { ECONOMIC_FIXTURES } from '../fixtures.js';
import {
  enrichSatisfactionSnapshotWithFeedback,
  evaluateEconomicSatisfactionKeys,
} from './satisfaction-keys.js';

describe('satisfaction feedback overlay', () => {
  it('marks sozialamt_case_open when sozialamt intent feedback is present', () => {
    const fixture = ECONOMIC_FIXTURES.find((entry) => entry.id === 'EF18')!;
    const base = evaluateEconomicSatisfactionKeys(fixture.userContext);
    expect(base.sozialamt_case_open).toBe(false);

    const feedback = mapEventsToFeedbackSignals([
      {
        schemaVersion: '1.0.0',
        type: 'INTENT_TRIGGERED',
        actionId: 'intent-sozialamt',
        actionType: 'system_intent',
        systemIntent: 'start_sozialamt_process',
        contextHash: 'hash',
        timestamp: 1,
      },
    ]);

    const enriched = enrichSatisfactionSnapshotWithFeedback(base, feedback);
    expect(enriched.sozialamt_case_open).toBe(true);
  });

  it('changes deterministic plan hash after sozialamt intent on EF18', () => {
    const fixture = ECONOMIC_FIXTURES.find((entry) => entry.id === 'EF18')!;
    const before = buildEconomicRealityPlan(fixture.userContext, {
      requestId: 'before',
      generatedAt: new Date().toISOString(),
    });

    expect(before.execution.nodes['g6-sozialamt-contact']?.status).toBe('active');

    const feedback = mapEventsToFeedbackSignals([
      {
        schemaVersion: '1.0.0',
        type: 'INTENT_TRIGGERED',
        actionId: 'g6-sozialamt-contact:intent-start-sozialamt',
        actionType: 'system_intent',
        systemIntent: 'start_sozialamt_process',
        contextHash: before.meta.deterministicHash,
        timestamp: 1,
      },
    ]);

    const after = buildEconomicRealityPlan(fixture.userContext, {
      requestId: 'after',
      generatedAt: new Date().toISOString(),
      feedbackSignals: feedback,
    });

    expect(after.meta.deterministicHash).not.toBe(before.meta.deterministicHash);
    expect(after.execution.nodes['g6-sozialamt-contact']?.status).toBe('completed');
  });
});
