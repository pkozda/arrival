import { describe, expect, it } from 'vitest';
import {
  buildEvent,
  moduleSource,
  profileUiSource,
  stateFromEvents,
} from '../helpers.js';
import { getFieldValue } from '../../src/index.js';

describe('golden scenario C — fact.correct then module execute', () => {
  it('new module value survives after correction', () => {
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
        mutationId: 'req_correct',
        fieldDeltas: [
          {
            fieldId: 'grossMonthlyIncome',
            before: 3000,
            after: 2800,
            operation: 'set',
          },
        ],
      }),
      buildEvent({
        sequence: 3,
        revision: 3,
        type: 'fact.update',
        intent: 'capture',
        domain: 'income',
        source: { kind: 'module', moduleId: 'financial-reality', executionId: 'exec_2' },
        mutationId: 'req_module_rerun',
        fieldDeltas: [
          {
            fieldId: 'grossMonthlyIncome',
            before: 2800,
            after: 3200,
            operation: 'set',
          },
        ],
      }),
    ];

    const state = stateFromEvents(events);
    expect(getFieldValue(state, 'grossMonthlyIncome')).toBe(3200);
  });
});
