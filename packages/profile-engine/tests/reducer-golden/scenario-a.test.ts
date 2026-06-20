import { describe, expect, it } from 'vitest';
import {
  buildEvent,
  moduleSource,
  stateFromEvents,
  TEST_PROFILE_ID,
} from '../helpers.js';
import { getFieldValue, reduceProfileEvents } from '../../src/index.js';

describe('golden scenario A — fact.create then fact.update', () => {
  it('updated value survives replay', () => {
    const events = [
      buildEvent({
        sequence: 1,
        revision: 1,
        type: 'fact.create',
        intent: 'capture',
        domain: 'income',
        source: moduleSource(),
        fieldDeltas: [
          {
            fieldId: 'grossMonthlyIncome',
            before: null,
            after: 3000,
            operation: 'set',
          },
        ],
      }),
      buildEvent({
        sequence: 2,
        revision: 2,
        type: 'fact.update',
        intent: 'capture',
        domain: 'income',
        source: moduleSource(),
        mutationId: 'req_2',
        fieldDeltas: [
          {
            fieldId: 'grossMonthlyIncome',
            before: 3000,
            after: 3500,
            operation: 'set',
          },
        ],
      }),
    ];

    const state = stateFromEvents(events);
    expect(getFieldValue(state, 'grossMonthlyIncome')).toBe(3500);

    const replay = reduceProfileEvents(TEST_PROFILE_ID, [...events].reverse().sort((a, b) => a.sequence - b.sequence));
    expect(getFieldValue(replay, 'grossMonthlyIncome')).toBe(3500);
  });
});
