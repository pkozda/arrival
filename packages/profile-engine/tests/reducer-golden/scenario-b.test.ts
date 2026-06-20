import { describe, expect, it } from 'vitest';
import {
  buildEvent,
  profileUiSource,
  stateFromEvents,
} from '../helpers.js';
import { getFieldValue } from '../../src/index.js';
import { moduleSource } from '../helpers.js';

describe('golden scenario B — fact.create then fact.correct', () => {
  it('correction survives replay', () => {
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
        type: 'fact.correct',
        intent: 'correction',
        domain: 'income',
        source: profileUiSource('income'),
        mutationId: 'req_correct_1',
        fieldDeltas: [
          {
            fieldId: 'grossMonthlyIncome',
            before: 3000,
            after: 2800,
            operation: 'set',
          },
        ],
      }),
    ];

    const state = stateFromEvents(events);
    expect(getFieldValue(state, 'grossMonthlyIncome')).toBe(2800);
  });
});
