import { describe, expect, it } from 'vitest';
import {
  appendEconomicRealityEventLogEntry,
  summarizeEventLog,
  traceEconomicStateTransition,
} from './economic-reality-event-log.js';
import { EMPTY_ECONOMIC_FEEDBACK_SIGNALS } from '@arrival-atlas/product-contract';

describe('economic-reality-event-log EP-12', () => {
  it('appends observability entries without UI coupling', () => {
    const entry = {
      event: {
        schemaVersion: '1.0.0' as const,
        type: 'ACTION_EXECUTED' as const,
        actionId: 'a1',
        contextHash: 'hash',
        timestamp: 1,
      },
      feedbackSignals: EMPTY_ECONOMIC_FEEDBACK_SIGNALS,
      economicState: 'employment_active' as const,
    };

    const log = appendEconomicRealityEventLogEntry([], entry);
    expect(log).toHaveLength(1);
    expect(summarizeEventLog(log).eventCount).toBe(1);
  });

  it('traces state transitions caused by feedback enrichment', () => {
    const transition = traceEconomicStateTransition({
      previousState: 'unemployment_transition',
      nextState: 'employment_active',
      feedbackSignals: {
        ...EMPTY_ECONOMIC_FEEDBACK_SIGNALS,
        employmentSignalDelta: 1,
      },
    });

    expect(transition.changed).toBe(true);
    expect(transition.feedbackSignals.employmentSignalDelta).toBe(1);
  });
});
