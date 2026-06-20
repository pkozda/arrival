import { describe, expect, it } from 'vitest';
import { buildEvent, profileUiSource, stateFromEvents } from '../helpers.js';
import { hasField } from '../../src/index.js';

describe('golden scenario D — fact.invalidate', () => {
  it('removes field from active state', () => {
    const events = [
      buildEvent({
        sequence: 1,
        revision: 1,
        type: 'fact.create',
        intent: 'capture',
        domain: 'housing',
        source: { kind: 'module', moduleId: 'financial-reality' },
        fieldDeltas: [
          {
            fieldId: 'monthlyColdRent',
            before: null,
            after: 900,
            operation: 'set',
          },
        ],
      }),
      buildEvent({
        sequence: 2,
        revision: 2,
        type: 'fact.invalidate',
        intent: 'correction',
        domain: 'housing',
        source: profileUiSource('housing'),
        mutationId: 'req_invalidate',
        fieldDeltas: [
          {
            fieldId: 'monthlyColdRent',
            before: 900,
            after: null,
            operation: 'clear',
          },
        ],
      }),
    ];

    const state = stateFromEvents(events);
    expect(hasField(state, 'monthlyColdRent')).toBe(false);
  });
});
