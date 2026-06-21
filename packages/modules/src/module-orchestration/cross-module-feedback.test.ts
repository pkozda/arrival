import { describe, expect, it } from 'vitest';
import { deriveLifeEventFeedbackHints } from './cross-module-feedback.js';
import { evaluate } from '../economic-reality/rule-engine/evaluate.js';
import { ECONOMIC_FIXTURES } from '../economic-reality/fixtures.js';
import { mapEventsToFeedbackSignals } from './feedback-mapper.js';
import { ECONOMIC_REALITY_EVENT_SCHEMA_VERSION } from '@arrival-atlas/product-contract';

describe('cross-module-feedback EP-12', () => {
  it('derives advisory LE hints from ER evaluation and feedback signals', () => {
    const fixture = ECONOMIC_FIXTURES.find((entry) => entry.id === 'EF07')!;
    const evaluation = evaluate(fixture.userContext);
    const feedbackSignals = mapEventsToFeedbackSignals([
      {
        schemaVersion: ECONOMIC_REALITY_EVENT_SCHEMA_VERSION,
        type: 'INTENT_TRIGGERED',
        actionType: 'system_intent',
        systemIntent: 'start_jobcenter_process',
        contextHash: 'hash',
        timestamp: 1,
      },
    ]);

    const hints = deriveLifeEventFeedbackHints({ evaluation, feedbackSignals });
    expect(hints.every((hint) => hint.advisoryOnly)).toBe(true);
    expect(hints.some((hint) => hint.hintType === 'economic_urgency')).toBe(true);
    expect(hints.some((hint) => hint.hintType === 'economic_setup_progress')).toBe(true);
  });

  it('does not import LE planner state as classification input', () => {
    const source = deriveLifeEventFeedbackHints.toString();
    expect(source).not.toContain('buildLifeEventPlan');
    expect(source).not.toContain('LifeEventPlanV1');
  });
});
