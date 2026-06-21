import { describe, expect, it } from 'vitest';
import {
  ECONOMIC_REALITY_EVENT_SCHEMA_VERSION,
  EMPTY_ECONOMIC_FEEDBACK_SIGNALS,
} from '@arrival-atlas/product-contract';
import { mapEventsToFeedbackSignals } from './feedback-mapper.js';

describe('mapEventsToFeedbackSignals EP-12', () => {
  it('returns empty signals for no events', () => {
    expect(mapEventsToFeedbackSignals([])).toEqual(EMPTY_ECONOMIC_FEEDBACK_SIGNALS);
  });

  it('F1 maps work-income profile updates to employmentSignalDelta', () => {
    const signals = mapEventsToFeedbackSignals([
      {
        schemaVersion: ECONOMIC_REALITY_EVENT_SCHEMA_VERSION,
        type: 'ACTION_EXECUTED',
        actionId: 'g2-first-payment:profile-work-income',
        actionType: 'update_profile',
        profileKey: 'work-income',
        contextHash: 'hash-1',
        timestamp: 1,
      },
    ]);

    expect(signals.employmentSignalDelta).toBe(1);
    expect(signals.institutionEngagementDelta).toBe(0);
    expect(signals.crisisStabilityDelta).toBe(0);
  });

  it('F3 maps institution start intents to institutionEngagementDelta', () => {
    const jobcenter = mapEventsToFeedbackSignals([
      {
        schemaVersion: ECONOMIC_REALITY_EVENT_SCHEMA_VERSION,
        type: 'INTENT_TRIGGERED',
        actionId: 'intent-jobcenter',
        actionType: 'system_intent',
        systemIntent: 'start_jobcenter_process',
        contextHash: 'hash-1',
        timestamp: 1,
      },
    ]);
    expect(jobcenter.institutionEngagementDelta).toBe(0.5);

    const sozialamt = mapEventsToFeedbackSignals([
      {
        schemaVersion: ECONOMIC_REALITY_EVENT_SCHEMA_VERSION,
        type: 'INTENT_TRIGGERED',
        actionId: 'intent-sozialamt',
        actionType: 'system_intent',
        systemIntent: 'start_sozialamt_process',
        contextHash: 'hash-1',
        timestamp: 1,
      },
    ]);
    expect(sozialamt.institutionEngagementDelta).toBe(0.5);
    expect(sozialamt.institutionEngagementTarget).toBe('sozialamt');
  });

  it('F2 maps repeated external resources and failed intents to crisisStabilityDelta', () => {
    const signals = mapEventsToFeedbackSignals([
      {
        schemaVersion: ECONOMIC_REALITY_EVENT_SCHEMA_VERSION,
        type: 'ACTION_EXECUTED',
        actionId: 'resource-1',
        actionType: 'external_resource',
        contextHash: 'hash-1',
        timestamp: 1,
      },
      {
        schemaVersion: ECONOMIC_REALITY_EVENT_SCHEMA_VERSION,
        type: 'ACTION_EXECUTED',
        actionId: 'resource-2',
        actionType: 'external_resource',
        contextHash: 'hash-1',
        timestamp: 2,
      },
      {
        schemaVersion: ECONOMIC_REALITY_EVENT_SCHEMA_VERSION,
        type: 'ACTION_FAILED',
        actionId: 'intent-failed',
        actionType: 'system_intent',
        contextHash: 'hash-1',
        timestamp: 3,
      },
    ]);

    expect(signals.crisisStabilityDelta).toBe(-0.75);
  });

  it('is deterministic for identical event streams', () => {
    const events = [
      {
        schemaVersion: ECONOMIC_REALITY_EVENT_SCHEMA_VERSION,
        type: 'ACTION_EXECUTED' as const,
        actionId: 'profile-work-income',
        actionType: 'update_profile' as const,
        profileKey: 'work-income',
        contextHash: 'hash-1',
        timestamp: 1,
      },
    ];

    expect(mapEventsToFeedbackSignals(events)).toEqual(mapEventsToFeedbackSignals(events));
  });
});
